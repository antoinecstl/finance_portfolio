'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Account, Transaction, StockPosition, StockQuote, PortfolioSummary } from '@/lib/types';
import { HistoricalQuote } from '@/lib/stock-api';
import {
  calculatePortfolioHistory,
  getUniqueSymbolsFromTransactions,
  getFirstTransactionDate,
  PortfolioHistoryPoint,
  calculateAccountCashByCurrencyAtDate,
  calculateAllPositionsAtDate,
} from '@/lib/portfolio-calculator';
import { readSnapshots, upsertSnapshots } from '@/lib/portfolio-snapshots';
import { accountSupportsPositions } from '@/lib/utils';
import { convertToBase, uniqueForeignFiats, type FxRateMap } from '@/lib/fx';

async function fetchFxRates(
  fiats: string[],
  startDate: string,
  endDate: string
): Promise<FxRateMap> {
  if (fiats.length === 0) return {};
  try {
    const params = new URLSearchParams({
      currencies: fiats.join(','),
      startDate,
      endDate,
    });
    const res = await fetch(`/api/fx/history?${params.toString()}`);
    if (!res.ok) {
      console.warn('[fx] history fetch failed:', res.status);
      return {};
    }
    return (await res.json()) as FxRateMap;
  } catch (e) {
    console.warn('[fx] history fetch error:', e);
    return {};
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Hook pour récupérer les comptes
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (): Promise<Account[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      const nextAccounts = data || [];
      setAccounts(nextAccounts);
      return nextAccounts;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, loading, error, refetch: fetchAccounts };
}

// Hook pour la pagination cursor-based côté client.
// Alternative à useTransactions pour les vues "Historique complet" sur gros volumes.
// Utilise l'endpoint GET /api/transactions.
export function usePaginatedTransactions(opts: { accountId?: string; pageSize?: number; version?: number } = {}) {
  const { accountId, pageSize = 50, version = 0 } = opts;
  const [pages, setPages] = useState<Transaction[][]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const loadPage = useCallback(async (cursor: string | null, reset: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (cursor) params.set('cursor', cursor);
      if (accountId) params.set('accountId', accountId);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPages((prev) => (reset ? [data.items] : [...prev, data.items]));
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [accountId, pageSize]);

  useEffect(() => {
    setInitialLoaded(false);
    loadPage(null, true).finally(() => setInitialLoaded(true));
  }, [loadPage, version]);

  const loadMore = useCallback(() => {
    if (nextCursor && !loading) {
      loadPage(nextCursor, false);
    }
  }, [nextCursor, loading, loadPage]);

  const transactions = useMemo(() => pages.flat(), [pages]);
  return { transactions, loadMore, hasMore: nextCursor !== null, loading, error, initialLoaded };
}

// Hook pour récupérer les transactions
export function useTransactions(accountId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (): Promise<Transaction[]> => {
    try {
      setLoading(true);
      let query = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const nextTransactions = data || [];
      setTransactions(nextTransactions);
      return nextTransactions;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      return [];
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}

// Hook pour récupérer les positions
export function usePositions(accountId?: string) {
  const [positions, setPositions] = useState<StockPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async (): Promise<StockPosition[]> => {
    try {
      setLoading(true);
      let query = supabase
        .from('stock_positions')
        .select('*')
        .order('symbol', { ascending: true });

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const nextPositions = data || [];
      setPositions(nextPositions);
      return nextPositions;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      return [];
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return { positions, loading, error, refetch: fetchPositions };
}

// Hook pour récupérer les cours d'actions
type StockQuotesOptions = {
  enabled?: boolean;
  refreshMs?: number | null;
};

export function useStockQuotes(symbols: string[], options: StockQuotesOptions = {}) {
  const { enabled = true, refreshMs = null } = options;
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clé stable : évite les re-fetch quand `symbols` change de référence mais pas de contenu
  // (sinon refetch(nextSymbols) + useEffect déclenchent deux appels consécutifs).
  const symbolsKey = useMemo(() => [...symbols].map(s => s.toUpperCase()).sort().join(','), [symbols]);

  const fetchQuotes = useCallback(async (overrideSymbols?: string[]) => {
    const targetSymbols = overrideSymbols ?? (symbolsKey ? symbolsKey.split(',') : []);

    if (targetSymbols.length === 0) {
      setQuotes({});
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/stocks/quotes?symbols=${targetSymbols.join(',')}`);

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des cours');
      }

      const data = await response.json();
      const quotesMap: Record<string, StockQuote> = {};

      data.quotes.forEach((quote: StockQuote) => {
        quotesMap[quote.symbol] = quote;
      });

      setQuotes(quotesMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [symbolsKey]);

  useEffect(() => {
    if (!enabled) return;

    fetchQuotes();

    if (!refreshMs) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchQuotes();
    }, refreshMs);
    return () => clearInterval(interval);
  }, [enabled, fetchQuotes, refreshMs]);

  return { quotes, loading, error, refetch: fetchQuotes };
}

// Hook pour calculer le résumé du portefeuille
export function usePortfolioSummary(
  positions: StockPosition[],
  quotes: Record<string, StockQuote>,
  fxRates: FxRateMap = {}
): PortfolioSummary {
  return useMemo(() => {
    const today = formatLocalDate(new Date());
    let totalValue = 0;
    let totalInvested = 0;
    let dayChange = 0;

    positions.forEach((position) => {
      const quote = quotes[position.symbol];
      const currentPrice = quote?.price ?? position.average_price;
      const previousClose = quote?.previousClose || currentPrice;
      // `position.currency` est `'EUR'` par défaut en base même pour BTC-USD ou
      // SOL-USD, donc la cotation Yahoo (`quote.currency`) est plus fiable.
      // Sans ça, un PRU stocké en USD est traité comme EUR et gonfle la +/- value.
      const tradeCurrency = (quote?.currency ?? position.currency ?? 'EUR').toUpperCase();

      const positionValue = convertToBase(position.quantity * currentPrice, tradeCurrency, today, fxRates);
      const positionInvested = convertToBase(position.quantity * position.average_price, tradeCurrency, today, fxRates);
      const positionDayChange = convertToBase(position.quantity * (currentPrice - previousClose), tradeCurrency, today, fxRates);

      totalValue += positionValue;
      totalInvested += positionInvested;
      dayChange += positionDayChange;
    });

    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const dayChangePercent = (totalValue - dayChange) > 0 
      ? (dayChange / (totalValue - dayChange)) * 100 
      : 0;

    return {
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      dayChange,
      dayChangePercent,
    };
  }, [positions, quotes, fxRates]);
}

// Hook pour la recherche d'actions
export function useStockSearch() {
  const [results, setResults] = useState<Array<{ symbol: string; name: string; exchange: string }>>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Erreur lors de la recherche');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}

// Hook pour l'historique du portefeuille (calculé dynamiquement)
export function usePortfolioHistory(
  transactions: Transaction[],
  accounts: Account[],
  periodDays: number = 30,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [fxRates, setFxRates] = useState<FxRateMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Déterminer les dates, symboles et devises non-EUR nécessaires
  const { startDate, endDate, symbols, foreignFiats } = useMemo(() => {
    const end = formatLocalDate(new Date());

    // Trouver la première transaction ou utiliser la période demandée
    const firstTxDate = getFirstTransactionDate(transactions);
    let start: string;

    if (firstTxDate) {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      const periodStartStr = formatLocalDate(periodStart);

      // Prendre la date la plus récente entre la première transaction et le début de période
      start = firstTxDate > periodStartStr ? firstTxDate : periodStartStr;
    } else {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      start = formatLocalDate(periodStart);
    }

    const syms = getUniqueSymbolsFromTransactions(transactions);
    const fiats = uniqueForeignFiats(transactions);

    return { startDate: start, endDate: end, symbols: syms, foreignFiats: fiats };
  }, [transactions, periodDays]);

  const foreignFiatsKey = useMemo(() => [...foreignFiats].sort().join(','), [foreignFiats]);

  // Récupérer les cours historiques et calculer l'historique
  const fetchHistory = useCallback(async () => {
    if (!enabled) return;

    if (transactions.length === 0) {
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1) Tentative de lecture du cache snapshots. Si on a couvert toute la plage,
      // on évite l'appel Yahoo Finance et le recalcul complet.
      if (user) {
        const cached = await readSnapshots(user.id, startDate, endDate);
        if (cached.length > 0) {
          const cachedPoints: PortfolioHistoryPoint[] = cached.map((s) => ({
            date: s.date,
            totalValue: Number(s.total_value),
            stocksValue: Number(s.stocks_value),
            savingsValue: Number(s.savings_value),
            positions: (s.breakdown as { positions?: PortfolioHistoryPoint['positions'] } | null)?.positions ?? [],
          }));
          // On affiche tout de suite les points cachés pour que l'UI soit réactive.
          setHistory(cachedPoints);
        }
      }

      let historicalQuotes: Record<string, HistoricalQuote[]> = {};

      // Cours actions + taux FX en parallèle (deux requêtes Yahoo distinctes).
      const fxPromise = fetchFxRates(foreignFiats, startDate, endDate);

      if (symbols.length > 0) {
        const response = await fetch(
          `/api/stocks/history?symbols=${symbols.join(',')}&startDate=${startDate}&endDate=${endDate}&interval=1d`
        );

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des cours historiques');
        }

        historicalQuotes = await response.json();
      }

      const fetchedFxRates = await fxPromise;

      // Calculer l'historique avec l'intervalle approprié
      const interval = periodDays > 90 ? 'weekly' : 'daily';
      const calculatedHistory = calculatePortfolioHistory(
        transactions,
        accounts,
        historicalQuotes,
        startDate,
        endDate,
        interval,
        fetchedFxRates
      );

      setHistory(calculatedHistory);
      setFxRates(fetchedFxRates);

      // 2) Upsert du cache (non bloquant). Le trigger DB invalide automatiquement
      // quand une transaction est ajoutée/modifiée/supprimée.
      if (user) {
        upsertSnapshots(user.id, calculatedHistory).catch(() => {
          /* non bloquant, déjà loggué */
        });
      }
    } catch (err) {
      console.error('Error calculating portfolio history:', err);
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, transactions, accounts, symbols, startDate, endDate, periodDays, foreignFiatsKey]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, fxRates, loading, error, refetch: fetchHistory };
}

/**
 * Hook pour l'historique complet du portefeuille (pour la performance annuelle)
 * Commence au 1er janvier de l'année de la première transaction
 */
export function useFullPortfolioHistory(
  transactions: Transaction[],
  accounts: Account[],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [fxRates, setFxRates] = useState<FxRateMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Déterminer les dates, les symboles et les devises non-EUR nécessaires
  const { startDate, endDate, symbols, foreignFiats } = useMemo(() => {
    const end = formatLocalDate(new Date());

    // Trouver la première transaction
    const firstTxDate = getFirstTransactionDate(transactions);
    let start: string;

    if (firstTxDate) {
      // Commencer au 1er janvier de l'année de la première transaction
      const firstYear = new Date(firstTxDate).getFullYear();
      start = `${firstYear}-01-01`;
    } else {
      // Fallback: 1er janvier de l'année en cours
      const currentYear = new Date().getFullYear();
      start = `${currentYear}-01-01`;
    }

    const syms = getUniqueSymbolsFromTransactions(transactions);
    const fiats = uniqueForeignFiats(transactions);

    return { startDate: start, endDate: end, symbols: syms, foreignFiats: fiats };
  }, [transactions]);

  const foreignFiatsKey = useMemo(() => [...foreignFiats].sort().join(','), [foreignFiats]);

  // Récupérer les cours historiques et calculer l'historique
  const fetchHistory = useCallback(async () => {
    if (!enabled) return;

    if (transactions.length === 0) {
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let historicalQuotes: Record<string, HistoricalQuote[]> = {};

      const fxPromise = fetchFxRates(foreignFiats, startDate, endDate);

      if (symbols.length > 0) {
        const response = await fetch(
          `/api/stocks/history?symbols=${symbols.join(',')}&startDate=${startDate}&endDate=${endDate}&interval=1d`
        );

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des cours historiques');
        }

        historicalQuotes = await response.json();
      }

      const fetchedFxRates = await fxPromise;

      // Calculer l'historique avec intervalle quotidien pour plus de précision sur les graphiques
      const calculatedHistory = calculatePortfolioHistory(
        transactions,
        accounts,
        historicalQuotes,
        startDate,
        endDate,
        'daily', // Quotidien pour avoir plus de points sur les graphiques
        fetchedFxRates
      );

      setHistory(calculatedHistory);
      setFxRates(fetchedFxRates);
    } catch (err) {
      console.error('Error calculating full portfolio history:', err);
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, transactions, accounts, symbols, startDate, endDate, foreignFiatsKey]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, fxRates, loading, error, refetch: fetchHistory };
}

/**
 * Compte enrichi avec les valeurs calculées
 */
export interface EnrichedAccount extends Account {
  calculatedCash?: number;
  calculatedCashInBase?: number;
  calculatedCashByCurrency?: Record<string, number>;
  calculatedStocksValue?: number;
  calculatedStocksValueInBase?: number;
  calculatedTotalValue: number;
  calculatedTotalValueInBase?: number;
}

function cashMapToObject(cashByCurrency: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    Array.from(cashByCurrency.entries()).sort(([a], [b]) => a.localeCompare(b))
  );
}

function sumCashBuckets(cashByCurrency: Map<string, number>): number {
  return Array.from(cashByCurrency.values()).reduce((sum, value) => sum + value, 0);
}

function sumCashBucketsInBase(
  cashByCurrency: Map<string, number>,
  date: string,
  fxRates: FxRateMap
): number {
  let total = 0;
  cashByCurrency.forEach((amount, currency) => {
    total += convertToBase(amount, currency, date, fxRates);
  });
  return total;
}

/**
 * Hook pour enrichir les comptes avec les valeurs calculées dynamiquement
 * Pour les comptes PEA/CTO, la valeur est recalculée depuis les transactions et cours actuels
 */
export function useAccountsWithCalculatedValues(
  accounts: Account[],
  transactions: Transaction[],
  positions: StockPosition[],
  quotes: Record<string, StockQuote>,
  fxRates: FxRateMap = {}
): EnrichedAccount[] {
  return useMemo(() => {
    const today = formatLocalDate(new Date());

    return accounts.map(account => {
      const cashByCurrency = calculateAccountCashByCurrencyAtDate(
        transactions,
        account.id,
        today
      );
      const calculatedCash = sumCashBuckets(cashByCurrency);
      const calculatedCashInBase = sumCashBucketsInBase(cashByCurrency, today, fxRates);
      const calculatedCashByCurrency = cashMapToObject(cashByCurrency);

      if (accountSupportsPositions(account)) {
        const accountPositions = positions.filter(p => p.account_id === account.id);
        let calculatedStocksValue = 0;
        let calculatedStocksValueInBase = 0;

        for (const position of accountPositions) {
          const quote = quotes[position.symbol];
          const currentPrice = quote?.price ?? position.average_price;
          const positionValue = position.quantity * currentPrice;
          const valueCurrency = (quote?.currency ?? position.currency ?? account.currency ?? 'EUR').toUpperCase();

          calculatedStocksValue += positionValue;
          calculatedStocksValueInBase += convertToBase(positionValue, valueCurrency, today, fxRates);
        }

        return {
          ...account,
          calculatedCash,
          calculatedCashInBase,
          calculatedCashByCurrency,
          calculatedStocksValue,
          calculatedStocksValueInBase,
          calculatedTotalValue: calculatedCash + calculatedStocksValue,
          calculatedTotalValueInBase: calculatedCashInBase + calculatedStocksValueInBase,
        };
      }

      // Pour les autres comptes (épargne), calculer le solde depuis les
      // Crédite la devise du compte si elle est cible d'une CONVERSION.
      return {
        ...account,
        calculatedCash,
        calculatedCashInBase,
        calculatedCashByCurrency,
        calculatedTotalValue: calculatedCash,
        calculatedTotalValueInBase: calculatedCashInBase,
      };
    });
  }, [accounts, transactions, positions, quotes, fxRates]);
}

/**
 * Position enrichie avec les valeurs calculées depuis les transactions
 */
export interface EnrichedPosition extends StockPosition {
  calculatedQuantity: number;
  calculatedAveragePrice: number;
  calculatedTotalInvested: number;
}

/**
 * Hook pour enrichir les positions avec les quantités calculées dynamiquement depuis les transactions
 * La quantité et le PRU sont recalculés depuis les transactions PAR COMPTE
 * Évite le problème d'agrégation multi-comptes pour un même symbole
 */
export function usePositionsWithCalculatedValues(
  positions: StockPosition[],
  transactions: Transaction[]
): EnrichedPosition[] {
  return useMemo(() => {
    const today = formatLocalDate(new Date());

    const calculatedByAccount = calculateAllPositionsAtDate(transactions, today);
    const existingKeys = new Set<string>();

    const enrichedFromStoredPositions = positions.map(position => {
      const key = `${position.account_id}:${position.symbol.toUpperCase()}`;
      existingKeys.add(key);
      const calculated = calculatedByAccount.get(key);

      if (calculated) {
        return {
          ...position,
          calculatedQuantity: calculated.quantity,
          calculatedAveragePrice: calculated.averagePrice,
          calculatedTotalInvested: calculated.totalInvested,
          // Remplacer les valeurs par les valeurs calculées
          quantity: calculated.quantity,
          average_price: calculated.averagePrice,
        };
      }

      // Si pas de transactions trouvées pour ce compte, garder les valeurs stockées
      return {
        ...position,
        calculatedQuantity: position.quantity,
        calculatedAveragePrice: position.average_price,
        calculatedTotalInvested: position.quantity * position.average_price,
      };
    });

    // Ajouter les positions présentes dans les transactions mais absentes de stock_positions.
    const derivedFromTransactions: EnrichedPosition[] = [];
    calculatedByAccount.forEach((calculated, key) => {
      if (existingKeys.has(key) || calculated.quantity <= 0) {
        return;
      }

      derivedFromTransactions.push({
        id: `derived-${calculated.accountId}-${calculated.symbol}`,
        account_id: calculated.accountId,
        symbol: calculated.symbol,
        name: calculated.symbol,
        quantity: calculated.quantity,
        average_price: calculated.averagePrice,
        currency: 'EUR',
        created_at: today,
        updated_at: today,
        calculatedQuantity: calculated.quantity,
        calculatedAveragePrice: calculated.averagePrice,
        calculatedTotalInvested: calculated.totalInvested,
      });
    });

    return [...enrichedFromStoredPositions, ...derivedFromTransactions];
  }, [positions, transactions]);
}
