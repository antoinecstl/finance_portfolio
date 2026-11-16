// POST /api/positions/quick — saisie rapide d'un portefeuille déjà constitué.
// Corps : { account_id, date, cash?, positions: [{ symbol, quantity, average_price }] }
// Enregistre en une fois (tout ou rien) le versement de départ et un achat par
// titre, au prix de revient indiqué. Voir lib/quick-portfolio.ts.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';
import { formatZodError, isoDateSchema, stockSymbolSchema } from '@/lib/schemas';
import { getStockQuotes } from '@/lib/stock-api';
import { buildQuickPortfolio, heldSymbols, QUICK_PORTFOLIO_MAX_ROWS } from '@/lib/quick-portfolio';
import { formatInvalidAccountSequenceMessage } from '@/lib/sequence-errors';

const bodySchema = z.object({
  account_id: z.string().uuid(),
  date: isoDateSchema,
  cash: z.number().finite().min(0).max(1_000_000_000).nullish(),
  positions: z
    .array(
      z.object({
        symbol: stockSymbolSchema,
        quantity: z.number().finite().positive('Quantité > 0 requise'),
        average_price: z.number().finite().positive('Prix de revient > 0 requis'),
      })
    )
    .min(1, 'Ajoutez au moins un titre')
    .max(QUICK_PORTFOLIO_MAX_ROWS, `${QUICK_PORTFOLIO_MAX_ROWS} titres au plus`),
});

export async function POST(request: Request) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  const body = parsed.data;

  const today = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10); // tolère tous les fuseaux
  if (body.date > today) {
    return NextResponse.json({ error: 'invalid_payload', message: 'La date ne peut pas être dans le futur.' }, { status: 400 });
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('id,type,supports_positions,currency')
    .eq('id', body.account_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: 'invalid_account' }, { status: 403 });

  // Le cours sert à confirmer que le titre existe et à fixer sa devise de
  // cotation : on ne fait pas confiance à une devise envoyée par le navigateur.
  const symbols = Array.from(new Set(body.positions.map((p) => p.symbol)));
  const quotes = await getStockQuotes(symbols);
  const currencyBySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), (q.currency || '').toUpperCase()]));
  const unknown = symbols.filter((s) => !currencyBySymbol.has(s));
  if (unknown.length > 0) {
    return NextResponse.json(
      {
        error: 'unknown_symbols',
        symbols: unknown,
        message: `Titre non reconnu : ${unknown.join(', ')}. Choisissez-le dans la liste proposée.`,
      },
      { status: 422 }
    );
  }

  const built = buildQuickPortfolio(account, {
    date: body.date,
    cash: body.cash ?? 0,
    positions: body.positions.map((p) => ({
      symbol: p.symbol,
      quantity: p.quantity,
      averagePrice: p.average_price,
      currency: currencyBySymbol.get(p.symbol) || null,
    })),
  });
  if (!built.ok) {
    return NextResponse.json({ error: 'invalid_payload', message: built.error, row: built.row }, { status: 400 });
  }

  // Limites de l'offre : transactions et positions distinctes.
  const limits = await getLimits(user.id);
  if (Number.isFinite(limits.maxTransactions) || Number.isFinite(limits.maxPositions)) {
    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('type, stock_symbol, quantity')
      .eq('user_id', user.id);
    if (existingError) {
      console.error('[api/positions/quick] fetch existing failed', existingError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
    const rows = existing ?? [];

    if (rows.length + built.transactions.length > limits.maxTransactions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'transactions',
          limit: limits.maxTransactions,
          current: rows.length,
          message: `Cette saisie crée ${built.transactions.length} opérations, et votre offre Free en autorise ${limits.maxTransactions} au total (${rows.length} déjà enregistrées).`,
        },
        { status: 402 }
      );
    }

    const held = heldSymbols(rows);
    const added = built.symbols.filter((s) => !held.has(s)).length;
    if (held.size + added > limits.maxPositions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'positions',
          limit: limits.maxPositions,
          current: held.size,
          message: `Votre offre Free suit ${limits.maxPositions} positions au plus (${held.size} aujourd’hui). Retirez des lignes ou passez Pro pour un portefeuille sans limite.`,
        },
        { status: 402 }
      );
    }
  }

  const { data, error } = await supabase.rpc('insert_transactions_batch', {
    p_account_id: body.account_id,
    p_transactions: built.transactions,
    p_import_job_id: null,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        { error: 'limit_reached', scope: 'transactions', message: 'Limite atteinte pour votre offre.' },
        { status: 402 }
      );
    }
    if (msg.includes('invalid_account')) return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
    if (msg.includes('account_does_not_support_positions')) {
      return NextResponse.json({ error: 'account_does_not_support_positions' }, { status: 403 });
    }
    if (msg.includes('INVALID_ACCOUNT_SEQUENCE')) {
      return NextResponse.json(
        { error: 'invalid_state', message: formatInvalidAccountSequenceMessage(msg) },
        { status: 409 }
      );
    }
    if (msg.includes('unauthorized')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    console.error('[api/positions/quick] rpc failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, positions: built.symbols.length, inserted: (data as { inserted?: number } | null)?.inserted ?? built.transactions.length },
    { status: 201 }
  );
}
