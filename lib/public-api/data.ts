import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { getMultipleHistoricalQuotes, getStockQuotes } from '@/lib/stock-api';
import { fxRateSymbol, normalizeToFiat, uniqueForeignFiats, BASE_CURRENCY, type FxRateMap } from '@/lib/fx';
import { encodeCursor, decodeCursor } from '@/lib/pagination';
import { getUserSubscription } from '@/lib/subscription';
import type { Account, StockQuote, Transaction } from '@/lib/types';
import { buildPublicPortfolio, openPositionSymbols, type PublicPortfolio } from './portfolio';
import type { TransactionsQuery } from './schemas';
import { PublicApiError } from './errors';

// Accès aux données pour l'API publique. Les requêtes utilisent le client
// service role (pas de session cookie) : CHAQUE requête doit filtrer par userId.

function localDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


async function loadAccountsAndTransactions(userId: string): Promise<{ accounts: Account[]; transactions: Transaction[] }> {
  const db = await createAdminClient();
  const [accounts, transactions] = await Promise.all([
    db.from('accounts').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('transactions').select('*').eq('user_id', userId),
  ]);
  if (accounts.error || transactions.error) {
    console.error('[public-api/data] load failed', accounts.error ?? transactions.error);
    throw new PublicApiError('internal_error', 'Chargement des données impossible');
  }
  return { accounts: (accounts.data ?? []) as Account[], transactions: (transactions.data ?? []) as Transaction[] };
}

async function loadLatestFxRates(currencies: string[], today: string): Promise<FxRateMap> {
  const fiats = Array.from(
    new Set(currencies.map(normalizeToFiat).filter((fiat) => fiat !== BASE_CURRENCY))
  );
  if (fiats.length === 0) return {};
  // Une dizaine de jours couvre week-ends et jours fériés.
  const start = new Date();
  start.setDate(start.getDate() - 10);
  const symbolByFiat = new Map<string, string>();
  for (const fiat of fiats) {
    const symbol = fxRateSymbol(fiat);
    if (symbol) symbolByFiat.set(fiat, symbol);
  }
  try {
    const market = await getMultipleHistoricalQuotes(Array.from(symbolByFiat.values()), localDate(start), today, '1d');
    const rates: FxRateMap = {};
    symbolByFiat.forEach((symbol, fiat) => {
      rates[fiat] = market[symbol] ?? [];
    });
    return rates;
  } catch (error) {
    console.warn('[public-api/data] fx fetch failed', error);
    return {};
  }
}

export async function getPublicPortfolio(userId: string): Promise<PublicPortfolio> {
  const today = localDate();
  const { accounts, transactions } = await loadAccountsAndTransactions(userId);
  const symbols = openPositionSymbols(accounts, transactions, today);

  let quoteList: StockQuote[] = [];
  if (symbols.length > 0) {
    try {
      quoteList = await getStockQuotes(symbols);
    } catch (error) {
      // Sans cours, les positions sont valorisées au PRU (price_is_live=false).
      console.warn('[public-api/data] quotes fetch failed', error);
    }
  }
  const quotes: Record<string, StockQuote> = {};
  for (const quote of quoteList) quotes[quote.symbol] = quote;

  const fxRates = await loadLatestFxRates(
    [
      ...uniqueForeignFiats(transactions),
      ...quoteList.map((quote) => quote.currency ?? BASE_CURRENCY),
    ],
    today
  );

  return buildPublicPortfolio({ accounts, transactions, quotes, fxRates, today });
}

export async function getPublicProfile(userId: string) {
  const db = await createAdminClient();
  const [{ data: authUser }, subscription] = await Promise.all([
    db.auth.admin.getUserById(userId),
    getUserSubscription(userId),
  ]);
  return {
    email: authUser?.user?.email ?? null,
    plan: subscription.planId,
    base_currency: BASE_CURRENCY,
  };
}

const TRANSACTION_COLUMNS =
  'id, account_id, type, date, time, effective_time, amount, currency, stock_symbol, quantity, price_per_unit, target_amount, target_currency, description';

// Le curseur est interpolé dans un filtre PostgREST : on n'accepte que des
// valeurs au format attendu (date, heure, uuid).
function decodeSafeCursor(raw: string | undefined) {
  const cursor = decodeCursor(raw);
  if (!cursor) return null;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(cursor.date) &&
    /^\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(cursor.effective_time) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id);
  return valid ? cursor : null;
}

export async function listPublicTransactions(userId: string, query: TransactionsQuery) {
  const cursor = decodeSafeCursor(query.cursor);
  if (query.cursor && !cursor) throw new PublicApiError('invalid_cursor', 'Curseur invalide');

  const db = await createAdminClient();
  let request = db
    .from('transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('effective_time', { ascending: false })
    .order('id', { ascending: false })
    .limit(query.limit + 1);

  if (query.account_id) request = request.eq('account_id', query.account_id);
  if (query.type) request = request.eq('type', query.type);
  if (query.symbol) request = request.eq('stock_symbol', query.symbol);
  if (query.from) request = request.gte('date', query.from);
  if (query.to) request = request.lte('date', query.to);
  if (cursor) {
    request = request.or(
      [
        `date.lt.${cursor.date}`,
        `and(date.eq.${cursor.date},effective_time.lt.${cursor.effective_time})`,
        `and(date.eq.${cursor.date},effective_time.eq.${cursor.effective_time},id.lt.${cursor.id})`,
      ].join(',')
    );
  }

  const { data, error } = await request;
  if (error) {
    console.error('[public-api/data] transactions failed', error);
    throw new PublicApiError('internal_error', 'Chargement des transactions impossible');
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { date: string; effective_time: string; id: string }>;
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const last = items[items.length - 1];
  return {
    // effective_time sert au tri/curseur uniquement.
    items: items.map((row) => {
      const { effective_time: _omit, ...rest } = row;
      void _omit;
      return rest;
    }),
    next_cursor:
      hasMore && last ? encodeCursor({ date: last.date, effective_time: last.effective_time, id: last.id }) : null,
  };
}
