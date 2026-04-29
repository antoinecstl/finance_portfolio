import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Transaction } from '@/lib/types';
import { simulateAccountSequence } from '@/lib/transaction-validation';
import { createTransactionSchema, formatZodError } from '@/lib/schemas';
import { accountSupportsPositions } from '@/lib/utils';

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

// PATCH /api/transactions/:id — édite une transaction existante.
// Le compte n'est pas modifiable (changer de compte casserait la séquence des
// deux côtés ; pour ça l'utilisateur supprime puis recrée).
// La ligne FEE liée est gérée atomiquement par le RPC update_transaction_with_fee
// (création / mise à jour / suppression selon le nouveau montant de frais).
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: target, error: targetError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (targetError) {
    console.error('[api/transactions/:id] PATCH fetch target failed', targetError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Une ligne FEE rattachée à une autre transaction (child fee) ne s'édite
  // pas directement : on doit passer par la transaction parente.
  const { count: parentReferenceCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('fee_transaction_id', id);

  if ((parentReferenceCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: 'fee_child_not_editable',
        message: "Cette ligne de frais est rattachée à une autre transaction. Modifiez la transaction parente pour ajuster les frais.",
      },
      { status: 409 }
    );
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
  // L'account_id reste celui de la cible : on l'injecte avant validation pour
  // réutiliser le schéma de création tel quel.
  const parsed = createTransactionSchema.safeParse({
    ...(raw as Record<string, unknown>),
    account_id: target.account_id,
  });
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  const { data: account } = await supabase
    .from('accounts')
    .select('id,type,supports_positions')
    .eq('id', target.account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
  }
  if (['BUY', 'SELL', 'DIVIDEND'].includes(body.type) && !accountSupportsPositions(account)) {
    return NextResponse.json({ error: 'account_does_not_support_positions' }, { status: 403 });
  }

  const newFees = body.type !== 'FEE' && body.fees && body.fees > 0 ? body.fees : 0;

  // Pré-validation côté JS de la séquence : on remplace la cible (et son
  // FEE lié si existant) par les nouvelles valeurs, on simule, on refuse si
  // l'état est invalide. Le trigger DB re-vérifie de toute façon, mais on
  // gagne un message d'erreur explicite ici.
  const { data: existingTxs, error: existingErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', target.account_id)
    .eq('user_id', user.id);

  if (existingErr) {
    console.error('[api/transactions/:id] PATCH fetch existing failed', existingErr);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const all = (existingTxs ?? []) as Transaction[];
  const childFeeId: string | null = target.fee_transaction_id ?? null;
  const projected: Transaction[] = all
    .filter((t) => t.id !== target.id && t.id !== childFeeId)
    .concat({
      ...target,
      type: body.type,
      amount: body.amount,
      description: body.description ?? '',
      date: body.date,
      stock_symbol: body.stock_symbol,
      quantity: body.quantity,
      price_per_unit: body.price_per_unit,
    } as Transaction);

  if (newFees > 0) {
    projected.push({
      id: childFeeId ?? '__pending_fee__',
      account_id: target.account_id,
      type: 'FEE',
      amount: newFees,
      description: '',
      date: body.date,
      // Conserve le created_at original si on update une FEE existante, pour
      // que l'ordre dans la séquence reste celui de la transaction principale.
      created_at: target.created_at ?? new Date().toISOString(),
    });
  }

  const sim = simulateAccountSequence(projected);
  if (!sim.ok) {
    return NextResponse.json(
      {
        error: 'invalid_state',
        code: sim.code,
        reason: sim.reason,
        offendingDate: sim.offendingDate,
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabase.rpc('update_transaction_with_fee', {
    p_transaction_id: id,
    p_type: body.type,
    p_amount: body.amount,
    p_description: body.description ?? '',
    p_date: body.date,
    p_stock_symbol: body.stock_symbol ?? null,
    p_quantity: body.quantity ?? null,
    p_price_per_unit: body.price_per_unit ?? null,
    p_fees: newFees > 0 ? newFees : null,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('INVALID_ACCOUNT_SEQUENCE')) {
      return NextResponse.json(
        { error: 'invalid_state', message: msg },
        { status: 409 }
      );
    }
    if (msg.includes('fee_child_not_editable')) {
      return NextResponse.json({ error: 'fee_child_not_editable' }, { status: 409 });
    }
    if (msg.includes('fee_on_fee_not_allowed')) {
      return NextResponse.json({ error: 'fee_on_fee_not_allowed' }, { status: 400 });
    }
    if (msg.includes('not_found')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[api/transactions/:id] update rpc failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ transaction: data });
}
