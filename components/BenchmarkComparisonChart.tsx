'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { PortfolioHistoryPoint } from '@/lib/portfolio-calculator';
import type { HistoricalQuote } from '@/lib/stock-api';
import type { Transaction } from '@/lib/types';
import { findClosestQuote } from '@/lib/stock-api';

const BENCHMARKS = {
  '^FCHI': { label: 'CAC 40', color: '#2563eb' },
  '^GSPC': { label: 'S&P 500', color: '#dc2626' },
  '^NDX': { label: 'Nasdaq 100', color: '#0891b2' },
  '^IXIC': { label: 'Nasdaq Composite', color: '#0d9488' },
  '^DJI': { label: 'Dow Jones', color: '#7c3aed' },
  '^STOXX50E': { label: 'Euro Stoxx 50', color: '#9333ea' },
  '^GDAXI': { label: 'DAX', color: '#ca8a04' },
  '^FTSE': { label: 'FTSE 100', color: '#be185d' },
  '^N225': { label: 'Nikkei 225', color: '#ea580c' },
  '^RUT': { label: 'Russell 2000', color: '#65a30d' },
} as const;

type BenchmarkKey = keyof typeof BENCHMARKS;

type PeriodOption = '1M' | '3M' | '6M' | '1A' | 'YTD' | 'Max';

const PERIODS: PeriodOption[] = ['1M', '3M', '6M', '1A', 'YTD', 'Max'];

function periodCutoff(period: PeriodOption): string | null {
  if (period === 'Max') return null;
  const now = new Date();
  if (period === 'YTD') {
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  }
  const d = new Date(now);
  const months = ({ '1M': 1, '3M': 3, '6M': 6, '1A': 12 } as Record<string, number>)[period];
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

// Computes a Time-Weighted Return index (base 100) that neutralizes cash flows.
// Each day: r_d = (V_d - flow_d) / V_{d-1} - 1, then index_d = index_{d-1} * (1 + r_d).
// This is the same "hors apports" logic used by the annual performance table.
function buildPortfolioTwrIndex(
  history: PortfolioHistoryPoint[],
  transactions: Transaction[]
): Array<{ date: string; index: number }> {
  if (history.length === 0) return [];

  // Aggregate DEPOSIT / WITHDRAWAL per day — these are the only flows that matter
  // for "hors apports". Dividends/fees are internal and already reflected in totalValue.
  const flowsByDate = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === 'DEPOSIT') {
      flowsByDate.set(tx.date, (flowsByDate.get(tx.date) ?? 0) + tx.amount);
    } else if (tx.type === 'WITHDRAWAL') {
      flowsByDate.set(tx.date, (flowsByDate.get(tx.date) ?? 0) - tx.amount);
    }
  }

  const result: Array<{ date: string; index: number }> = [];
  let index = 100;
  let prevValue = 0;
  let started = false;

  for (const p of history) {
    const flow = flowsByDate.get(p.date) ?? 0;

    if (!started) {
      // Start indexing from the first day with a meaningful positive value.
      if (p.totalValue > 0) {
        started = true;
        index = 100;
        prevValue = p.totalValue;
        result.push({ date: p.date, index });
      }
      continue;
    }

    if (prevValue > 0) {
      const r = (p.totalValue - flow) / prevValue - 1;
      index *= 1 + r;
    }
    prevValue = p.totalValue;
    result.push({ date: p.date, index });
  }

  return result;
}

export function BenchmarkComparisonChart({
  portfolioHistory,
  transactions,
  loading,
}: {
  portfolioHistory: PortfolioHistoryPoint[];
  transactions: Transaction[];
  loading?: boolean;
}) {
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkKey>('^FCHI');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('Max');
  const [benchmarkQuotes, setBenchmarkQuotes] = useState<Record<string, HistoricalQuote[]>>({});
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  // Évite le warning Recharts width(-1)/height(-1) au rendu SSR : on attend
  // que le DOM soit monté pour que ResponsiveContainer puisse mesurer.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const filteredHistory = useMemo(() => {
    const cutoff = periodCutoff(selectedPeriod);
    if (!cutoff) return portfolioHistory;
    return portfolioHistory.filter((p) => p.date >= cutoff);
  }, [portfolioHistory, selectedPeriod]);

  const { startDate, endDate } = useMemo(() => {
    if (filteredHistory.length === 0) {
      const today = new Date().toISOString().split('T')[0];
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

  // Portfolio TWR index — computed on the FULL history so cumulative returns are
  // correct, then sliced to the visible window and rebased to 100 at window start.
  const fullTwrIndex = useMemo(
    () => buildPortfolioTwrIndex(portfolioHistory, transactions),
    [portfolioHistory, transactions]
  );

  const chartData = useMemo(() => {
    if (filteredHistory.length === 0 || fullTwrIndex.length === 0) return [];

    const quotes = benchmarkQuotes[selectedBenchmark] ?? [];
    if (quotes.length === 0) return [];

    // Rebase portfolio TWR index to 100 at the first date of the filtered window.
    const windowStart = filteredHistory[0].date;
    const firstTwrIdx = fullTwrIndex.findIndex((p) => p.date >= windowStart);
    if (firstTwrIdx === -1) return [];

    const baseTwr = fullTwrIndex[firstTwrIdx].index;
    if (baseTwr <= 0) return [];

    const twrMap = new Map<string, number>();
    for (let i = firstTwrIdx; i < fullTwrIndex.length; i++) {
      twrMap.set(fullTwrIndex[i].date, (fullTwrIndex[i].index / baseTwr) * 100);
    }

    const baseBenchmark = findClosestQuote(quotes, windowStart)?.close ?? quotes[0].close;
    if (baseBenchmark <= 0) return [];

    return filteredHistory.map((p) => {
      const portfolioVal = twrMap.get(p.date);
      const q = findClosestQuote(quotes, p.date);
      const benchValue = q ? (q.close / baseBenchmark) * 100 : 100;
      return {
        date: p.date,
        portfolio: portfolioVal !== undefined ? Number(portfolioVal.toFixed(2)) : 100,
        benchmark: Number(benchValue.toFixed(2)),
      };
    });
  }, [filteredHistory, fullTwrIndex, benchmarkQuotes, selectedBenchmark]);

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
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
                stroke="#059669"
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
