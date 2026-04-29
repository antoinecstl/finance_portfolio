// POST /api/import/commit — valide chaque transaction proposée et insère
// le lot atomiquement via le RPC insert_transactions_batch.
// La quota free-tier est pré-checké côté RPC (P0001 'FREE_TIER_LIMIT') pour
// éviter un état partiel.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTransactionSchema, formatZodError } from '@/lib/schemas';
import { commitRequestSchema } from '@/lib/import/types';
import { getLimits, hasUserFeature } from '@/lib/subscription';
import { getStockQuotes } from '@/lib/stock-api';
import { accountSupportsPositions } from '@/lib/utils';

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

  const { data: account } = await supabase
    .from('accounts')
    .select('id,type,supports_positions')
    .eq('id', account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
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
    validated.push({
      type: tCheck.data.type,
      amount: tCheck.data.amount,
      fees: tCheck.data.fees ?? 0,
      description: tCheck.data.description ?? '',
      date: tCheck.data.date,
      stock_symbol: tCheck.data.stock_symbol ?? null,
      quantity: tCheck.data.quantity ?? null,
      price_per_unit: tCheck.data.price_per_unit ?? null,
    });
  });

  if (issues.length > 0) {
    return NextResponse.json({ error: 'invalid_rows', issues }, { status: 400 });
  }

  const positionRows = validated
    .map((tx, row) => ({ tx, row }))
    .filter(({ tx }) => tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'DIVIDEND');

  if (positionRows.length > 0 && !accountSupportsPositions(account)) {
    return NextResponse.json(
      {
        error: 'account_does_not_support_positions',
        message: 'Ce compte ne supporte pas les positions boursieres. Importez uniquement des transactions cash ou choisissez un PEA/CTO/Assurance Vie.',
      },
      { status: 403 }
    );
  }

  const symbolsToCheck = Array.from(
    new Set(
      positionRows
        .map(({ tx }) => tx.stock_symbol?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol))
    )
  );

  if (symbolsToCheck.length > 0) {
    const quotes = await getStockQuotes(symbolsToCheck);
    const knownSymbols = new Set(quotes.map((quote) => quote.symbol.toUpperCase()));
    const unknownSymbols = symbolsToCheck.filter((symbol) => !knownSymbols.has(symbol));

    if (unknownSymbols.length > 0) {
      return NextResponse.json(
        {
          error: 'unknown_symbols',
          symbols: unknownSymbols,
          issues: positionRows
            .filter(({ tx }) => tx.stock_symbol && unknownSymbols.includes(tx.stock_symbol.toUpperCase()))
            .map(({ tx, row }) => ({
              row,
              path: 'stock_symbol',
              message: `Ticker non reconnu par Yahoo Finance : ${tx.stock_symbol}`,
            })),
          message: `Ticker non reconnu : ${unknownSymbols.join(', ')}. Corrigez le symbole avant de valider l'import.`,
        },
        { status: 422 }
      );
    }
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
    if (msg.includes('account_does_not_support_positions')) {
      return NextResponse.json({ error: 'account_does_not_support_positions' }, { status: 403 });
    }
    if (msg.includes('INVALID_ACCOUNT_SEQUENCE')) {
      return NextResponse.json({ error: 'invalid_state', message: msg }, { status: 409 });
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
