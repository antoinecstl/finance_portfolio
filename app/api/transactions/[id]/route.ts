import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Transaction } from '@/lib/types';
import { simulateAccountSequence } from '@/lib/transaction-validation';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Load the target tx (RLS already scopes to the current user).
  const { data: target, error: targetError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (targetError) {
    console.error('[api/transactions/:id] fetch target failed', targetError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Les frais d'une transaction sont portés par une ligne FEE séparée,
  // référencée via fee_transaction_id — on la supprime en cascade.
  const linkedFeeId: string | null = target.fee_transaction_id ?? null;
  const idsToDelete = new Set<string>([id]);
  if (linkedFeeId) idsToDelete.add(linkedFeeId);

  // Replay the full sequence on the same account without the target tx (and its linked FEE).
  const { data: accountTxs, error: accTxError } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', target.account_id)
    .eq('user_id', user.id);

  if (accTxError) {
    console.error('[api/transactions/:id] fetch account txs failed', accTxError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const remainingAll = ((accountTxs ?? []) as Transaction[]).filter((t) => !idsToDelete.has(t.id));
  const result = simulateAccountSequence(remainingAll);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'deletion_blocked',
        code: result.code,
        reason: result.reason,
        offendingTxId: result.offendingTxId,
        offendingDate: result.offendingDate,
      },
      { status: 409 }
    );
  }

  const { error: delError } = await supabase
    .from('transactions')
    .delete()
    .in('id', Array.from(idsToDelete))
    .eq('user_id', user.id);

  if (delError) {
    console.error('[api/transactions/:id] delete failed', delError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  // Rebuild the denormalized stock_positions row for that (account, symbol)
  // from the remaining transactions so cached quantity/PRU stay coherent.
  if (target.stock_symbol) {
    const symbol = target.stock_symbol.toUpperCase();
    const remaining = remainingAll.filter((t) => t.stock_symbol?.toUpperCase() === symbol);

    let qty = 0;
    let totalInvested = 0;
    for (const tx of remaining) {
      const q = Number(tx.quantity) || 0;
      const p = Number(tx.price_per_unit) || 0;
      if (tx.type === 'BUY') {
        qty += q;
        totalInvested += q * p;
      } else if (tx.type === 'SELL') {
        // PRU unchanged on sells; invested amount shrinks proportionally.
        const pru = qty > 0 ? totalInvested / qty : 0;
        qty -= q;
        totalInvested = Math.max(0, qty) * pru;
      }
    }

    if (qty <= 0) {
      await supabase
        .from('stock_positions')
        .delete()
        .eq('account_id', target.account_id)
        .eq('user_id', user.id)
        .eq('symbol', symbol);
    } else {
      const averagePrice = totalInvested / qty;
      const { data: existing } = await supabase
        .from('stock_positions')
        .select('id')
        .eq('account_id', target.account_id)
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .maybeSingle();
      if (existing) {
        await supabase
          .from('stock_positions')
          .update({ quantity: qty, average_price: averagePrice })
          .eq('id', existing.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
