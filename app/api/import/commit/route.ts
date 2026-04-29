// POST /api/import/commit — valide chaque transaction proposée et insère
// le lot atomiquement via le RPC insert_transactions_batch.
// La quota free-tier est pré-checké côté RPC (P0001 'FREE_TIER_LIMIT') pour
// éviter un état partiel.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTransactionSchema, formatZodError } from '@/lib/schemas';
import { commitRequestSchema } from '@/lib/import/types';
import { getLimits, hasUserFeature } from '@/lib/subscription';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!(await hasUserFeature(user.id, 'import_transactions'))) {
    return NextResponse.json(
      {
        error: 'pro_required',
        message: 'L\'import de transactions est reserve aux utilisateurs Pro.',
      },
      { status: 402 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = commitRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const { import_job_id, account_id, transactions } = parsed.data;

  // Vérifie le job ET son appartenance. Status doit être previewing pour committer.
  const { data: job } = await supabase
    .from('import_jobs')
    .select('id, status, account_id')
    .eq('id', import_job_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
  }
  if (job.status !== 'previewing') {
    return NextResponse.json(
      { error: 'job_already_committed', status: job.status },
      { status: 409 }
    );
  }
  if (job.account_id !== account_id) {
    return NextResponse.json({ error: 'account_mismatch' }, { status: 400 });
  }

  // Re-validation stricte de chaque ligne via le schéma de transactions classique.
  // Le payload peut différer de ce qu'on a renvoyé au client (édition manuelle).
  const validated: typeof transactions = [];
  const issues: Array<{ row: number; path: string; message: string }> = [];
  transactions.forEach((tx, idx) => {
    const tCheck = createTransactionSchema.safeParse({
      account_id,
      type: tx.type,
      amount: tx.amount,
      fees: tx.fees,
      description: tx.description,
      date: tx.date,
      stock_symbol: tx.stock_symbol ?? undefined,
      quantity: tx.quantity ?? undefined,
      price_per_unit: tx.price_per_unit ?? undefined,
    });
    if (!tCheck.success) {
      tCheck.error.issues.forEach((i) => {
        issues.push({ row: idx, path: i.path.join('.'), message: i.message });
      });
      return;
    }
    validated.push(tx);
  });

  if (issues.length > 0) {
    return NextResponse.json({ error: 'invalid_rows', issues }, { status: 400 });
  }

  // Pré-check plan limit pour message clair (le RPC re-vérifie de toute façon).
  const limits = await getLimits(user.id);
  if (Number.isFinite(limits.maxTransactions)) {
    const slotsNeeded = validated.reduce((acc, tx) => {
      const needsFee = tx.type !== 'FEE' && (tx.fees ?? 0) > 0;
      return acc + (needsFee ? 2 : 1);
    }, 0);
    const { count: currentCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((currentCount ?? 0) + slotsNeeded > limits.maxTransactions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          current: currentCount ?? 0,
          slotsNeeded,
          limit: limits.maxTransactions,
          message: `Cet import créerait ${slotsNeeded} lignes mais votre plan Free n'autorise que ${limits.maxTransactions} transactions au total. Vous en avez ${currentCount ?? 0} actuellement.`,
        },
        { status: 402 }
      );
    }
  }

  const { data, error } = await supabase.rpc('insert_transactions_batch', {
    p_account_id: account_id,
    p_transactions: validated,
    p_import_job_id: import_job_id,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          message: msg,
        },
        { status: 402 }
      );
    }
    if (msg.includes('PRO_REQUIRED')) {
      return NextResponse.json(
        {
          error: 'pro_required',
          message: 'L\'import de transactions est reserve aux utilisateurs Pro.',
        },
        { status: 402 }
      );
    }
    if (msg.includes('invalid_account')) {
      return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
    }
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[api/import/commit] rpc failed', error);
    // Marque le job en échec pour permettre une nouvelle tentative.
    await supabase
      .from('import_jobs')
      .update({ status: 'failed' })
      .eq('id', import_job_id)
      .eq('user_id', user.id);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json(data ?? { inserted: validated.length, total: validated.length });
}
