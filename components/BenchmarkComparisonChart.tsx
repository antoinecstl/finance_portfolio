'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { calculateModifiedDietzPerformance, type PortfolioHistoryPoint } from '@/lib/portfolio-calculator';
import type { HistoricalQuote } from '@/lib/stock-api';
import type { Transaction } from '@/lib/types';
import { findClosestQuote } from '@/lib/stock-api';

const BENCHMARKS = {
  '^FCHI': { label: 'CAC 40', color: 'var(--chart-1)' },
  '^GSPC': { label: 'S&P 500', color: 'var(--chart-4)' },
  '^NDX': { label: 'Nasdaq 100', color: 'var(--chart-6)' },
  '^IXIC': { label: 'Nasdaq Composite', color: 'var(--chart-2)' },
  '^DJI': { label: 'Dow Jones', color: 'var(--chart-5)' },
  '^STOXX50E': { label: 'Euro Stoxx 50', color: 'var(--chart-secondary)' },
  '^GDAXI': { label: 'DAX', color: 'var(--chart-3)' },
  '^FTSE': { label: 'FTSE 100', color: 'var(--chart-7)' },
  '^N225': { label: 'Nikkei 225', color: 'var(--chart-9)' },
  '^RUT': { label: 'Russell 2000', color: 'var(--chart-8)' },
} as const;

type BenchmarkKey = keyof typeof BENCHMARKS;

type PeriodOption = '1M' | '3M' | '6M' | '1A' | 'YTD' | 'Max';

const PERIODS: PeriodOption[] = ['1M', '3M', '6M', '1A', 'YTD', 'Max'];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodCutoff(period: PeriodOption): string | null {
  if (period === 'Max') return null;
  const now = new Date();
  if (period === 'YTD') {
    return formatLocalDate(new Date(now.getFullYear(), 0, 1));
  }
  const d = new Date(now);
  const months = ({ '1M': 1, '3M': 3, '6M': 6, '1A': 12 } as Record<string, number>)[period];
  d.setMonth(d.getMonth() - months);
  return formatLocalDate(d);
}

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

// Computes a Modified Dietz index (base 100), matching the annual performance card.
function buildPortfolioDietzIndex(
  history: PortfolioHistoryPoint[],
  transactions: Transaction[],
  startDate: string
): Array<{ date: string; index: number }> {
  if (history.length === 0) return [];

  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const visibleHistory = sortedHistory.filter((point) => point.date >= startDate);

  return visibleHistory.map((point, index) => {
    if (index === 0) {
      return { date: point.date, index: 100 };
    }

    const performance = calculateModifiedDietzPerformance(
      sortedHistory,
      transactions,
      startDate,
      point.date,
      'stocksValue'
    );

    return {
      date: point.date,
      index: 100 + performance.gainLossPercent,
    };
  });
}

export function BenchmarkComparisonChart({
  portfolioHistory,
  transactions,
  loading,
  currentPortfolioValue,
}: {
  portfolioHistory: PortfolioHistoryPoint[];
  transactions: Transaction[];
  loading?: boolean;
  currentPortfolioValue?: number;
}) {
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkKey>('^FCHI');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('YTD');
  const [benchmarkQuotes, setBenchmarkQuotes] = useState<Record<string, HistoricalQuote[]>>({});
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  // Évite le warning Recharts width(-1)/height(-1) au rendu SSR : on attend
  // que le DOM soit monté pour que ResponsiveContainer puisse mesurer.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const performanceHistory = useMemo(() => {
    if (currentPortfolioValue === undefined || portfolioHistory.length === 0) {
      return portfolioHistory;
    }

    const today = formatLocalDate(new Date());
    const lastPoint = portfolioHistory[portfolioHistory.length - 1];
    const updatedLastPoint = {
      ...lastPoint,
      date: lastPoint.date < today ? today : lastPoint.date,
      stocksValue: currentPortfolioValue,
      totalValue: lastPoint.totalValue + (currentPortfolioValue - lastPoint.stocksValue),
    };

    if (lastPoint.date < today) {
      return [...portfolioHistory, updatedLastPoint];
    }

    return portfolioHistory.map((point, index) =>
      index === portfolioHistory.length - 1 ? updatedLastPoint : point
    );
  }, [portfolioHistory, currentPortfolioValue]);

  const filteredHistory = useMemo(() => {
    const cutoff = periodCutoff(selectedPeriod);
    if (!cutoff) return performanceHistory;
    return performanceHistory.filter((p) => p.date >= cutoff);
  }, [performanceHistory, selectedPeriod]);

  const { startDate, endDate } = useMemo(() => {
    if (filteredHistory.length === 0) {
      const today = formatLocalDate(new Date());
      return { startDate: today, endDate: today };
    }
    return {
      startDate: filteredHistory[0].date,
      endDate: filteredHistory[filteredHistory.length - 1].date,
    };
  }, [filteredHistory]);

  useEffect(() => {
    if (filteredHistory.length === 0) return;
    let cancelled = false;
    (async () => {
      setBenchmarkLoading(true);
      setBenchmarkError(null);
      try {
        const res = await fetch(
          `/api/stocks/history?symbols=${encodeURIComponent(selectedBenchmark)}&startDate=${startDate}&endDate=${endDate}&interval=1d`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setBenchmarkQuotes(data);
      } catch (e) {
        if (!cancelled) setBenchmarkError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setBenchmarkLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBenchmark, startDate, endDate, filteredHistory.length]);

  // Portfolio index based on the same Modified Dietz method as annual performance.
  const chartData = useMemo(() => {
    if (filteredHistory.length === 0) return [];

    const quotes = benchmarkQuotes[selectedBenchmark] ?? [];
    if (quotes.length === 0) return [];

    // Build the same Modified Dietz return used by the annual performance card.
    const windowStart = periodCutoff(selectedPeriod) ?? filteredHistory[0].date;
    const dietzIndex = buildPortfolioDietzIndex(performanceHistory, transactions, windowStart);
    if (dietzIndex.length === 0) return [];

    const dietzMap = new Map<string, number>();
    for (const point of dietzIndex) {
      dietzMap.set(point.date, point.index);
    }

    const baseBenchmark = findClosestQuote(quotes, windowStart)?.close ?? quotes[0].close;
    if (baseBenchmark <= 0) return [];

    return filteredHistory.map((p) => {
      const portfolioVal = dietzMap.get(p.date);
      const q = findClosestQuote(quotes, p.date);
      const benchValue = q ? (q.close / baseBenchmark) * 100 : 100;
      return {
        date: p.date,
        portfolio: portfolioVal !== undefined ? Number(portfolioVal.toFixed(2)) : 100,
        benchmark: Number(benchValue.toFixed(2)),
      };
    });
  }, [filteredHistory, performanceHistory, transactions, benchmarkQuotes, selectedBenchmark, selectedPeriod]);

  const finalPerf = useMemo(() => {
    if (chartData.length === 0) return { portfolio: 0, benchmark: 0, delta: 0 };
    const last = chartData[chartData.length - 1];
    return {
      portfolio: last.portfolio - 100,
      benchmark: last.benchmark - 100,
      delta: last.portfolio - last.benchmark,
    };
  }, [chartData]);

  const isLoading = loading || benchmarkLoading;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance (hors apports) vs Benchmark
          </h3>
        </div>

        {/* Sélecteur de période — même format que les autres graphs */}
        <div className="flex gap-1">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Sélecteur de benchmark */}
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="benchmark-select" className="text-xs text-zinc-500 dark:text-zinc-400">
          Indice :
        </label>
        <select
          id="benchmark-select"
          value={selectedBenchmark}
          onChange={(e) => setSelectedBenchmark(e.target.value as BenchmarkKey)}
          className="px-2.5 py-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(Object.keys(BENCHMARKS) as BenchmarkKey[]).map((key) => (
            <option key={key} value={key}>
              {BENCHMARKS[key].label}
            </option>
          ))}
        </select>
      </div>

      {benchmarkError && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-xs text-red-700 dark:text-red-300">
          Erreur benchmark : {benchmarkError}
        </div>
      )}

      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">Mon portefeuille</p>
            <p className={`text-sm sm:text-base font-semibold ${finalPerf.portfolio >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmtPct(finalPerf.portfolio)}
            </p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">{BENCHMARKS[selectedBenchmark].label}</p>
            <p className={`text-sm sm:text-base font-semibold ${finalPerf.benchmark >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmtPct(finalPerf.benchmark)}
            </p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">Écart (α)</p>
            <p className={`text-sm sm:text-base font-semibold ${finalPerf.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmtPct(finalPerf.delta)}
            </p>
          </div>
        </div>
      )}

      <div className="h-60 sm:h-72 w-full">
        {!mounted || isLoading ? (
          <div className="flex h-full items-center justify-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Chargement…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Pas encore assez de données pour comparer.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v, name) => [
                  `${typeof v === 'number' ? v.toFixed(2) : v} (base 100)`,
                  String(name),
                ]}
                labelFormatter={(d) => `Date: ${d}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="portfolio"
                name="Portefeuille (hors apports)"
                stroke="var(--gain)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                name={BENCHMARKS[selectedBenchmark].label}
                stroke={BENCHMARKS[selectedBenchmark].color}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
