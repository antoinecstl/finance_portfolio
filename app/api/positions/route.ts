import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';
import { createPositionSchema, formatZodError } from '@/lib/schemas';
import { accountSupportsPositions } from '@/lib/utils';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = createPositionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  const { data: account } = await supabase
    .from('accounts')
    .select('id,type,supports_positions')
    .eq('id', body.account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
  }
  if (!accountSupportsPositions(account)) {
    return NextResponse.json({ error: 'account_does_not_support_positions' }, { status: 403 });
  }

  const limits = await getLimits(user.id);
  let currentCount = 0;
  const enforceLimit = Number.isFinite(limits.maxPositions);

  if (enforceLimit) {
    const { count, error: countError } = await supabase
      .from('stock_positions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[api/positions] count failed', countError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    currentCount = count ?? 0;

    if (currentCount >= limits.maxPositions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'positions',
          limit: limits.maxPositions,
          current: currentCount,
          message: `Votre plan Free est limité à ${limits.maxPositions} positions boursières. Passez Pro pour en ajouter plus.`,
        },
        { status: 402 }
      );
    }
  }

  const { data, error } = await supabase
    .from('stock_positions')
    .insert({
      user_id: user.id,
      account_id: body.account_id,
      symbol: body.symbol,
      name: body.name,
      quantity: body.quantity,
      average_price: body.average_price,
      currency: body.currency ?? 'EUR',
      sector: body.sector ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.message?.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'positions',
          message: 'Limite atteinte pour votre plan.',
        },
        { status: 402 }
      );
    }
    console.error('[api/positions] insert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const atCap = enforceLimit && currentCount + 1 >= limits.maxPositions;

  return NextResponse.json(
    {
      position: data,
      ...(atCap
        ? { at_cap: true, scope: 'positions', current: currentCount + 1, limit: limits.maxPositions }
        : {}),
    },
    { status: 201 }
  );
}
