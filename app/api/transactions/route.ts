import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';

type TransactionPayload = {
  account_id: string;
  type: string;
  amount: number;
  fees?: number;
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

  // Si la transaction principale n'est pas de type FEE et qu'un montant de frais > 0
  // est fourni, une ligne FEE liée sera créée et référencée via fee_transaction_id.
  const feesAmount =
    body.type !== 'FEE' && typeof body.fees === 'number' && body.fees > 0 ? body.fees : 0;
  const slotsNeeded = feesAmount > 0 ? 2 : 1;

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

    if ((count ?? 0) + slotsNeeded > limits.maxTransactions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          limit: limits.maxTransactions,
          message:
            slotsNeeded === 2
              ? `Votre plan Free est limité à ${limits.maxTransactions} transactions. Ajouter des frais crée une ligne supplémentaire — plus de place disponible.`
              : `Votre plan Free est limité à ${limits.maxTransactions} transactions. Passez Pro pour en ajouter plus.`,
        },
        { status: 402 }
      );
    }
  }

  // Étape 1 : si frais, insérer d'abord la ligne FEE (son id sera référencé par la principale).
  let feeTransactionId: string | null = null;
  if (feesAmount > 0) {
    const feeDescription =
      body.stock_symbol
        ? `Frais ${body.type} ${body.stock_symbol.toUpperCase()}`
        : `Frais ${body.type}`;
    const { data: feeRow, error: feeError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id: body.account_id,
        type: 'FEE',
        amount: feesAmount,
        description: feeDescription,
        date: body.date,
        stock_symbol: null,
        quantity: null,
        price_per_unit: null,
      })
      .select('id')
      .single();

    if (feeError || !feeRow) {
      if (feeError?.message?.includes('FREE_TIER_LIMIT')) {
        return NextResponse.json(
          {
            error: 'limit_reached',
            scope: 'transactions',
            message: 'Limite atteinte pour votre plan.',
          },
          { status: 402 }
        );
      }
      console.error('[api/transactions] fee insert failed', feeError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
    feeTransactionId = feeRow.id;
  }

  // Étape 2 : insertion de la transaction principale, avec lien vers la FEE si créée.
  const insertData = {
    user_id: user.id,
    account_id: body.account_id,
    type: body.type,
    amount: body.amount,
    fee_transaction_id: feeTransactionId,
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
    // Rollback manuel de la FEE si la principale échoue — pas de transaction atomique côté Supabase JS.
    if (feeTransactionId) {
      await supabase
        .from('transactions')
        .delete()
        .eq('id', feeTransactionId)
        .eq('user_id', user.id);
    }
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
