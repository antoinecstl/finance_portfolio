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
  calculateAccountTotalValue,
  AccountCalculatedValue,
} from '@/lib/portfolio-calculator';

// Hook pour récupérer les comptes
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, loading, error, refetch: fetchAccounts };
}

// Hook pour récupérer les transactions
export function useTransactions(accountId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
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
      setTransactions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
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

  const fetchPositions = useCallback(async () => {
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
      setPositions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
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
export function useStockQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) {
      setQuotes({});
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/stocks/quotes?symbols=${symbols.join(',')}`);
      
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
  }, [symbols.join(',')]);

  useEffect(() => {
    fetchQuotes();
    
    // Rafraîchir toutes les 60 secondes
    const interval = setInterval(fetchQuotes, 60000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  return { quotes, loading, error, refetch: fetchQuotes };
}

// Hook pour calculer le résumé du portefeuille
export function usePortfolioSummary(positions: StockPosition[], quotes: Record<string, StockQuote>): PortfolioSummary {
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalInvested: 0,
    totalGain: 0,
    totalGainPercent: 0,
    dayChange: 0,
    dayChangePercent: 0,
  });

  useEffect(() => {
    let totalValue = 0;
    let totalInvested = 0;
    let dayChange = 0;

    positions.forEach((position) => {
      const quote = quotes[position.symbol];
      const currentPrice = quote?.price || position.current_price;
      const previousClose = quote?.previousClose || currentPrice;

      const positionValue = position.quantity * currentPrice;
      const positionInvested = position.quantity * position.average_price;

      totalValue += positionValue;
      totalInvested += positionInvested;
      dayChange += position.quantity * (currentPrice - previousClose);
    });

    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const dayChangePercent = (totalValue - dayChange) > 0 
      ? (dayChange / (totalValue - dayChange)) * 100 
      : 0;

    setSummary({
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      dayChange,
      dayChangePercent,
    });
  }, [positions, quotes]);

  return summary;
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
  periodDays: number = 30
) {
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Déterminer les dates et les symboles nécessaires
  const { startDate, endDate, symbols } = useMemo(() => {
    const end = new Date().toISOString().split('T')[0];
    
    // Trouver la première transaction ou utiliser la période demandée
    const firstTxDate = getFirstTransactionDate(transactions);
    let start: string;
    
    if (firstTxDate) {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      const periodStartStr = periodStart.toISOString().split('T')[0];
      
      // Prendre la date la plus récente entre la première transaction et le début de période
      start = firstTxDate > periodStartStr ? firstTxDate : periodStartStr;
    } else {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      start = periodStart.toISOString().split('T')[0];
    }

    const syms = getUniqueSymbolsFromTransactions(transactions);

    return { startDate: start, endDate: end, symbols: syms };
  }, [transactions, periodDays]);

  // Récupérer les cours historiques et calculer l'historique
  const fetchHistory = useCallback(async () => {
    if (transactions.length === 0) {
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let historicalQuotes: Record<string, HistoricalQuote[]> = {};

      if (symbols.length > 0) {
        const response = await fetch(
          `/api/stocks/history?symbols=${symbols.join(',')}&startDate=${startDate}&endDate=${endDate}&interval=1d`
        );

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des cours historiques');
        }

        historicalQuotes = await response.json();
      }

      // Calculer l'historique avec l'intervalle approprié
      const interval = periodDays > 90 ? 'weekly' : 'daily';
      const calculatedHistory = calculatePortfolioHistory(
        transactions,
        accounts,
        historicalQuotes,
        startDate,
        endDate,
        interval
      );

      setHistory(calculatedHistory);
    } catch (err) {
      console.error('Error calculating portfolio history:', err);
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [transactions, accounts, symbols, startDate, endDate, periodDays]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}

/**
 * Compte enrichi avec les valeurs calculées
 */
export interface EnrichedAccount extends Account {
  calculatedCash?: number;
  calculatedStocksValue?: number;
  calculatedTotalValue?: number;
}

/**
 * Hook pour enrichir les comptes avec les valeurs calculées dynamiquement
 * Pour les comptes PEA/CTO, la valeur est recalculée depuis les transactions et cours actuels
 */
export function useAccountsWithCalculatedValues(
  accounts: Account[],
  transactions: Transaction[],
  positions: StockPosition[],
  quotes: Record<string, StockQuote>
): EnrichedAccount[] {
  return useMemo(() => {
    return accounts.map(account => {
      // Pour les comptes actions (PEA, CTO), calculer la valeur dynamiquement
      if (['PEA', 'CTO'].includes(account.type)) {
        const accountPositions = positions.filter(p => p.account_id === account.id);
        const calculated = calculateAccountTotalValue(
          transactions,
          account.id,
          accountPositions,
          quotes
        );

        return {
          ...account,
          calculatedCash: calculated.cash,
          calculatedStocksValue: calculated.stocksValue,
          calculatedTotalValue: calculated.totalValue,
          // Remplacer balance par la valeur calculée
          balance: calculated.totalValue,
        };
      }

      // Pour les autres comptes (épargne), garder le solde stocké
      return {
        ...account,
        calculatedTotalValue: account.balance,
      };
    });
  }, [accounts, transactions, positions, quotes]);
}
