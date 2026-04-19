import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';

type TransactionPayload = {
  account_id: string;
  type: string;
  amount: number;
  description?: string;
  date: string;
  stock_symbol?: string;
  quantity?: number;
  price_per_unit?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as TransactionPayload | null;
  if (!body || !body.account_id || !body.type || typeof body.amount !== 'number' || !body.date) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // Verify the account belongs to the caller — RLS only guards user_id on insert,
  // not the account_id FK, so an authenticated user could otherwise attach rows
  // to another user's account.
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', body.account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
  }

  const limits = await getLimits(user.id);

  if (Number.isFinite(limits.maxTransactions)) {
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[api/transactions] count failed', countError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    if ((count ?? 0) >= limits.maxTransactions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          limit: limits.maxTransactions,
          message: `Votre plan Free est limité à ${limits.maxTransactions} transactions. Passez Pro pour en ajouter plus.`,
        },
        { status: 402 }
      );
    }
  }

  const insertData = {
    user_id: user.id,
    account_id: body.account_id,
    type: body.type,
    amount: body.amount,
    description: body.description ?? '',
    date: body.date,
    stock_symbol: body.stock_symbol ?? null,
    quantity: body.quantity ?? null,
    price_per_unit: body.price_per_unit ?? null,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (error.message?.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          message: 'Limite atteinte pour votre plan.',
        },
        { status: 402 }
      );
    }
    console.error('[api/transactions] insert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
