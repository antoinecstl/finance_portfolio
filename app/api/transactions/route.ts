import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';
import { createTransactionSchema, paginationSchema, formatZodError } from '@/lib/schemas';
import { decodeCursor, encodeCursor } from '@/lib/pagination';

// GET /api/transactions?cursor=<opaque>&limit=50&accountId=<uuid>
// Pagination cursor-based sur (date DESC, id DESC) pour rester stable
// même quand de nouvelles transactions sont insérées en tête.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = paginationSchema.safeParse({
    cursor: params.get('cursor') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const { cursor: rawCursor, limit } = parsed.data;
  const cursor = decodeCursor(rawCursor);
  const accountId = params.get('accountId');

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1); // +1 pour savoir s'il y a encore des pages

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  if (cursor) {
    // (date, id) < (cursor.date, cursor.id) en lexicographie ordre desc.
    // Supabase/PostgREST n'a pas d'opérateur tuple natif : on utilise .or().
    query = query.or(
      `date.lt.${cursor.date},and(date.eq.${cursor.date},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('[api/transactions] GET failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ date: last.date, id: last.id }) : null;

  return NextResponse.json({ items, nextCursor });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = createTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  // Vérifie que le compte appartient au caller AVANT d'appeler le RPC.
  // (Le RPC revérifie, mais on gagne un round-trip en cas d'accès interdit.)
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', body.account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
  }

  const feesAmount = body.type !== 'FEE' && body.fees && body.fees > 0 ? body.fees : 0;
  const slotsNeeded = feesAmount > 0 ? 2 : 1;

  const limits = await getLimits(user.id);
  const enforceLimit = Number.isFinite(limits.maxTransactions);
  let currentCount = 0;
  if (enforceLimit) {
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[api/transactions] count failed', countError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    currentCount = count ?? 0;

    if (currentCount + slotsNeeded > limits.maxTransactions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          limit: limits.maxTransactions,
          current: currentCount,
          message:
            slotsNeeded === 2
              ? `Votre plan Free est limité à ${limits.maxTransactions} transactions. Ajouter des frais crée une ligne supplémentaire — plus de place disponible.`
              : `Votre plan Free est limité à ${limits.maxTransactions} transactions. Passez Pro pour en ajouter plus.`,
        },
        { status: 402 }
      );
    }
  }

  // Insertion atomique via RPC : si l'insert principal échoue après la FEE,
  // PostgreSQL rollback automatiquement. Plus de code de rollback manuel.
  const { data, error } = await supabase.rpc('insert_transaction_with_fee', {
    p_account_id: body.account_id,
    p_type: body.type,
    p_amount: body.amount,
    p_description: body.description ?? '',
    p_date: body.date,
    p_stock_symbol: body.stock_symbol ?? null,
    p_quantity: body.quantity ?? null,
    p_price_per_unit: body.price_per_unit ?? null,
    p_fees: feesAmount > 0 ? feesAmount : null,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        { error: 'limit_reached', scope: 'transactions', message: 'Limite atteinte pour votre plan.' },
        { status: 402 }
      );
    }
    if (msg.includes('invalid_account')) {
      return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
    }
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[api/transactions] rpc failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const atCap = enforceLimit && currentCount + slotsNeeded >= limits.maxTransactions;

  return NextResponse.json(
    {
      transaction: data,
      ...(atCap
        ? {
            at_cap: true,
            scope: 'transactions',
            current: currentCount + slotsNeeded,
            limit: limits.maxTransactions,
          }
        : {}),
    },
    { status: 201 }
  );
}
