'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { StockPosition, StockQuote, Transaction } from '@/lib/types';
import { EnrichedAccount } from '@/lib/hooks';
import { accountSupportsPositions, formatCurrency, formatCurrencyBreakdown, formatNumber, formatPercent } from '@/lib/utils';
import { convertToBase, type FxRateMap } from '@/lib/fx';
import { compareTransactionSequence } from '@/lib/transaction-ordering';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Brush } from 'recharts';
import { Wallet, History, ChevronDown, ChevronUp, BarChart2, Loader2, TrendingUp } from 'lucide-react';

// Type pour les positions clôturées (vendues)
interface ClosedPosition {
  key: string;
  symbol: string;
  name: string;
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  realizedGain: number;
  realizedGainInBase: number;
  realizedGainPercent: number;
  lastSellDate: string;
}


interface HistoricalQuotePoint {
  date: string;
  close: number;
  currency?: string;
}

interface PositionChartPoint {
  date: string;
  label: string;
  price: number;
  currency: string;
  markerPrice?: number;
  markerType?: Transaction['type'];
  markerLabel?: string;
}

const DETAIL_PERIODS = [
  { label: '1M', days: 30, interval: '1d' },
  { label: '3M', days: 90, interval: '1d' },
  { label: '6M', days: 180, interval: '1d' },
  { label: '1A', days: 365, interval: '1d' },
  { label: '5A', days: 365 * 5, interval: '1wk' },
  { label: 'Max', days: 365 * 10, interval: '1mo' },
] as const;

function markerGlyph(type?: Transaction['type']) {
  if (type === 'BUY') return '▲';
  if (type === 'SELL') return '▼';
  if (type === 'DIVIDEND') return '◆';
  return '●';
}

function markerColor(type?: Transaction['type']) {
  if (type === 'BUY') return 'var(--gain)';
  if (type === 'SELL') return 'var(--loss)';
  if (type === 'DIVIDEND') return 'var(--chart-3)';
  return 'var(--chart-primary)';
}

function txLabel(type?: Transaction['type']) {
  if (type === 'BUY') return 'Achat';
  if (type === 'SELL') return 'Vente';
  if (type === 'DIVIDEND') return 'Dividende';
  return 'Transaction';
}

function PositionDetailChart({ position, transactions }: { position: StockPosition; transactions: Transaction[] }) {
  const [period, setPeriod] = useState<(typeof DETAIL_PERIODS)[number]>(DETAIL_PERIODS[3]);
  const [history, setHistory] = useState<HistoricalQuotePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positionTransactions = useMemo(() => {
    return transactions
      .filter(t => t.account_id === position.account_id && t.stock_symbol?.toUpperCase() === position.symbol.toUpperCase())
      .filter(t => ['BUY', 'SELL', 'DIVIDEND'].includes(t.type))
      .sort(compareTransactionSequence);
  }, [position.account_id, position.symbol, transactions]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      setLoading(true);
      setError(null);
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - period.days);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);

      try {
        const params = new URLSearchParams({
          symbols: position.symbol,
          startDate,
          endDate,
          interval: period.interval,
        });
        const response = await fetch(`/api/stocks/history?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('history_fetch_failed');
        const payload = await response.json() as Record<string, HistoricalQuotePoint[]>;
        setHistory(payload[position.symbol] ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Impossible de charger le cours historique pour cette position.');
          setHistory([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [period, position.symbol]);

  const chartData = useMemo<PositionChartPoint[]>(() => {
    const txByQuoteDate = new Map<string, Transaction[]>();
    for (const tx of positionTransactions) {
      const quotePoint = history.find(point => point.date >= tx.date) ?? history[history.length - 1];
      if (!quotePoint) continue;
      const list = txByQuoteDate.get(quotePoint.date) ?? [];
      list.push(tx);
      txByQuoteDate.set(quotePoint.date, list);
    }

    return history.map(point => {
      const txs = txByQuoteDate.get(point.date) ?? [];
      const firstTx = txs[0];
      const suffix = txs.length > 1 ? ` +${txs.length - 1}` : '';
      return {
        date: point.date,
        label: new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }),
        price: point.close,
        currency: point.currency ?? position.currency,
        markerPrice: firstTx ? point.close : undefined,
        markerType: firstTx?.type,
        markerLabel: firstTx ? `${txLabel(firstTx.type)}${suffix}` : undefined,
      };
    });
  }, [history, position.currency, positionTransactions]);

  const markerPoints = chartData.filter(point => point.markerPrice != null);

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" /> Détail du cours et transactions
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Déplacez la barre sous le graphique pour zoomer horizontalement. Les marqueurs indiquent achats, ventes et dividendes.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {DETAIL_PERIODS.map(option => (
            <button
              key={option.label}
              type="button"
              onClick={() => setPeriod(option)}
              className={`px-2 py-1 text-xs rounded transition-colors ${period.label === option.label ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement du cours...
        </div>
      ) : error ? (
        <div className="h-40 flex items-center justify-center text-sm text-red-600">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-zinc-500">Aucun historique disponible pour cette période.</div>
      ) : (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--ink-soft)" interval="preserveStartEnd" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} stroke="var(--ink-soft)" width={48} />
              <Tooltip
                formatter={(value, name, props) => {
                  const point = props.payload as PositionChartPoint;
                  if (name === 'markerPrice') return [point.markerLabel, 'Transaction'];
                  return [formatCurrency(Number(value), point.currency), 'Cours'];
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? new Date(payload[0].payload.date).toLocaleDateString('fr-FR') : ''}
                contentStyle={{ backgroundColor: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--ink)' }}
              />
              <Line type="monotone" dataKey="price" stroke="var(--chart-primary)" strokeWidth={2} dot={false} name="Cours" />
              <Scatter
                data={markerPoints}
                dataKey="markerPrice"
                name="Transactions"
                shape={(props: unknown) => {
                  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: PositionChartPoint };
                  if (cx == null || cy == null) return <g />;
                  return <text x={cx} y={cy} dy={4} textAnchor="middle" fontSize={16} fill={markerColor(payload?.markerType)}>{markerGlyph(payload?.markerType)}</text>;
                }}
              />
              <Brush dataKey="label" height={22} stroke="var(--chart-primary)" travellerWidth={8} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span><span style={{ color: 'var(--gain)' }}>▲</span> Achat</span>
        <span><span style={{ color: 'var(--loss)' }}>▼</span> Vente</span>
        <span><span style={{ color: 'var(--chart-3)' }}>◆</span> Dividende</span>
      </div>
    </div>
  );
}

interface PositionsTableProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
  accounts?: EnrichedAccount[];
  transactions?: Transaction[];
  showCash?: boolean;
  showHistory?: boolean;
  groupByAccount?: boolean;
  fxRates?: FxRateMap;
}

export function PositionsTable({
  positions,
  quotes,
  accounts = [],
  transactions = [],
  showCash = true,
  showHistory = true,
  groupByAccount = false,
  fxRates = {},
}: PositionsTableProps) {
  const [showClosedPositions, setShowClosedPositions] = useState(false);
  const [expandedPositionKey, setExpandedPositionKey] = useState<string | null>(null);

  // Comptes du scope pouvant détenir des positions.
  const stockAccounts = useMemo(() => {
    return accounts.filter(accountSupportsPositions);
  }, [accounts]);

  // Calculer le cash disponible sur les comptes PEA/CTO (utiliser calculatedCash si disponible)
  const cashBalance = useMemo(() => {
    return stockAccounts.reduce((sum, a) => sum + (a.calculatedCash ?? 0), 0);
  }, [stockAccounts]);

  const cashByCurrency = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const account of stockAccounts) {
      for (const [currency, amount] of Object.entries(account.calculatedCashByCurrency ?? {})) {
        buckets[currency] = (buckets[currency] ?? 0) + amount;
      }
    }
    return buckets;
  }, [stockAccounts]);

  const cashBalanceLabel = formatCurrencyBreakdown(cashByCurrency);

  const accountById = useMemo(() => {
    const map = new Map<string, EnrichedAccount>();
    accounts.forEach(a => map.set(a.id, a));
    return map;
  }, [accounts]);

  // Cash par compte (si on regroupe par compte) - sinon une seule ligne agrégée.
  const cashAccounts = useMemo(() => {
    return stockAccounts.filter(a => (a.calculatedCash ?? 0) > 0);
  }, [stockAccounts]);

  // Calculer les positions clôturées à partir des transactions
  // Une position fermée = des ventes ont eu lieu, et soit:
  // - Le symbole n'a plus de position ouverte (vendu totalement)
  // - OU il y a eu des cycles d'achat/vente complets dans le passé
  const closedPositions = useMemo(() => {
    // Grouper les transactions par compte+symbole pour ne pas mélanger les positions de comptes différents
    const positionHistory = new Map<string, {
      key: string;
      accountId: string;
      symbol: string;
      name: string;
        closedTrades: Array<{
          buyQty: number;
          buyTotal: number;
          sellQty: number;
          sellTotal: number;
          sellDate: string;
          currency: string;
        }>;
    }>();

    // Trier les transactions par date pour suivre les cycles
    const sortedTransactions = [...transactions]
      .filter(t => t.stock_symbol && ['BUY', 'SELL'].includes(t.type))
      .sort(compareTransactionSequence);

    // Pour chaque (compte, symbole), calculer les positions vendues
    const runningPositions = new Map<string, { qty: number; totalCost: number }>();

    sortedTransactions.forEach(t => {
      const symbol = t.stock_symbol!.toUpperCase();
      const accountId = t.account_id;
      const currency = (t.currency ?? 'EUR').toUpperCase();
      const key = `${accountId}:${symbol}:${currency}`;
      const qty = t.quantity || 0;
      const amount = t.amount || 0;

      if (!positionHistory.has(key)) {
        positionHistory.set(key, { key, accountId, symbol, name: symbol, closedTrades: [] });
      }

      const running = runningPositions.get(key) || { qty: 0, totalCost: 0 };

      if (t.type === 'BUY') {
        running.qty += qty;
        running.totalCost += amount;
        runningPositions.set(key, running);
      } else if (t.type === 'SELL') {
        const avgBuyPrice = running.qty > 0 ? running.totalCost / running.qty : 0;
        const sellQty = Math.min(qty, running.qty);

        if (sellQty > 0) {
          positionHistory.get(key)!.closedTrades.push({
            buyQty: sellQty,
            buyTotal: sellQty * avgBuyPrice,
            sellQty: sellQty,
            sellTotal: amount,
            sellDate: t.date,
            currency,
          });

          running.qty -= sellQty;
          running.totalCost -= sellQty * avgBuyPrice;
          runningPositions.set(key, running);
        }
      }
    });

    const closed: ClosedPosition[] = [];
    positionHistory.forEach((data) => {
      if (data.closedTrades.length > 0) {
        const totalBought = data.closedTrades.reduce((sum, t) => sum + t.buyQty, 0);
        const totalBuyAmount = data.closedTrades.reduce((sum, t) => sum + t.buyTotal, 0);
        const totalSold = data.closedTrades.reduce((sum, t) => sum + t.sellQty, 0);
        const totalSellAmount = data.closedTrades.reduce((sum, t) => sum + t.sellTotal, 0);
        const lastSellDate = data.closedTrades[data.closedTrades.length - 1].sellDate;
        const currency = data.closedTrades[data.closedTrades.length - 1].currency;

        const avgBuyPrice = totalBought > 0 ? totalBuyAmount / totalBought : 0;
        const avgSellPrice = totalSold > 0 ? totalSellAmount / totalSold : 0;
        const realizedGain = totalSellAmount - totalBuyAmount;
        const realizedGainPercent = totalBuyAmount > 0 ? (realizedGain / totalBuyAmount) * 100 : 0;
        // Conversion EUR au taux du jour de chaque vente : permet d'agréger les
        // gains réalisés multi-devises (USD/USDC) en une seule plus-value cohérente.
        const realizedGainInBase = data.closedTrades.reduce((sum, t) => {
          const tradeGain = t.sellTotal - t.buyTotal;
          return sum + convertToBase(tradeGain, t.currency, t.sellDate, fxRates);
        }, 0);

        const account = accountById.get(data.accountId);
        closed.push({
          key: data.key,
          symbol: data.symbol,
          name: data.name,
          accountId: data.accountId,
          accountName: account?.name ?? '—',
          accountType: account?.type ?? '',
          currency,
          totalBought,
          totalSold,
          avgBuyPrice,
          avgSellPrice,
          realizedGain,
          realizedGainInBase,
          realizedGainPercent,
          lastSellDate,
        });
      }
    });

    return closed.sort((a, b) => b.lastSellDate.localeCompare(a.lastSellDate));
  }, [transactions, accountById, fxRates]);

  // Calculer les totaux. On somme en EUR (base) pour rester cohérent quand
  // les positions / cash mélangent plusieurs devises (USD, USDC, …).
  const today = new Date().toISOString().slice(0, 10);
  let totalValue = 0;
  positions.forEach((position) => {
    const quote = quotes[position.symbol];
    const currentPrice = quote?.price ?? position.average_price;
    const valueCurrency = (quote?.currency ?? position.currency ?? 'EUR').toUpperCase();
    totalValue += convertToBase(position.quantity * currentPrice, valueCurrency, today, fxRates);
  });

  // Cash déjà sommé en EUR via stockAccounts.calculatedCashInBase quand dispo.
  const cashBalanceInBase = useMemo(() => {
    return stockAccounts.reduce((sum, a) => sum + (a.calculatedCashInBase ?? a.calculatedCash ?? 0), 0);
  }, [stockAccounts]);
  const totalWithCash = totalValue + (showCash ? cashBalanceInBase : 0);

  // Total des gains réalisés en EUR (chaque trade FX-converti à sa date de vente).
  const totalRealizedGain = closedPositions.reduce((sum, p) => sum + p.realizedGainInBase, 0);

  if (positions.length === 0 && closedPositions.length === 0 && cashBalance === 0) {
    return (
      <div className="text-center py-8 sm:py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <BarChart2 className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
        <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucune position
        </h3>
        <p className="mt-1 sm:mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ajoutez des actions à votre portefeuille
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Cash disponible */}
      {showCash && cashBalance > 0 && (
        groupByAccount && cashAccounts.length > 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {cashAccounts.map((acc) => {
              const accStocksValueInBase = acc.calculatedStocksValueInBase ?? positions
                .filter(p => p.account_id === acc.id)
                .reduce((sum, p) => {
                  const quote = quotes[p.symbol];
                  const quoteCurrency = (quote?.currency ?? p.currency ?? 'EUR').toUpperCase();
                  return sum + convertToBase(p.quantity * (quote?.price ?? p.average_price), quoteCurrency, today, fxRates);
                }, 0);
              const accTotalInBase = acc.calculatedTotalValueInBase
                ?? ((acc.calculatedCashInBase ?? acc.calculatedCash ?? 0) + accStocksValueInBase);
              return (
                <div key={acc.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-2">
                    {acc.name} <span className="text-[10px] opacity-70">({acc.type})</span>
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Liquidités</p>
                        <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrencyBreakdown(acc.calculatedCashByCurrency, acc.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-8 sm:pl-0">
                      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Total compte</p>
                      <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {accStocksValueInBase === 0
                          ? formatCurrencyBreakdown(acc.calculatedCashByCurrency, acc.currency)
                          : formatCurrency(accTotalInBase)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Liquidités</p>
                  <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {cashBalanceLabel}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right pl-8 sm:pl-0">
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Total portefeuille</p>
                <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {totalValue === 0 ? cashBalanceLabel : formatCurrency(totalWithCash)}
                </p>
              </div>
            </div>
          </div>
        )
      )}


      {/* Positions ouvertes */}
      {positions.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-3 sm:px-4 py-2 sm:py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> Positions ouvertes <span className="text-xs sm:text-sm">({positions.length})</span>
            </h3>
            <span className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300">{formatCurrency(totalValue)}</span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {positions.map(position => {
              const quote = quotes[position.symbol];
              const currentPrice = quote?.price ?? position.average_price;
              const valueCurrency = (quote?.currency ?? position.currency ?? 'EUR').toUpperCase();
              const value = position.quantity * currentPrice;
              const invested = position.quantity * position.average_price;
              const gain = value - invested;
              const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
              const account = accountById.get(position.account_id);
              const key = `${position.account_id}:${position.symbol}:${position.currency}`;
              const isExpanded = expandedPositionKey === key;

              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => setExpandedPositionKey(isExpanded ? null : key)}
                    className="w-full p-3 sm:p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {position.symbol}
                          <span className="text-[10px] rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-500">{valueCurrency}</span>
                        </p>
                        <p className="text-xs text-zinc-500 truncate">{position.name || position.symbol}{account ? ` • ${account.name}` : ''}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-400">Quantité</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatNumber(position.quantity, 4)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-400">PRU</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(position.average_price, position.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-400">Cours</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(currentPrice, valueCurrency)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-400">Valeur</p>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(value, valueCurrency)}</p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-left sm:text-right">
                          <p className={`text-sm font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(gain, valueCurrency)}</p>
                          <p className={`text-xs ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPercent(gainPercent)}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                      </div>
                    </div>
                  </button>
                  {isExpanded && <PositionDetailChart position={position} transactions={transactions} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Positions clôturées (historique) */}
      {showHistory && closedPositions.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <button
            onClick={() => setShowClosedPositions(!showClosedPositions)}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Positions clôturées</span>
              <span className="sm:hidden">Clôturées</span>
              <span className="text-xs sm:text-sm">({closedPositions.length})</span>
              <span className={`text-xs sm:text-sm font-normal ${totalRealizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ({formatCurrency(totalRealizedGain)})
              </span>
            </h3>
            {showClosedPositions ? (
              <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
            )}
          </button>
          
          {showClosedPositions && (() => {
            // Construire les groupes pour le rendu
            const groups: Array<{ accountId: string | null; accountName: string; accountType: string; items: ClosedPosition[] }> = [];
            if (groupByAccount) {
              const byAcc = new Map<string, ClosedPosition[]>();
              closedPositions.forEach(p => {
                const arr = byAcc.get(p.accountId) ?? [];
                arr.push(p);
                byAcc.set(p.accountId, arr);
              });
              byAcc.forEach((items, accId) => {
                groups.push({ accountId: accId, accountName: items[0].accountName, accountType: items[0].accountType, items });
              });
            } else {
              groups.push({ accountId: null, accountName: '', accountType: '', items: closedPositions });
            }
            const uniqueAccountIds = new Set(closedPositions.map(p => p.accountId));
            const showAccountCol = !groupByAccount && uniqueAccountIds.size > 1;
            const colSpan = showAccountCol ? 7 : 6;

            return (
              <>
                {/* Version mobile: cartes */}
                <div className="sm:hidden">
                  {groups.map((group) => (
                    <div key={`grp-m-${group.accountId ?? 'all'}`}>
                      {group.accountId && (
                        <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                            {group.accountName} <span className="text-[10px] opacity-70">({group.accountType})</span>
                          </p>
                        </div>
                      )}
                      {group.items.map((pos) => (
                        <div key={pos.key} className="border-b border-zinc-100 dark:border-zinc-800 p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{pos.symbol}</p>
                              <p className="text-xs text-zinc-500">{formatNumber(pos.totalSold, 0)} vendus</p>
                              {showAccountCol && (
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {pos.accountName} <span className="opacity-70">({pos.accountType})</span>
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(pos.realizedGain, pos.currency)}
                              </p>
                              <p className={`text-xs ${pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatPercent(pos.realizedGainPercent)}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>Achat: {formatCurrency(pos.avgBuyPrice, pos.currency)} → Vente: {formatCurrency(pos.avgSellPrice, pos.currency)}</span>
                            <span>{new Date(pos.lastSellDate).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Version desktop: tableau */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                          Action
                        </th>
                        {showAccountCol && (
                          <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                            Compte
                          </th>
                        )}
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Qté vendue
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Prix achat
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Prix vente
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Dernière vente
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          +/- Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <React.Fragment key={`grp-d-${group.accountId ?? 'all'}`}>
                          {group.accountId && (
                            <tr className="bg-zinc-100 dark:bg-zinc-800/70">
                              <td colSpan={colSpan} className="py-2 px-3 sm:px-4">
                                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                  {group.accountName} <span className="text-[10px] opacity-70">({group.accountType})</span>
                                </span>
                              </td>
                            </tr>
                          )}
                          {group.items.map((pos) => (
                            <tr key={pos.key} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 sm:py-3 px-3 sm:px-4">
                                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{pos.symbol}</p>
                              </td>
                              {showAccountCol && (
                                <td className="py-2 sm:py-3 px-3 sm:px-4">
                                  <div className="text-xs">
                                    <p className="font-medium text-zinc-700 dark:text-zinc-300">{pos.accountName}</p>
                                    <p className="text-[10px] text-zinc-500">{pos.accountType}</p>
                                  </div>
                                </td>
                              )}
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-sm text-zinc-900 dark:text-zinc-100">
                                {formatNumber(pos.totalSold, 0)}
                              </td>
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-sm text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(pos.avgBuyPrice, pos.currency)}
                              </td>
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-sm text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(pos.avgSellPrice, pos.currency)}
                              </td>
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                                {new Date(pos.lastSellDate).toLocaleDateString('fr-FR')}
                              </td>
                              <td className={`py-2 sm:py-3 px-3 sm:px-4 text-right font-semibold text-sm ${
                                pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(pos.realizedGain, pos.currency)}
                                <span className="text-xs font-normal ml-1">
                                  ({formatPercent(pos.realizedGainPercent)})
                                </span>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
