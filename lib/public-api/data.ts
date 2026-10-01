import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { getMultipleHistoricalQuotes, getStockQuotes } from '@/lib/stock-api';
import { fxRateSymbol, normalizeToFiat, uniqueForeignFiats, BASE_CURRENCY, type FxRateMap } from '@/lib/fx';
import type { Account, StockQuote, Transaction } from '@/lib/types';
import { buildPublicPortfolio, openPositionSymbols, type PublicPortfolio } from './portfolio';
import { decodeTransactionCursor, encodeTransactionCursor, toPublicTransaction } from './transactions';
import type { TransactionsQuery } from './schemas';
import { PublicApiError } from './errors';

// Accès aux données pour l'API publique.
// L'isolation entre utilisateurs est assurée par Postgres : on transmet le jeton
// reçu aux fonctions api_* (security definer, réservées au service_role), qui
// retrouvent elles-mêmes le propriétaire. Aucun user_id ne vient de l'application.

function localDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// PostgREST plafonne le nombre de lignes par réponse : on pagine explicitement.
const TRANSACTION_PAGE_SIZE = 1000;

type TransactionRpcParams = {
  p_token: string;
  p_account_id?: string | null;
  p_type?: string | null;
  p_symbol?: string | null;
  p_from?: string | null;
  p_to?: string | null;
  p_cursor_date?: string | null;
  p_cursor_time?: string | null;
  p_cursor_id?: string | null;
  p_limit?: number | null;
};

async function fetchTransactions(params: TransactionRpcParams): Promise<Transaction[]> {
  const db = await createAdminClient();
  const { data, error } = await db.rpc('api_transactions', params);
  if (error) {
    console.error('[public-api/data] api_transactions failed', error);
    throw new PublicApiError('internal_error', 'Chargement des transactions impossible');
  }
  return (data ?? []) as Transaction[];
}

async function loadAccountsAndTransactions(token: string): Promise<{ accounts: Account[]; transactions: Transaction[] }> {
  const db = await createAdminClient();
  const { data: accounts, error } = await db.rpc('api_accounts', { p_token: token });
  if (error) {
    console.error('[public-api/data] api_accounts failed', error);
    throw new PublicApiError('internal_error', 'Chargement des comptes impossible');
  }

  const transactions: Transaction[] = [];
  let cursor: TransactionRpcParams = { p_token: token, p_limit: TRANSACTION_PAGE_SIZE };
  for (;;) {
    const page = await fetchTransactions(cursor);
    transactions.push(...page);
    if (page.length < TRANSACTION_PAGE_SIZE) break;
    const last = page[page.length - 1];
    cursor = {
      p_token: token,
      p_limit: TRANSACTION_PAGE_SIZE,
      p_cursor_date: last.date,
      p_cursor_time: last.effective_time ?? null,
      p_cursor_id: last.id,
    };
  }

  return { accounts: (accounts ?? []) as Account[], transactions };
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

export async function getPublicPortfolio(token: string): Promise<PublicPortfolio> {
  const today = localDate();
  const { accounts, transactions } = await loadAccountsAndTransactions(token);
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

export async function getPublicProfile(token: string) {
  const db = await createAdminClient();
  const { data, error } = await db.rpc('api_profile', { p_token: token }).maybeSingle<{ email: string | null; is_pro: boolean }>();
  if (error) {
    console.error('[public-api/data] api_profile failed', error);
    throw new PublicApiError('internal_error', 'Chargement du profil impossible');
  }
  return {
    email: data?.email ?? null,
    plan: data?.is_pro ? 'pro' : 'free',
    base_currency: BASE_CURRENCY,
  };
}

export async function listPublicTransactions(token: string, query: TransactionsQuery) {
  const cursor = decodeTransactionCursor(query.cursor);
  if (query.cursor && !cursor) throw new PublicApiError('invalid_cursor', 'Curseur invalide');

  const rows = await fetchTransactions({
    p_token: token,
    p_account_id: query.account_id ?? null,
    p_type: query.type ?? null,
    p_symbol: query.symbol ?? null,
    p_from: query.from ?? null,
    p_to: query.to ?? null,
    p_cursor_date: cursor?.date ?? null,
    p_cursor_time: cursor?.effective_time ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const last = items[items.length - 1];
  return {
    items: items.map(toPublicTransaction),
    next_cursor: hasMore && last ? encodeTransactionCursor(last) : null,
  };
}
