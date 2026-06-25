'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  BarChart,
  Bar,
  ReferenceLine,
  ComposedChart,
  Legend,
  Scatter
} from 'recharts';
import { StockPosition, StockQuote, Transaction, Account } from '@/lib/types';
import { PortfolioHistoryPoint, calculatePortfolioPerformance } from '@/lib/portfolio-calculator';
import { convertToBase, type FxRateMap } from '@/lib/fx';
import { formatCurrency, formatPercent, getSectorColor } from '@/lib/utils';
import { compareTransactionSequence } from '@/lib/transaction-ordering';
import {
  buildPositionDisplayGroups,
  positionDisplaySymbol,
  transactionMatchesPositionDisplayGroup,
} from '@/lib/position-display';
import { PieChart as PieChartIcon, TrendingUp, TrendingDown, Loader2, BarChart2, Target, Scale, Activity, ChevronDown, ChevronRight, ShoppingCart, DollarSign, Banknote, Percent, Wallet, LineChart as LineChartIcon, Lock } from 'lucide-react';
import { useSubscription } from '@/lib/subscription-client';
import { ProBlur } from './ProBlur';
import { buildNiceYAxisScale } from '@/lib/chart-axis';

const MS_PER_DAY = 86_400_000;
const CHART_LEGEND_WRAPPER_STYLE = { fontSize: 12 };
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Détecte un périmètre multi-devise (USDC, USD, etc.). On ne masque plus le
// graphe : on affiche juste un petit indicateur "Valeurs converties en EUR".
function hasMultiCurrency(transactions: Transaction[]): boolean {
  const currencies = new Set<string>();
  for (const tx of transactions) {
    currencies.add((tx.currency ?? 'EUR').toUpperCase());
    if (tx.target_currency) currencies.add(tx.target_currency.toUpperCase());
  }
  return currencies.size > 1;
}

const DEFAULT_YTD_DAYS = (() => {
  const now = new Date();
  return Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / MS_PER_DAY);
})();

function txCurrency(tx: Transaction): string {
  return (tx.currency ?? 'EUR').toUpperCase();
}

function formatTransactionTotals(transactions: Transaction[]): string {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const currency = txCurrency(tx);
    totals.set(currency, (totals.get(currency) ?? 0) + tx.amount);
  }

  const entries = Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return formatCurrency(0);
  return entries.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ');
}

interface AllocationChartProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
  fxRates?: FxRateMap;
}

export function AllocationChart({ positions, quotes, fxRates = {} }: AllocationChartProps) {
  const today = formatLocalDate(new Date());
  // Agréger par symbole (somme entre comptes pour une exposition globale)
  const aggregated = new Map<string, { name: string; fullName: string; value: number }>();
  positions.forEach((position) => {
    const quote = quotes[position.symbol];
    const currentPrice = quote?.price ?? position.average_price;
    const valueCurrency = (quote?.currency ?? position.currency ?? 'EUR').toUpperCase();
    const value = convertToBase(position.quantity * currentPrice, valueCurrency, today, fxRates);
    const displaySymbol = positionDisplaySymbol(position.symbol);
    const existing = aggregated.get(displaySymbol);
    if (existing) {
      existing.value += value;
    } else {
      aggregated.set(displaySymbol, {
        name: displaySymbol,
        fullName: position.name || displaySymbol,
        value,
      });
    }
  });

  const data = Array.from(aggregated.values())
    .map((item, index) => ({ ...item, color: getSectorColor(index) }))
    .sort((a, b) => b.value - a.value);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Répartition du Portefeuille
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <PieChartIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des positions pour voir la répartition
          </p>
        </div>
      </div>
    );
  }

  // Préparer les données pour le BarChart horizontal
  const barData = data.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100,
  }));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
          Répartition du Portefeuille
        </h3>
      </div>
      <div className="space-y-2">
        {barData.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]" title={item.fullName}>
                {item.name}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-zinc-900 dark:text-zinc-100">Total</span>
          <span className="text-zinc-900 dark:text-zinc-100">{formatCurrency(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

export function SectorAllocationChart() {
  // Gardé pour compatibilité mais non utilisé
  return null;
}

// Nouveau composant pour la répartition par compte

interface AccountAllocationChartProps {
  accounts: Array<Account & { calculatedTotalValue: number; calculatedTotalValueInBase?: number }>;
}

export function AccountAllocationChart({ accounts }: AccountAllocationChartProps) {
  // Calculer la répartition par compte
  const data = accounts
    .map((account, index) => {
      const value = account.calculatedTotalValueInBase ?? account.calculatedTotalValue;
      return {
        name: account.name,
        type: account.type,
        value,
        color: getSectorColor(index),
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Répartition par Compte
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <Wallet className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des comptes pour voir la répartition
          </p>
        </div>
      </div>
    );
  }

  // Préparer les données avec pourcentages
  const barData = data.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100,
  }));

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'PEA': 'PEA',
      'CTO': 'CTO',
      'LIVRET_A': 'Livret A',
      'LDDS': 'LDDS',
      'ASSURANCE_VIE': 'Ass. Vie',
      'PEL': 'PEL',
      'AUTRE': 'Autre',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
          Répartition par Compte
        </h3>
      </div>
      <div className="space-y-2">
        {barData.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 flex-shrink-0">
                  {getTypeLabel(item.type)}
                </span>
              </div>
              <span className="text-zinc-600 dark:text-zinc-400 flex-shrink-0 ml-2">
                {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-zinc-900 dark:text-zinc-100">Total</span>
          <span className="text-zinc-900 dark:text-zinc-100">{formatCurrency(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

interface PortfolioHistoryChartProps {
  history: PortfolioHistoryPoint[];
  loading?: boolean;
  onPeriodChange?: (days: number) => void;
  selectedPeriod?: number;
}

export function PortfolioHistoryChart({ 
  history, 
  loading = false,
  onPeriodChange,
  selectedPeriod = 30
}: PortfolioHistoryChartProps) {
  const periods = [
    { label: '1S', days: 7 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: 'YTD', days: DEFAULT_YTD_DAYS },
    { label: '1A', days: 365 },
    { label: 'Max', days: 3650 },
  ];

  const data = history.map((item) => ({
    date: new Date(item.date).toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short',
      year: '2-digit'
    }),
    fullDate: new Date(item.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    totalValue: item.totalValue,
    stocksValue: item.stocksValue,
    savingsValue: item.savingsValue,
  }));

  // Calculer la performance sur la période
  const firstValue = data.length > 0 ? data[0].totalValue : 0;
  const lastValue = data.length > 0 ? data[data.length - 1].totalValue : 0;
  const periodChange = lastValue - firstValue;
  const periodChangePercent = firstValue > 0 ? (periodChange / firstValue) * 100 : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution
          </p>
        </div>
      </div>
    );
  }

  const portfolioYAxis = buildNiceYAxisScale(
    data.flatMap(d => [d.totalValue, d.stocksValue])
  );

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        
        {/* Sélecteur de période */}
        {onPeriodChange && (
          <div className="flex gap-1">
            {periods.map((period) => (
              <button
                key={period.days}
                onClick={() => onPeriodChange(period.days)}
                className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                  selectedPeriod === period.days
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variation de valeur de la période (⚠️ inclut les apports/retraits) */}
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Début: </span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatCurrency(firstValue)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Fin: </span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatCurrency(lastValue)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">Δ Valeur: </span>
          <span className={`font-medium ${periodChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {periodChange >= 0 ? '+' : ''}{formatCurrency(periodChange)} ({formatPercent(periodChangePercent)})
          </span>
          <span className="text-zinc-400 text-[10px] ml-1" title="Cette variation inclut les apports et retraits, ce n'est pas un rendement">ⓘ</span>
        </div>
      </div>

      <div className="h-[220px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorStocks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--gain)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--gain)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={portfolioYAxis.domain}
              ticks={portfolioYAxis.ticks}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k€` : `${value.toFixed(0)}€`}
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              width={45}
            />
            <Tooltip 
              formatter={(value, name) => {
                const label = name === 'Total' ? 'Total' :
                             name === 'Positions' ? 'Positions' : 'Épargne';
                return [formatCurrency(Number(value) || 0), label];
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.fullDate;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                borderRadius: '8px',
                color: 'var(--ink)',
              }}
              labelStyle={{
                color: 'var(--ink)',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            />
            <Legend wrapperStyle={CHART_LEGEND_WRAPPER_STYLE} />
            <Area 
              type="monotone" 
              dataKey="totalValue" 
              stroke="var(--chart-primary)"
              strokeWidth={2}
              fill="url(#colorTotal)"
              name="Total"
              legendType="line"
            />
            <Area 
              type="monotone" 
              dataKey="stocksValue" 
              stroke="var(--gain)"
              strokeWidth={1}
              fill="url(#colorStocks)"
              name="Positions"
              legendType="line"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
// ===== POSITION PERFORMANCE CHART =====
// Graphique complet avec infos détaillées sur chaque position

interface PositionPerformanceChartProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
  transactions?: Transaction[];
  accounts?: Account[];
  groupByAccount?: boolean;
  // Valeurs actuelles du portefeuille (pour cohérence avec les autres composants)
  portfolioTotalValue?: number;
  portfolioTotalInvested?: number;
  portfolioTotalGain?: number;
  portfolioTotalGainPercent?: number;
  portfolioDayChange?: number;
  portfolioDayChangePercent?: number;
  fxRates?: FxRateMap;
}

interface PositionMetrics {
  key: string;
  symbol: string;
  displayLabel: string;
  name: string;
  accountId: string;
  accountName: string;
  accountType: string;
  currentValue: number;
  investedValue: number;
  gainValue: number;
  gainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  nativeCurrentValue: number;
  nativeInvestedValue: number;
  nativeDayChange: number;
  totalReturnValue: number;
  totalReturnPercent: number;
  weight: number;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  costCurrency: string;
  quoteCurrency: string;
  color: string;
  isCrypto: boolean;
}


interface PositionHistoryQuotePoint {
  date: string;
  close: number;
  currency?: string;
}

interface PositionDetailChartPoint {
  date: string;
  label: string;
  price: number;
  currency: string;
  markerPrice?: number;
  markerType?: Transaction['type'];
  markerLabel?: string;
}

const POSITION_DETAIL_PERIODS = [
  { label: '1M', days: 30, interval: '1d' },
  { label: '3M', days: 90, interval: '1d' },
  { label: '6M', days: 180, interval: '1d' },
  { label: '1A', days: 365, interval: '1d' },
  { label: '5A', days: 365 * 5, interval: '1wk' },
] as const;

function positionMarkerGlyph(type?: Transaction['type']) {
  if (type === 'BUY') return '▲';
  if (type === 'SELL') return '▼';
  if (type === 'DIVIDEND') return '◆';
  return '●';
}

function positionMarkerColor(type?: Transaction['type']) {
  if (type === 'BUY') return 'var(--gain)';
  if (type === 'SELL') return 'var(--loss)';
  if (type === 'DIVIDEND') return 'var(--chart-3)';
  return 'var(--chart-primary)';
}

function positionTxLabel(type?: Transaction['type']) {
  if (type === 'BUY') return 'Achat';
  if (type === 'SELL') return 'Vente';
  if (type === 'DIVIDEND') return 'Dividende';
  return 'Transaction';
}

function PositionInlineHistoryChart({
  marketSymbol,
  displaySymbol,
  transactions,
  fallbackCurrency,
}: {
  marketSymbol: string;
  displaySymbol: string;
  transactions: Transaction[];
  fallbackCurrency: string;
}) {
  const [period, setPeriod] = useState<(typeof POSITION_DETAIL_PERIODS)[number]>(POSITION_DETAIL_PERIODS[2]);
  const [history, setHistory] = useState<PositionHistoryQuotePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError(null);
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - period.days);

      try {
        const params = new URLSearchParams({
          symbols: marketSymbol,
          startDate: formatLocalDate(start),
          endDate: formatLocalDate(end),
          interval: period.interval,
        });
        const response = await fetch(`/api/stocks/history?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('history_fetch_failed');
        const payload = await response.json() as Record<string, PositionHistoryQuotePoint[]>;
        setHistory(payload[marketSymbol] ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Cours historique indisponible.');
          setHistory([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [marketSymbol, period]);

  const chartData = useMemo<PositionDetailChartPoint[]>(() => {
    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const txByQuoteDate = new Map<string, Transaction[]>();
    const sortedTransactions = [...transactions]
      .filter(t => ['BUY', 'SELL', 'DIVIDEND'].includes(t.type))
      .sort(compareTransactionSequence);

    for (const tx of sortedTransactions) {
      const quotePoint = sortedHistory.find(point => point.date >= tx.date) ?? sortedHistory[sortedHistory.length - 1];
      if (!quotePoint) continue;
      const list = txByQuoteDate.get(quotePoint.date) ?? [];
      list.push(tx);
      txByQuoteDate.set(quotePoint.date, list);
    }

    return sortedHistory.map(point => {
      const txs = txByQuoteDate.get(point.date) ?? [];
      const firstTx = txs[0];
      const suffix = txs.length > 1 ? ` +${txs.length - 1}` : '';
      return {
        date: point.date,
        label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        price: point.close,
        currency: point.currency ?? fallbackCurrency,
        markerPrice: firstTx ? point.close : undefined,
        markerType: firstTx?.type,
        markerLabel: firstTx ? `${positionTxLabel(firstTx.type)}${suffix}` : undefined,
      };
    });
  }, [fallbackCurrency, history, transactions]);

  const yScale = useMemo(() => {
    const values = chartData.map(point => point.price).filter(Number.isFinite);
    if (values.length === 0) return { domain: ['auto', 'auto'] as [string, string], ticks: undefined as number[] | undefined };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.08, Math.abs(max || min || 1) * 0.01);
    const scale = buildNiceYAxisScale([min - padding, max + padding], { includeZero: false });
    return { domain: scale.domain, ticks: scale.ticks };
  }, [chartData]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-blue-600" />
          <div>
            <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Cours et opérations</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{displaySymbol} · marqueurs alignés sur la cotation disponible</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {POSITION_DETAIL_PERIODS.map(option => (
            <button
              key={option.label}
              type="button"
              onClick={() => setPeriod(option)}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${period.label === option.label ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement du cours...
        </div>
      ) : error ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-red-600">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-zinc-500">Aucun historique disponible.</div>
      ) : (
        <div className="h-[240px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--ink-soft)" interval="preserveStartEnd" />
              <YAxis
                domain={yScale.domain}
                ticks={yScale.ticks}
                tick={{ fontSize: 10 }}
                stroke="var(--ink-soft)"
                width={48}
                tickFormatter={(value) => Number(value).toFixed(0)}
              />
              <Tooltip
                formatter={(value, name, props) => {
                  const point = props.payload as PositionDetailChartPoint;
                  if (name === 'markerPrice') return [point.markerLabel, 'Transaction'];
                  return [formatCurrency(Number(value), point.currency), 'Cours'];
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? new Date(`${payload[0].payload.date}T00:00:00Z`).toLocaleDateString('fr-FR') : ''}
                contentStyle={{ backgroundColor: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: '8px', color: 'var(--ink)' }}
                labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="price" stroke="var(--chart-primary)" strokeWidth={2} dot={false} name="Cours" />
              <Scatter
                dataKey="markerPrice"
                name="Transactions"
                shape={(props: unknown) => {
                  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: PositionDetailChartPoint };
                  if (cx == null || cy == null) return <g />;
                  return <text x={cx} y={cy} dy={4} textAnchor="middle" fontSize={16} fill={positionMarkerColor(payload?.markerType)}>{positionMarkerGlyph(payload?.markerType)}</text>;
                }}
              />
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

export function PositionPerformanceChart({
  positions,
  quotes,
  transactions = [],
  accounts = [],
  groupByAccount = false,
  portfolioTotalValue,
  portfolioTotalInvested,
  portfolioTotalGain,
  portfolioTotalGainPercent,
  portfolioDayChange,
  portfolioDayChangePercent,
  fxRates = {}
}: PositionPerformanceChartProps) {
  // État pour les lignes étendues (clé composite accountId:symbol)
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const { hasFeature } = useSubscription();
  const isProUser = hasFeature('advanced_analytics');

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach(a => map.set(a.id, a));
    return map;
  }, [accounts]);

  // Filtrer les transactions pour une ligne d'affichage.
  // Crypto: toutes les paires d'une meme base (BTC-EUR/BTC-USD) sont incluses.
  const getTransactionsForPosition = (
    metric: Pick<PositionMetrics, 'symbol' | 'accountId' | 'costCurrency' | 'isCrypto'>
  ) => {
    return transactions
      .filter(t =>
        transactionMatchesPositionDisplayGroup(t, metric)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculer les statistiques de transactions pour une ligne d'affichage.
  const getTransactionStats = (
    metric: Pick<PositionMetrics, 'symbol' | 'accountId' | 'costCurrency' | 'isCrypto'>
  ) => {
    const symbolTransactions = getTransactionsForPosition(metric);
    
    const buys = symbolTransactions.filter(t => t.type === 'BUY');
    const sells = symbolTransactions.filter(t => t.type === 'SELL');
    const dividends = symbolTransactions.filter(t => t.type === 'DIVIDEND');
    
    const totalBought = buys.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalSold = sells.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalBuyAmount = buys.reduce((sum, t) => sum + t.amount, 0);
    const totalSellAmount = sells.reduce((sum, t) => sum + t.amount, 0);
    const totalDividends = dividends.reduce((sum, t) => sum + t.amount, 0);
    const totalDividendsInBase = dividends.reduce(
      (sum, t) => sum + convertToBase(t.amount, txCurrency(t), t.date, fxRates),
      0
    );
    
    return {
      buys,
      sells,
      dividends,
      totalBought,
      totalSold,
      totalBuyAmount,
      totalSellAmount,
      totalDividends,
      totalDividendsInBase,
      allTransactions: symbolTransactions
    };
  };

  // Détecter les symboles présents sur plusieurs comptes pour disambiguer le label
  const symbolAccountCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    positions.forEach(p => {
      const symbol = positionDisplaySymbol(p.symbol);
      const set = counts.get(symbol) ?? new Set<string>();
      set.add(p.account_id);
      counts.set(symbol, set);
    });
    return counts;
  }, [positions]);

  // Comptes distincts présents dans le scope actuel
  const uniqueAccountIdsInPositions = useMemo(() => {
    return new Set(positions.map(p => p.account_id));
  }, [positions]);

  const today = formatLocalDate(new Date());

  // Calculer les metriques pour chaque ligne d'affichage.
  // Les cryptos sont consolidees par compte + base de paire.
  const metrics: PositionMetrics[] = buildPositionDisplayGroups(positions, quotes, fxRates, today).map((group, index) => {
    const stats = getTransactionStats(group);
    const totalReturnValue = group.gainValue + stats.totalDividendsInBase;
    const totalReturnPercent = group.investedValue > 0 ? (totalReturnValue / group.investedValue) * 100 : 0;

    const account = accountById.get(group.accountId);
    const accountName = account?.name ?? '—';
    const accountType = account?.type ?? '';
    const isShared = (symbolAccountCounts.get(group.symbol)?.size ?? 0) > 1;
    const displayLabel = isShared && accountType
      ? `${group.symbol} (${accountType})`
      : group.symbol;

    return {
      key: group.key,
      symbol: group.symbol,
      displayLabel,
      name: group.name,
      accountId: group.accountId,
      accountName,
      accountType,
      currentValue: group.currentValue,
      investedValue: group.investedValue,
      gainValue: group.gainValue,
      gainPercent: group.gainPercent,
      dayChange: group.dayChange,
      dayChangePercent: group.dayChangePercent,
      nativeCurrentValue: group.nativeCurrentValue,
      nativeInvestedValue: group.nativeInvestedValue,
      nativeDayChange: group.nativeDayChange,
      totalReturnValue,
      totalReturnPercent,
      weight: 0, // Calculé après
      quantity: group.quantity,
      avgPrice: group.avgPrice,
      currentPrice: group.currentPrice,
      costCurrency: group.costCurrency,
      quoteCurrency: group.quoteCurrency,
      color: getSectorColor(index),
      isCrypto: group.isCrypto,
    };
  });

  // Calculer le poids de chaque position (utiliser props si fournis pour cohérence)
  const calculatedTotalValue = metrics.reduce((sum, m) => sum + m.currentValue, 0);
  const totalValue = portfolioTotalValue ?? calculatedTotalValue;
  metrics.forEach(m => {
    m.weight = totalValue > 0 ? (m.currentValue / totalValue) * 100 : 0;
  });

  // Trier par valeur décroissante
  const sortedByValue = [...metrics].sort((a, b) => b.currentValue - a.currentValue);
  const sortedByPerf = [...metrics].sort((a, b) => b.gainPercent - a.gainPercent);

  // Utiliser les totaux passés en props pour cohérence avec les autres composants
  const calculatedInvested = metrics.reduce((sum, m) => sum + m.investedValue, 0);
  const calculatedGain = metrics.reduce((sum, m) => sum + m.gainValue, 0);
  const calculatedDayChange = metrics.reduce((sum, m) => sum + m.dayChange, 0);
  
  const totalInvested = portfolioTotalInvested ?? calculatedInvested;
  const totalGain = portfolioTotalGain ?? calculatedGain;
  const totalGainPercent = portfolioTotalGainPercent ?? (totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0);
  const totalDayChange = portfolioDayChange ?? calculatedDayChange;
  const calculatedDayChangePreviousValue = totalValue - totalDayChange;
  const totalDayChangePercent = portfolioDayChangePercent ?? (calculatedDayChangePreviousValue > 0
    ? (totalDayChange / calculatedDayChangePreviousValue) * 100
    : 0);
  const totalDayChangeTone = totalDayChange >= 0 ? 'var(--gain)' : 'var(--loss)';
  const totalDayChangeSoftTone = totalDayChange >= 0 ? 'var(--gain-soft)' : 'var(--loss-soft)';

  // Données pour le graphique de performance par position
  const perfChartData = sortedByPerf.map(m => ({
    symbol: m.displayLabel,
    gainPercent: m.gainPercent,
    fill: m.gainPercent >= 0 ? 'var(--gain)' : 'var(--loss)',
  }));

  // Données pour le graphique de répartition par poids
  const weightChartData = sortedByValue.map(m => ({
    symbol: m.displayLabel,
    weight: m.weight,
    value: m.currentValue,
    currency: 'EUR',
    color: m.color,
  }));

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance des Positions
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <Activity className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des positions pour voir les performances
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Résumé global */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Vue d&apos;ensemble des Performances
          </h3>
        </div>
        
        {/* KPIs principaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Valorisation totale</p>
            <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Investi</p>
            <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(totalInvested)}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${totalGain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">+/- Value latente</p>
            <p className={`text-lg sm:text-xl font-bold ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
            </p>
            <p className={`text-xs ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatPercent(totalGainPercent)}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: totalDayChangeSoftTone }}>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Variation du jour</p>
            <p className="text-lg sm:text-xl font-bold" style={{ color: totalDayChangeTone }}>
              {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)}
            </p>
            <p className="text-xs" style={{ color: totalDayChangeTone }}>
              {formatPercent(totalDayChangePercent)}
            </p>
          </div>
        </div>
      </div>

      {/* Graphiques côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Graphique des performances */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
              Performance par Position
            </h3>
          </div>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={perfChartData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                  stroke="var(--ink-soft)"
                />
                <YAxis 
                  type="category" 
                  dataKey="symbol" 
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  stroke="var(--ink-soft)"
                  width={50}
                />
                <ReferenceLine x={0} stroke="var(--ink-soft)" strokeWidth={1} />
                <Tooltip 
                  formatter={(value) => {
                    const numValue = Number(value) || 0;
                    return [`${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`, 'Performance'];
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--paper-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                    color: 'var(--ink)',
                  }}
                  labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                />
                <Bar 
                  dataKey="gainPercent" 
                  fill="var(--gain)"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  {perfChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Répartition du portefeuille */}
        <ProBlur feature="advanced_analytics" label="Répartition du portefeuille — Pro">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
              Répartition du portefeuille
            </h3>
          </div>
          <div className="h-[250px] sm:h-[300px] -mx-1 sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={weightChartData} 
                layout="vertical"
                margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                  stroke="var(--ink-soft)"
                />
                <YAxis 
                  type="category" 
                  dataKey="symbol" 
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  stroke="var(--ink-soft)"
                  width={64}
                />
                <Tooltip 
                  formatter={(value, name, props) => {
                    const numValue = Number(value) || 0;
                    const data = props.payload;
                    return [`${numValue.toFixed(1)}% (${formatCurrency(data.value, data.currency)})`, 'Poids'];
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--paper-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                    color: 'var(--ink)',
                  }}
                  labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                />
                <Bar 
                  dataKey="weight" 
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  {weightChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </ProBlur>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Détail par Position
          </h3>
        </div>

        {/* Version mobile: cartes */}
        <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {(() => {
            const groups: Array<{ accountId: string | null; accountName: string; accountType: string; items: PositionMetrics[] }> = [];
            if (groupByAccount) {
              const byAcc = new Map<string, PositionMetrics[]>();
              sortedByValue.forEach(m => {
                const arr = byAcc.get(m.accountId) ?? [];
                arr.push(m);
                byAcc.set(m.accountId, arr);
              });
              byAcc.forEach((items, accId) => {
                groups.push({ accountId: accId, accountName: items[0].accountName, accountType: items[0].accountType, items });
              });
            } else {
              groups.push({ accountId: null, accountName: '', accountType: '', items: sortedByValue });
            }

            return groups.map((group) => (
              <React.Fragment key={`grp-m-${group.accountId ?? 'all'}`}>
                {group.accountId && (
                  <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                      {group.accountName} <span className="text-[10px] opacity-70">({group.accountType})</span>
                    </p>
                  </div>
                )}
                {group.items.map((m) => {
                  const isExpanded = expandedKey === m.key;
                  const stats = getTransactionStats(m);
                  return (
                    <div key={m.key} className="p-3 space-y-2">
                      <div
                        className="flex justify-between items-start cursor-pointer"
                        onClick={() => setExpandedKey(isExpanded ? null : m.key)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                          )}
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{m.symbol}</p>
                            <p className="text-xs text-zinc-500 truncate max-w-[150px]">{m.name}</p>
                            {!groupByAccount && uniqueAccountIdsInPositions.size > 1 && m.accountName && (
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                {m.accountName} <span className="opacity-70">({m.accountType})</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(m.nativeCurrentValue, m.quoteCurrency)}</p>
                          <p className={`text-xs text-zinc-500 ${isProUser ? '' : 'blur-sm select-none'}`}>{m.weight.toFixed(1)}% du portefeuille</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-500">Qté × PRU</p>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {m.quantity.toFixed(m.quantity % 1 === 0 ? 0 : 2)} × {formatCurrency(m.avgPrice, m.costCurrency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Cours actuel</p>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(m.currentPrice, m.quoteCurrency)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500">Var. jour</p>
                          <p className={`font-medium ${m.dayChangePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatPercent(m.dayChangePercent)}
                          </p>
                          <p className={`text-[10px] ${m.dayChangePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {m.nativeDayChange >= 0 ? '+' : ''}{formatCurrency(m.nativeDayChange, m.quoteCurrency)}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500">+/- Value</span>
                        <span className={`font-semibold ${m.gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.gainValue >= 0 ? '+' : ''}{formatCurrency(m.gainValue)} ({formatPercent(m.gainPercent)})
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-2">
                              <p className="text-emerald-600 dark:text-emerald-400 font-medium">Achats</p>
                              <p className="text-zinc-900 dark:text-zinc-100">{stats.buys.length} ordres • {stats.totalBought.toFixed(2)} titres</p>
                              <p className="text-zinc-600 dark:text-zinc-400">{formatTransactionTotals(stats.buys)}</p>
                            </div>
                            {stats.sells.length > 0 && (
                              <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                                <p className="text-red-600 dark:text-red-400 font-medium">Ventes</p>
                                <p className="text-zinc-900 dark:text-zinc-100">{stats.sells.length} ordres • {stats.totalSold.toFixed(2)} titres</p>
                                <p className="text-zinc-600 dark:text-zinc-400">{formatTransactionTotals(stats.sells)}</p>
                              </div>
                            )}
                            {stats.totalDividends > 0 && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                <p className="text-blue-600 dark:text-blue-400 font-medium">Dividendes</p>
                                <p className="text-zinc-900 dark:text-zinc-100">{stats.dividends.length} versements</p>
                                <p className="text-zinc-600 dark:text-zinc-400">{formatTransactionTotals(stats.dividends)}</p>
                              </div>
                            )}
                          </div>
                          <PositionInlineHistoryChart
                            marketSymbol={stats.allTransactions.find(t => t.stock_symbol)?.stock_symbol?.toUpperCase() ?? m.symbol}
                            displaySymbol={m.displayLabel}
                            transactions={stats.allTransactions}
                            fallbackCurrency={m.quoteCurrency}
                          />
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Historique</p>
                            {stats.allTransactions.slice(0, 10).map((t) => (
                              <div key={t.id} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    t.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    t.type === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    t.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                  }`}>
                                    {t.type === 'BUY' ? 'Achat' : t.type === 'SELL' ? 'Vente' : t.type === 'DIVIDEND' ? 'Div.' : t.type}
                                  </span>
                                  <span className="text-zinc-500">{new Date(t.date).toLocaleDateString('fr-FR')}</span>
                                </div>
                                <div className="text-right">
                                  {t.quantity && t.price_per_unit && (
                                    <span className="text-zinc-600 dark:text-zinc-400 mr-2">{t.quantity} × {formatCurrency(t.price_per_unit, txCurrency(t))}</span>
                                  )}
                                  <span className={`font-medium ${t.type === 'SELL' || t.type === 'DIVIDEND' ? 'text-emerald-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                    {t.type === 'SELL' || t.type === 'DIVIDEND' ? '+' : '-'}{formatCurrency(Math.abs(t.amount), txCurrency(t))}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {stats.allTransactions.length > 10 && (
                              <p className="text-[10px] text-zinc-400 text-center pt-1">
                                +{stats.allTransactions.length - 10} autres transactions
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ));
          })()}
        </div>

        {/* Version desktop: tableau */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="py-2 px-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Action</th>
                {!groupByAccount && uniqueAccountIdsInPositions.size > 1 && (
                  <th className="py-2 px-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Compte</th>
                )}
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Qté</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">PRU</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Cours</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Var. Jour</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Valeur</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">
                  {isProUser ? 'Poids' : <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><Lock className="h-3 w-3" />Poids</span>}
                </th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">+/- Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(() => {
                const showAccountCol = !groupByAccount && uniqueAccountIdsInPositions.size > 1;
                const colSpan = showAccountCol ? 9 : 8;
                const groups: Array<{ accountId: string | null; accountName: string; accountType: string; items: PositionMetrics[] }> = [];
                if (groupByAccount) {
                  const byAcc = new Map<string, PositionMetrics[]>();
                  sortedByValue.forEach(m => {
                    const arr = byAcc.get(m.accountId) ?? [];
                    arr.push(m);
                    byAcc.set(m.accountId, arr);
                  });
                  byAcc.forEach((items, accId) => {
                    groups.push({ accountId: accId, accountName: items[0].accountName, accountType: items[0].accountType, items });
                  });
                } else {
                  groups.push({ accountId: null, accountName: '', accountType: '', items: sortedByValue });
                }

                return groups.map((group) => (
                  <React.Fragment key={`grp-d-${group.accountId ?? 'all'}`}>
                    {group.accountId && (
                      <tr className="bg-zinc-100 dark:bg-zinc-800/70">
                        <td colSpan={colSpan} className="py-2 px-3">
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                            {group.accountName} <span className="text-[10px] opacity-70">({group.accountType})</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {group.items.map((m) => {
                      const isExpanded = expandedKey === m.key;
                      const stats = getTransactionStats(m);
                      return (
                        <React.Fragment key={m.key}>
                          <tr
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                            onClick={() => setExpandedKey(isExpanded ? null : m.key)}
                          >
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                                )}
                                <div>
                                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{m.symbol}</p>
                                  <p className="text-xs text-zinc-500 truncate max-w-[120px]">{m.name}</p>
                                </div>
                              </div>
                            </td>
                            {showAccountCol && (
                              <td className="py-2 px-3">
                                <div className="text-xs">
                                  <p className="font-medium text-zinc-700 dark:text-zinc-300">{m.accountName}</p>
                                  <p className="text-[10px] text-zinc-500">{m.accountType}</p>
                                </div>
                              </td>
                            )}
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {m.quantity.toFixed(m.quantity % 1 === 0 ? 0 : 2)}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(m.avgPrice, m.costCurrency)}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(m.currentPrice, m.quoteCurrency)}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${m.dayChangePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <span className="flex items-center justify-end gap-1">
                          {m.dayChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPercent(m.dayChangePercent)}
                        </span>
                        <p className="text-xs font-normal">
                          {m.nativeDayChange >= 0 ? '+' : ''}{formatCurrency(m.nativeDayChange, m.quoteCurrency)}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(m.nativeCurrentValue, m.quoteCurrency)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className={`flex items-center justify-end gap-2 ${isProUser ? '' : 'blur-sm select-none pointer-events-none'}`} aria-hidden={!isProUser}>
                          <div className="w-12 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${m.weight}%`, backgroundColor: m.color }}
                            />
                          </div>
                          <span className="text-zinc-600 dark:text-zinc-400 w-10 text-right">
                            {m.weight.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${m.gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <p>{m.gainValue >= 0 ? '+' : ''}{formatCurrency(m.gainValue)}</p>
                        <p className="text-xs font-normal">{formatPercent(m.gainPercent)}</p>
                      </td>
                    </tr>
                    
                    {/* Ligne de détail extensible */}
                    {isExpanded && (
                      <tr className="bg-zinc-50/80 dark:bg-zinc-800/30">
                        <td colSpan={colSpan} className="px-4 py-4">
                          <div className="space-y-4">
                            {/* Résumé des transactions */}
                            <div className="grid grid-cols-4 gap-4">
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Achats</span>
                                </div>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.buys.length} ordres</p>
                                <p className="text-sm text-zinc-500">{stats.totalBought.toFixed(2)} titres achetés</p>
                                <p className="text-sm font-medium text-emerald-600">{formatTransactionTotals(stats.buys)}</p>
                              </div>
                              
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <DollarSign className="h-4 w-4 text-red-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Ventes</span>
                                </div>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.sells.length} ordres</p>
                                <p className="text-sm text-zinc-500">{stats.totalSold.toFixed(2)} titres vendus</p>
                                <p className="text-sm font-medium text-red-600">{formatTransactionTotals(stats.sells)}</p>
                              </div>
                              
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Banknote className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Dividendes</span>
                                </div>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.dividends.length} versements</p>
                                <p className="text-sm text-zinc-500">Total perçu</p>
                                <p className="text-sm font-medium text-blue-600">{formatTransactionTotals(stats.dividends)}</p>
                              </div>
                              
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Percent className="h-4 w-4 text-purple-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Rendement Total</span>
                                </div>
                                <p className={`text-lg font-bold ${m.totalReturnValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {m.totalReturnValue >= 0 ? '+' : ''}{formatCurrency(m.totalReturnValue)}
                                </p>
                                <p className="text-sm text-zinc-500">+/- value + dividendes</p>
                                <p className="text-sm font-medium text-purple-600">
                                  {formatPercent(m.totalReturnPercent)}
                                </p>
                              </div>
                            </div>
                            
                            <PositionInlineHistoryChart
                              marketSymbol={stats.allTransactions.find(t => t.stock_symbol)?.stock_symbol?.toUpperCase() ?? m.symbol}
                              displaySymbol={m.displayLabel}
                              transactions={stats.allTransactions}
                              fallbackCurrency={m.quoteCurrency}
                            />

                            {/* Tableau des transactions */}
                            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                              <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                  Historique des transactions ({stats.allTransactions.length})
                                </h4>
                              </div>
                              <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                    <tr>
                                      <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500">Date</th>
                                      <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500">Type</th>
                                      <th className="py-2 px-3 text-right text-xs font-medium text-zinc-500">Quantité</th>
                                      <th className="py-2 px-3 text-right text-xs font-medium text-zinc-500">Prix unitaire</th>
                                      <th className="py-2 px-3 text-right text-xs font-medium text-zinc-500">Montant</th>
                                      <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {stats.allTransactions.map((t) => (
                                      <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                                          {new Date(t.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                            t.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            t.type === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            t.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                          }`}>
                                            {t.type === 'BUY' && <ShoppingCart className="h-3 w-3" />}
                                            {t.type === 'SELL' && <DollarSign className="h-3 w-3" />}
                                            {t.type === 'DIVIDEND' && <Banknote className="h-3 w-3" />}
                                            {t.type === 'BUY' ? 'Achat' : t.type === 'SELL' ? 'Vente' : t.type === 'DIVIDEND' ? 'Dividende' : t.type}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                                          {t.quantity ? t.quantity.toFixed(t.quantity % 1 === 0 ? 0 : 4) : '-'}
                                        </td>
                                        <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                                          {t.price_per_unit ? formatCurrency(t.price_per_unit, txCurrency(t)) : '-'}
                                        </td>
                                        <td className={`py-2 px-3 text-right font-medium ${
                                          t.type === 'SELL' || t.type === 'DIVIDEND' ? 'text-emerald-600' : 'text-zinc-900 dark:text-zinc-100'
                                        }`}>
                                          {t.type === 'SELL' || t.type === 'DIVIDEND' ? '+' : '-'}{formatCurrency(Math.abs(t.amount), txCurrency(t))}
                                        </td>
                                        <td className="py-2 px-3 text-zinc-500 truncate max-w-[200px]">
                                          {t.description || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {stats.allTransactions.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="py-8 text-center text-zinc-500">
                                          Aucune transaction pour cette action
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== PORTFOLIO VALUE VS INVESTED CHART =====
// Graphique comparant la valeur actuelle et la valeur investie dans le temps

type PeriodOption = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'MAX';

interface PortfolioValueChartProps {
  history: PortfolioHistoryPoint[];
  transactions: Transaction[];
  loading?: boolean;
  // Valeurs actuelles du portefeuille (pour cohérence avec les autres composants)
  currentTotalValue?: number;
  currentTotalInvested?: number;
  fxRates?: FxRateMap;
}

export function PortfolioValueChart({ 
  history, 
  transactions, 
  loading = false,
  currentTotalValue,
  currentTotalInvested,
  fxRates = {},
}: PortfolioValueChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('YTD');
  const isMultiCurrency = useMemo(
    () => hasMultiCurrency(transactions),
    [transactions]
  );

  // Filtrer l'historique selon la période sélectionnée
  const filteredHistory = useMemo(() => {
    if (history.length === 0 || selectedPeriod === 'MAX') return history;
    
    const now = new Date();
    let startDate: Date;
    
    switch (selectedPeriod) {
      case '1W':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3M':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6M':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '1Y':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        return history;
    }
    
    return history.filter(point => new Date(point.date) >= startDate);
  }, [history, selectedPeriod]);

  // Calculer le coût d'acquisition cumulé (PRU * quantité) à chaque date
  const chartData = useMemo(() => {
    if (filteredHistory.length === 0) return [];

    // Trier les transactions BUY/SELL selon le même ordre de replay que les positions.
    const sortedTx = [...transactions]
      .filter(t => ['BUY', 'SELL'].includes(t.type) && t.stock_symbol)
      .sort(compareTransactionSequence);

    // Calculer le coût d'acquisition par symbole à chaque date
    // Le coût d'acquisition = somme des (quantité achetée * prix d'achat) - somme des (quantité vendue * prix d'achat moyen)
    const costBasisBySymbol = new Map<string, { totalCost: number; totalQuantity: number }>();
    const costBasisHistoryByDate = new Map<string, number>();
    
    sortedTx.forEach(tx => {
      const symbol = `${tx.account_id}:${tx.stock_symbol!.toUpperCase()}`;
      const current = costBasisBySymbol.get(symbol) || { totalCost: 0, totalQuantity: 0 };
      
      if (tx.type === 'BUY' && tx.quantity && tx.price_per_unit) {
        // Achat: ajouter au coût total et à la quantité
        const nativeCost = tx.quantity * tx.price_per_unit;
        current.totalCost += convertToBase(nativeCost, tx.currency ?? 'EUR', tx.date, fxRates);
        current.totalQuantity += tx.quantity;
      } else if (tx.type === 'SELL' && tx.quantity && current.totalQuantity > 0) {
        // Vente: retirer proportionnellement au PRU
        const avgCost = current.totalCost / current.totalQuantity;
        const soldCost = tx.quantity * avgCost;
        current.totalCost -= soldCost;
        current.totalQuantity -= tx.quantity;
        
        // S'assurer qu'on ne passe pas en négatif
        if (current.totalQuantity <= 0) {
          current.totalCost = 0;
          current.totalQuantity = 0;
        }
      }
      
      costBasisBySymbol.set(symbol, current);
      
      // Calculer le total du coût d'acquisition à cette date
      let totalCostBasis = 0;
      costBasisBySymbol.forEach(data => {
        totalCostBasis += data.totalCost;
      });
      
      costBasisHistoryByDate.set(tx.date, totalCostBasis);
    });

    // Pour chaque point d'historique, trouver le coût d'acquisition correspondant
    let currentCostBasis = 0;
    const data = filteredHistory.map((point, index) => {
      // Trouver le dernier coût d'acquisition <= à cette date
      for (const [date, cost] of costBasisHistoryByDate) {
        if (date <= point.date) {
          currentCostBasis = cost;
        }
      }

      // Utiliser uniquement la valeur des actions (sans cash) pour rester cohérent
      // avec la courbe d'investissement basée sur le coût des positions ouvertes.
      const actionsValueAtDate = point.positions.reduce((sum, position) => sum + position.value, 0);

      // Pour le dernier point, utiliser les valeurs passées en props (cohérence temps réel)
      // Ces props viennent du même résumé que la vue d'ensemble des performances.
      const isLastPoint = index === filteredHistory.length - 1;
      const valeurActuelle =
        isLastPoint && currentTotalValue !== undefined
          ? currentTotalValue
          : actionsValueAtDate;
      const investissement =
        isLastPoint && currentTotalInvested !== undefined
          ? currentTotalInvested
          : currentCostBasis;
      
      const gain = valeurActuelle - investissement;
      const gainPercent = investissement > 0 ? (gain / investissement) * 100 : 0;

      return {
        date: new Date(point.date).toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: 'short',
          year: '2-digit'
        }),
        fullDate: new Date(point.date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        valeurActuelle,
        investissement,
        plusValue: gain,
        gainPercent,
      };
    });
    
    return data;
  }, [filteredHistory, transactions, currentTotalValue, currentTotalInvested, fxRates]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const last = chartData[chartData.length - 1];
    const first = chartData[0];
    return {
      currentValue: last.valeurActuelle,
      invested: last.investissement,
      gain: last.plusValue,
      gainPercent: last.gainPercent,
      startValue: first.valeurActuelle,
      startInvested: first.investissement,
    };
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution Valeur vs Investissement
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution Valeur vs Investissement
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution
          </p>
        </div>
      </div>
    );
  }

  const positionYAxis = buildNiceYAxisScale(
    chartData.flatMap(d => [d.valeurActuelle, d.investissement])
  );

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Valeur du Portefeuille vs Investissement
          </h3>
          {isMultiCurrency && (
            <span
              className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              title="Les valeurs natives USD/USDC sont converties en EUR pour rester comparables a la performance annuelle."
            >
              EUR
            </span>
          )}
        </div>
        {/* Sélecteur de période */}
        <div className="flex w-full flex-wrap gap-1 sm:w-auto sm:flex-nowrap">
          {(['1W', '1M', '3M', '6M', 'YTD', '1Y', 'MAX'] as PeriodOption[]).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                selectedPeriod === period
                  ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {period === '1W' ? '1S' : period === '1Y' ? '1A' : period === 'MAX' ? 'Max' : period}
            </button>
          ))}
        </div>
      </div>

      {/* Statistiques actuelles */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Valeur actuelle</p>
            <p className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(stats.currentValue)}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-2 sm:p-3">
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">Investi</p>
            <p className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(stats.invested)}
            </p>
          </div>
          <div className={`rounded-lg p-2 sm:p-3 ${stats.gain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className={`text-[10px] sm:text-xs font-medium ${stats.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              +/- Value latente
            </p>
            <p className={`text-sm sm:text-lg font-bold ${stats.gain >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
              {stats.gain >= 0 ? '+' : ''}{formatCurrency(stats.gain)}
            </p>
            <p className={`text-[10px] sm:text-xs ${stats.gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatPercent(stats.gainPercent)}
            </p>
          </div>
        </div>
      )}

      {/* Graphique */}
      <div className="h-[220px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValeur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--gain)" stopOpacity={0.24}/>
                <stop offset="95%" stopColor="var(--gain)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorInvesti" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.12}/>
                <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value).replace('€', '').trim()}
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              width={60}
              domain={positionYAxis.domain}
              ticks={positionYAxis.ticks}
            />
            <Tooltip 
              formatter={(value, name) => {
                const numValue = Number(value) || 0;
                const label = name === 'Valeur actuelle' ? 'Valeur actuelle' : 'Montant investi';
                return [formatCurrency(numValue), label];
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  const data = payload[0].payload;
                  return `${data.fullDate}\n+/- Value latente: ${data.plusValue >= 0 ? '+' : ''}${formatCurrency(data.plusValue)} (${formatPercent(data.gainPercent)})`;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                borderRadius: '8px',
                color: 'var(--ink)',
                whiteSpace: 'pre-line',
              }}
            />
            <Legend wrapperStyle={CHART_LEGEND_WRAPPER_STYLE} />
            {/* Zone entre les deux courbes pour visualiser le gain/perte */}
            <Area 
              type="monotone" 
              dataKey="investissement" 
              stroke="var(--chart-primary)"
              strokeWidth={2}
              fill="url(#colorInvesti)"
              strokeDasharray="5 5"
              name="Montant investi"
              legendType="line"
            />
            <Area 
              type="monotone" 
              dataKey="valeurActuelle" 
              stroke="var(--gain)"
              strokeWidth={2.5}
              fill="url(#colorValeur)"
              name="Valeur actuelle"
              legendType="line"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ===== STOCK HISTORY CHART =====
// Graphique d'évolution des cours des actions individuelles

interface StockHistoryChartProps {
  history: PortfolioHistoryPoint[];
  loading?: boolean;
  onPeriodChange?: (days: number) => void;
  selectedPeriod?: number;
}

// Couleurs pour les différentes actions
const STOCK_COLORS = [
  'var(--chart-primary)', // ink
  'var(--gain)', // emerald
  'var(--chart-3)', // saffron
  'var(--loss)', // red
  'var(--chart-5)', // plum
  'var(--chart-7)', // rose
  'var(--chart-6)', // teal
  'var(--chart-8)', // olive
  'var(--chart-9)', // burnt orange
  'var(--chart-10)', // deep indigo
];

const TOTAL_COLOR = 'var(--chart-secondary)'; // Couleur pour le total

export function StockHistoryChart({ 
  history, 
  loading = false,
  onPeriodChange,
  selectedPeriod = 30
}: StockHistoryChartProps) {
  const periods = [
    { label: '1S', days: 7 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: 'YTD', days: DEFAULT_YTD_DAYS },
    { label: '1A', days: 365 },
    { label: 'Max', days: 3650 },
  ];

  // Extraire tous les symboles uniques depuis l'historique
  const symbols = useMemo(() => {
    const symbolSet = new Set<string>();
    history.forEach(point => {
      point.positions.forEach(pos => symbolSet.add(pos.symbol));
    });
    return Array.from(symbolSet);
  }, [history]);

  // État pour les symboles sélectionnés (tous sélectionnés par défaut + Total)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set(['__TOTAL__']));
  
  // Mettre à jour les symboles sélectionnés quand les symboles changent
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSelectedSymbols(prev => {
      const newSet = new Set(prev);
      // Ajouter les nouveaux symboles
      symbols.forEach(s => {
        if (!prev.has(s) && (prev.size === 0 || (prev.size === 1 && prev.has('__TOTAL__')))) {
          newSet.add(s);
        }
      });
      // Garder __TOTAL__ si c'était sélectionné
      if (prev.has('__TOTAL__')) {
        newSet.add('__TOTAL__');
      }
      return newSet;
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [symbols]);

  // Toggle un symbole
  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  // Sélectionner uniquement un symbole (isoler)
  const isolateSymbol = (symbol: string) => {
    setSelectedSymbols(new Set([symbol]));
  };

  // Tout sélectionner / Tout désélectionner
  const toggleAll = () => {
    if (selectedSymbols.size === symbols.length + 1) {
      setSelectedSymbols(new Set());
    } else {
      setSelectedSymbols(new Set(['__TOTAL__', ...symbols]));
    }
  };

  // Trouver le prix de base = premier prix où l'action EST DÉTENUE (quantity > 0)
  const basePrices = useMemo(() => {
    const bases: Record<string, number> = {};
    
    if (history.length === 0) return bases;
    
    symbols.forEach(symbol => {
      // Chercher le premier point où l'action est réellement détenue
      for (const point of history) {
        const position = point.positions.find(p => p.symbol === symbol);
        // L'action doit avoir une quantité > 0 ET un prix > 0
        if (position && position.quantity > 0 && position.price > 0) {
          bases[symbol] = position.price;
          break;
        }
      }
    });
    
    return bases;
  }, [history, symbols]);

  // Valeur totale de base pour le portefeuille (premier point avec une valeur > 0)
  const baseTotalValue = useMemo(() => {
    if (history.length === 0) return 0;
    // Trouver le premier point où stocksValue > 0
    for (const point of history) {
      if (point.stocksValue > 0) {
        return point.stocksValue;
      }
    }
    return 0;
  }, [history]);

  // Transformer les données pour le graphique
  const chartData = useMemo(() => {
    return history.map((point) => {
      const dataPoint: Record<string, number | string> = {
        date: new Date(point.date).toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: 'short',
          year: '2-digit'
        }),
        fullDate: new Date(point.date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
      };
      
      // Calculer la variation en % pour chaque position (seulement si détenue)
      symbols.forEach(symbol => {
        const basePrice = basePrices[symbol];
        const pos = point.positions.find(p => p.symbol === symbol);
        
        // Afficher seulement si l'action est détenue (quantity > 0)
        if (pos && pos.quantity > 0 && basePrice && basePrice > 0 && pos.price > 0) {
          const variation = ((pos.price - basePrice) / basePrice) * 100;
          dataPoint[symbol] = variation;
          // Stocker les infos supplémentaires pour le tooltip
          dataPoint[`${symbol}_gain`] = (pos.price - basePrice) * pos.quantity; // Gain/perte en €
          dataPoint[`${symbol}_basePrice`] = basePrice;
          dataPoint[`${symbol}_currentPrice`] = pos.price;
          dataPoint[`${symbol}_quantity`] = pos.quantity;
        }
        // Si pas détenue, on ne met pas de valeur = ligne interrompue
      });
      
      // Calculer la variation du portefeuille total (basé sur stocksValue)
      if (baseTotalValue > 0 && point.stocksValue > 0) {
        const totalVariation = ((point.stocksValue - baseTotalValue) / baseTotalValue) * 100;
        dataPoint['__TOTAL__'] = totalVariation;
        // Stocker le gain/perte total en €
        dataPoint['__TOTAL___gain'] = point.stocksValue - baseTotalValue;
        dataPoint['__TOTAL___baseValue'] = baseTotalValue;
        dataPoint['__TOTAL___currentValue'] = point.stocksValue;
      } else if (baseTotalValue > 0) {
        // Afficher 0% si pas encore de stocks mais base existe
        dataPoint['__TOTAL__'] = 0;
        dataPoint['__TOTAL___gain'] = 0;
      }
      
      return dataPoint;
    });
  }, [history, symbols, basePrices, baseTotalValue]);

  // Calculer la performance de chaque action sur la période
  const stockPerformance = useMemo(() => {
    if (history.length < 2) return {};
    
    const perf: Record<string, { startPrice: number; endPrice: number; changePercent: number }> = {};
    
    symbols.forEach(symbol => {
      const basePrice = basePrices[symbol];
      if (!basePrice) return;
      
      let endPrice = basePrice;
      for (let i = history.length - 1; i >= 0; i--) {
        const pos = history[i].positions.find(p => p.symbol === symbol);
        if (pos && pos.price > 0) {
          endPrice = pos.price;
          break;
        }
      }
      
      const changePercent = ((endPrice - basePrice) / basePrice) * 100;
      perf[symbol] = { startPrice: basePrice, endPrice, changePercent };
    });

    // Performance du total
    if (baseTotalValue > 0 && history.length > 0) {
      const endTotalValue = history[history.length - 1].stocksValue;
      const totalChangePercent = ((endTotalValue - baseTotalValue) / baseTotalValue) * 100;
      perf['__TOTAL__'] = { startPrice: baseTotalValue, endPrice: endTotalValue, changePercent: totalChangePercent };
    }
    
    return perf;
  }, [history, symbols, basePrices, baseTotalValue]);

  // Calculer min/max pour l'axe Y (seulement pour les symboles sélectionnés)
  const yDomain = useMemo(() => {
    let min = 0;
    let max = 0;
    
    const allKeys = ['__TOTAL__', ...symbols];
    
    chartData.forEach(point => {
      allKeys.forEach(key => {
        if (selectedSymbols.has(key)) {
          const value = point[key] as number;
          if (typeof value === 'number') {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      });
    });
    
    return buildNiceYAxisScale([min, max], { includeZero: true }).domain;
  }, [chartData, symbols, selectedSymbols]);

  const performanceYTicks = useMemo(() => {
    let min = 0;
    let max = 0;
    const allKeys = ['__TOTAL__', ...symbols];

    chartData.forEach(point => {
      allKeys.forEach(key => {
        if (selectedSymbols.has(key)) {
          const value = point[key] as number;
          if (typeof value === 'number') {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      });
    });

    return buildNiceYAxisScale([min, max], { includeZero: true }).ticks;
  }, [chartData, symbols, selectedSymbols]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution des Actions
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (symbols.length === 0 || history.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution des Actions
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution de vos actions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Variation des Actions (%)
          </h3>
        </div>
        
        {/* Sélecteur de période */}
        {onPeriodChange && (
          <div className="flex gap-1">
            {periods.map((period) => (
              <button
                key={period.days}
                onClick={() => onPeriodChange(period.days)}
                className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                  selectedPeriod === period.days
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sélecteur d'actions */}
      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={toggleAll}
          className="px-2 py-1 text-[10px] sm:text-xs rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {selectedSymbols.size === symbols.length + 1 ? 'Tout masquer' : 'Tout afficher'}
        </button>
        
        {/* Bouton Total Portefeuille */}
        <button
          onClick={() => toggleSymbol('__TOTAL__')}
          onDoubleClick={() => isolateSymbol('__TOTAL__')}
          className={`px-2 py-1 text-[10px] sm:text-xs rounded flex items-center gap-1 transition-all ${
            selectedSymbols.has('__TOTAL__')
              ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-500'
              : 'opacity-40'
          }`}
          style={{ 
            backgroundColor: selectedSymbols.has('__TOTAL__') ? TOTAL_COLOR : 'var(--rule)',
            color: selectedSymbols.has('__TOTAL__') ? 'white' : 'var(--ink-soft)'
          }}
          title="Clic: afficher/masquer • Double-clic: isoler"
        >
          <span className="font-semibold">TOTAL</span>
          {stockPerformance['__TOTAL__'] && (
            <span className={stockPerformance['__TOTAL__'].changePercent >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {stockPerformance['__TOTAL__'].changePercent >= 0 ? '+' : ''}
              {stockPerformance['__TOTAL__'].changePercent.toFixed(1)}%
            </span>
          )}
        </button>

        {/* Boutons par action */}
        {symbols.map((symbol, index) => {
          const perf = stockPerformance[symbol];
          const isSelected = selectedSymbols.has(symbol);
          const color = STOCK_COLORS[index % STOCK_COLORS.length];
          
          return (
            <button
              key={symbol}
              onClick={() => toggleSymbol(symbol)}
              onDoubleClick={() => isolateSymbol(symbol)}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded flex items-center gap-1 transition-all ${
                isSelected
                  ? 'ring-2 ring-offset-1'
                  : 'opacity-40'
              }`}
              style={{ 
                backgroundColor: isSelected ? color : 'var(--rule)',
                color: isSelected ? 'white' : 'var(--ink-soft)',
                '--tw-ring-color': color
              } as React.CSSProperties & { '--tw-ring-color': string }}
              title="Clic: afficher/masquer • Double-clic: isoler"
            >
              <span className="font-medium">{symbol}</span>
              {perf && (
                <span className={perf.changePercent >= 0 ? 'text-emerald-200' : 'text-red-200'}>
                  {perf.changePercent >= 0 ? '+' : ''}{perf.changePercent.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Graphique principal */}
      <div className="h-[280px] sm:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={yDomain}
              ticks={performanceYTicks}
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(value % 1 === 0 ? 0 : 1)}%`}
              tick={{ fontSize: 10 }}
              stroke="var(--ink-soft)"
              width={50}
            />
            <ReferenceLine y={0} stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="3 3" />
            <Tooltip 
              formatter={(value, name, props) => {
                const numValue = Number(value) || 0;
                const displayName = name === '__TOTAL__' ? 'Portefeuille Total' : name;
                const payload = props.payload;
                
                // Récupérer le gain/perte en €
                const gainKey = name === '__TOTAL__' ? '__TOTAL___gain' : `${name}_gain`;
                const gain = payload[gainKey] as number | undefined;
                
                let details = `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
                
                if (gain !== undefined) {
                  details += ` (${gain >= 0 ? '+' : ''}${gain.toFixed(2)} €)`;
                }
                
                // Ajouter les détails du prix pour les actions individuelles
                if (name !== '__TOTAL__') {
                  const basePrice = payload[`${name}_basePrice`] as number | undefined;
                  const currentPrice = payload[`${name}_currentPrice`] as number | undefined;
                  const quantity = payload[`${name}_quantity`] as number | undefined;
                  
                  if (basePrice && currentPrice && quantity) {
                    details += `\n${quantity} × ${currentPrice.toFixed(2)}€ (base: ${basePrice.toFixed(2)}€)`;
                  }
                } else {
                  // Détails pour le total
                  const baseValue = payload['__TOTAL___baseValue'] as number | undefined;
                  const currentValue = payload['__TOTAL___currentValue'] as number | undefined;
                  
                  if (baseValue && currentValue) {
                    details += `\n${currentValue.toFixed(2)}€ (base: ${baseValue.toFixed(2)}€)`;
                  }
                }
                
                return [details, displayName];
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.fullDate;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'var(--paper-2)',
                border: '1px solid var(--rule)',
                borderRadius: '8px',
                color: 'var(--ink)',
                whiteSpace: 'pre-line',
              }}
              labelStyle={{
                color: 'var(--ink)',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            />
            
            {/* Courbe Total Portefeuille - plus visible */}
            {selectedSymbols.has('__TOTAL__') && (
              <Line 
                type="monotone" 
                dataKey="__TOTAL__" 
                stroke={TOTAL_COLOR}
                strokeWidth={3}
                dot={false}
                name="__TOTAL__"
                connectNulls={false}
              />
            )}
            
            {/* Courbes par action */}
            {symbols.map((symbol, index) => (
              selectedSymbols.has(symbol) && (
                <Line 
                  key={symbol}
                  type="monotone" 
                  dataKey={symbol} 
                  stroke={STOCK_COLORS[index % STOCK_COLORS.length]} 
                  strokeWidth={2}
                  dot={false}
                  name={symbol}
                  connectNulls={false}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Légende informative */}
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500">
          💡 Cliquez sur une action pour l&apos;afficher/masquer • Double-cliquez pour l&apos;isoler
        </p>
      </div>
    </div>
  );
}

// ===== PORTFOLIO REAL PERFORMANCE CHART =====
// Graphique de la performance réelle du portefeuille (hors apports)

interface PortfolioPerformanceChartProps {
  transactions: Transaction[];
  portfolioHistory: PortfolioHistoryPoint[];
  accounts: Account[];
  loading?: boolean;
  currentPortfolioValue?: number; // Valeur actuelle en temps réel
  fxRates?: FxRateMap;
}

export function PortfolioPerformanceChart({
  transactions,
  portfolioHistory,
  accounts,
  loading = false,
  currentPortfolioValue,
  fxRates = {},
}: PortfolioPerformanceChartProps) {
  // État pour afficher/masquer les années précédentes
  const [showAllYears, setShowAllYears] = useState(false);
  const isMultiCurrency = useMemo(
    () => hasMultiCurrency(transactions),
    [transactions]
  );

  // Calculer la performance. En multi-devise, on n'écrase PAS le dernier point
  // par `currentPortfolioValue` : cette valeur vient d'une sommation naïve EUR
  // + USDC dans Dashboard (pas FX-aware), alors que le dernier point historique
  // est déjà converti en EUR au taux du jour. L'override ferait perdre la
  // conversion et générerait un faux gain.
  const performance = useMemo(() => {
    const skipOverride = isMultiCurrency || currentPortfolioValue === undefined;
    if (skipOverride || portfolioHistory.length === 0) {
      return calculatePortfolioPerformance(transactions, portfolioHistory, accounts, fxRates);
    }

    const today = formatLocalDate(new Date());
    const lastPoint = portfolioHistory[portfolioHistory.length - 1];
    const updatedLastPoint = {
      ...lastPoint,
      date: lastPoint.date < today ? today : lastPoint.date,
      stocksValue: currentPortfolioValue,
      totalValue: lastPoint.totalValue + (currentPortfolioValue - lastPoint.stocksValue),
    };

    const historyWithCurrentValue = lastPoint.date < today
      ? [...portfolioHistory, updatedLastPoint]
      : portfolioHistory.map((point, index) =>
          index === portfolioHistory.length - 1 ? updatedLastPoint : point
        );

    return calculatePortfolioPerformance(transactions, historyWithCurrentValue, accounts, fxRates);
  }, [transactions, portfolioHistory, accounts, currentPortfolioValue, fxRates, isMultiCurrency]);

  // Trier les années de la plus récente à la plus ancienne
  const sortedYears = useMemo(() => {
    return [...performance.yearlyPerformance].sort((a, b) => b.year - a.year);
  }, [performance.yearlyPerformance]);

  // Années à afficher dans le tableau (2 dernières ou toutes)
  const displayedYears = useMemo(() => {
    if (showAllYears || sortedYears.length <= 2) {
      return sortedYears;
    }
    return sortedYears.slice(0, 2); // Année en cours + année précédente
  }, [sortedYears, showAllYears]);

  // Données pour le graphique bar (5 dernières années max)
  const yearlyChartData = useMemo(() => {
    const recentYears = [...performance.yearlyPerformance]
      .sort((a, b) => b.year - a.year)
      .slice(0, 5)
      .reverse();
    return recentYears.map(y => ({
      year: y.year.toString(),
      performance: y.gainLossPercent,
      totalReturn: y.totalReturnPercent,
      gainLoss: y.gainLoss,
      dividends: y.dividends,
    }));
  }, [performance.yearlyPerformance]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance Annuelle
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Calcul en cours...</span>
        </div>
      </div>
    );
  }

  if (portfolioHistory.length === 0 || performance.yearlyPerformance.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance Annuelle
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir votre performance
          </p>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const currentYearPerformance = performance.currentYearPerformance;
  const currentYearIsPositive = currentYearPerformance ? currentYearPerformance.gainLossPercent >= 0 : true;
  const currentYearTone = currentYearIsPositive ? 'var(--gain)' : 'var(--loss)';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
          Performance Annuelle (hors apports)
        </h3>
        {isMultiCurrency && (
          <span
            className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            title="Les buckets non-EUR (USDC, USD, …) sont convertis en EUR au taux de marché du jour. Les stablecoins sont peggés 1:1 sur leur fiat."
          >
            Valeurs converties en EUR
          </span>
        )}
      </div>

      {/* Performance année en cours en évidence */}
      {currentYearPerformance && (
        <div
          className="rounded-xl border border-l-4 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4"
          style={{
            borderLeftColor: currentYearTone,
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">Année {currentYear} (en cours)</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-3xl sm:text-4xl font-bold break-words" style={{ color: currentYearTone }}>
                  {currentYearPerformance.gainLossPercent >= 0 ? '+' : ''}{currentYearPerformance.gainLossPercent.toFixed(2)}%
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm break-words">
                  ({currentYearPerformance.gainLoss >= 0 ? '+' : ''}{formatCurrency(currentYearPerformance.gainLoss)})
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 sm:gap-4 text-left min-[420px]:text-center">
              <div className="min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Début année</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 break-words tabular-nums">{formatCurrency(currentYearPerformance.startValue)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Valeur actuelle</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 break-words tabular-nums">{formatCurrency(currentYearPerformance.endValue)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Dividendes</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 break-words tabular-nums">+{formatCurrency(currentYearPerformance.dividends)}</p>
              </div>
            </div>
          </div>
          {currentYearPerformance.netFlows !== 0 && (
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              Apports nets cette année : {currentYearPerformance.netFlows >= 0 ? '+' : ''}{formatCurrency(currentYearPerformance.netFlows)}
              {' '}(déjà exclus du calcul de performance)
            </p>
          )}
        </div>
      )}

      {/* Graphique des performances par année */}
      {yearlyChartData.length > 1 && (
        <div className="h-[200px] sm:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }}
                stroke="var(--ink-soft)"
              />
              <YAxis 
                tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`}
                tick={{ fontSize: 10 }}
                stroke="var(--ink-soft)"
                width={50}
              />
              <ReferenceLine y={0} stroke="var(--ink-soft)" strokeWidth={1} />
              <Tooltip 
                formatter={(value, name) => {
                  const numValue = Number(value);
                  if (name === 'performance') {
                    return [`${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`, 'Performance'];
                  }
                  if (name === 'totalReturn') {
                    return [`${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`, 'Avec dividendes'];
                  }
                  return [formatCurrency(numValue), name === 'gainLoss' ? 'Gain/Perte' : 'Dividendes'];
                }}
                contentStyle={{
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                }}
              />
              <Bar 
                dataKey="performance" 
                name="performance"
                radius={[4, 4, 0, 0]}
              >
                {yearlyChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.performance >= 0 ? 'var(--gain)' : 'var(--loss)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau détaillé par année */}
      <div className="space-y-3 sm:hidden">
        {displayedYears.map((year) => (
          <div
            key={`mobile-${year.year}`}
            className={`rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 ${
              year.year === currentYear ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-white dark:bg-zinc-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                {year.year}
                {year.year === currentYear && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    En cours
                  </span>
                )}
              </div>
              <div className={`text-right font-bold tabular-nums ${year.gainLossPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {year.gainLossPercent >= 0 ? '+' : ''}{year.gainLossPercent.toFixed(2)}%
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400">Début</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words tabular-nums">{formatCurrency(year.startValue)}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-zinc-500 dark:text-zinc-400">Fin</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words tabular-nums">{formatCurrency(year.endValue)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-zinc-500 dark:text-zinc-400">Apports</p>
                <p className="text-zinc-600 dark:text-zinc-400 break-words tabular-nums">{year.netFlows >= 0 ? '+' : ''}{formatCurrency(year.netFlows)}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-zinc-500 dark:text-zinc-400">Gain/Perte</p>
                <p className={`font-medium break-words tabular-nums ${year.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {year.gainLoss >= 0 ? '+' : ''}{formatCurrency(year.gainLoss)}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3 font-semibold">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-900 dark:text-zinc-100">Total</span>
            <span className={`text-right tabular-nums ${performance.absoluteGainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {performance.absoluteGainPercent >= 0 ? '+' : ''}{performance.absoluteGainPercent.toFixed(2)}%
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
            <div className="min-w-0">
              <p className="text-zinc-500 dark:text-zinc-400">Valeur actuelle</p>
              <p className="text-zinc-900 dark:text-zinc-100 break-words tabular-nums">{formatCurrency(performance.currentValue)}</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-zinc-500 dark:text-zinc-400">Gain/Perte</p>
              <p className={`break-words tabular-nums ${performance.absoluteGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {performance.absoluteGain >= 0 ? '+' : ''}{formatCurrency(performance.absoluteGain)}
              </p>
            </div>
          </div>
        </div>
        {sortedYears.length > 2 && (
          <button
            onClick={() => setShowAllYears(!showAllYears)}
            className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium py-1"
          >
            {showAllYears ? (
              <span className="flex items-center justify-center gap-1">
                <ChevronDown className="h-4 w-4 rotate-180" />
                Masquer les années précédentes
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <ChevronDown className="h-4 w-4" />
                Voir les {sortedYears.length - 2} années précédentes
              </span>
            )}
          </button>
        )}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="py-2 px-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Année</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Début</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Fin</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Apports</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Gain/Perte</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Performance</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Dividendes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {displayedYears.map((year) => (
              <tr 
                key={year.year} 
                className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                  year.year === currentYear ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                }`}
              >
                <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                  {year.year}
                  {year.year === currentYear && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      En cours
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                  {formatCurrency(year.startValue)}
                </td>
                <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100 font-medium">
                  {formatCurrency(year.endValue)}
                </td>
                <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                  {year.netFlows >= 0 ? '+' : ''}{formatCurrency(year.netFlows)}
                </td>
                <td className={`py-2 px-3 text-right font-medium ${year.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {year.gainLoss >= 0 ? '+' : ''}{formatCurrency(year.gainLoss)}
                </td>
                <td className={`py-2 px-3 text-right font-bold ${year.gainLossPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {year.gainLossPercent >= 0 ? '+' : ''}{year.gainLossPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-right font-medium text-[color:var(--gain)]">
                  +{formatCurrency(year.dividends)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Bouton pour voir plus d'années */}
          {sortedYears.length > 2 && (
            <tfoot>
              <tr>
                <td colSpan={7} className="py-2 px-3">
                  <button
                    onClick={() => setShowAllYears(!showAllYears)}
                    className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium py-1"
                  >
                    {showAllYears ? (
                      <span className="flex items-center justify-center gap-1">
                        <ChevronDown className="h-4 w-4 rotate-180" />
                        Masquer les années précédentes
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">
                        <ChevronDown className="h-4 w-4" />
                        Voir les {sortedYears.length - 2} années précédentes
                      </span>
                    )}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
          {/* Total global */}
          <tfoot className="bg-zinc-100 dark:bg-zinc-800 font-semibold">
            <tr>
              <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">Total</td>
              <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">-</td>
              <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                {formatCurrency(performance.currentValue)}
              </td>
              <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                {formatCurrency(performance.netDeposits)}
              </td>
              <td className={`py-2 px-3 text-right ${performance.absoluteGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {performance.absoluteGain >= 0 ? '+' : ''}{formatCurrency(performance.absoluteGain)}
              </td>
              <td className={`py-2 px-3 text-right ${performance.absoluteGainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {performance.absoluteGainPercent >= 0 ? '+' : ''}{performance.absoluteGainPercent.toFixed(2)}%
              </td>
              <td className="py-2 px-3 text-right font-medium text-[color:var(--gain)]">
                +{formatCurrency(performance.totalDividends)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

