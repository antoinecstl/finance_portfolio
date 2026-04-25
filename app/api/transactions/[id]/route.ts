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
    .rpc('delete_transaction_with_rebuild', { p_transaction_id: id });

  if (delError) {
    console.error('[api/transactions/:id] delete failed', delError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
