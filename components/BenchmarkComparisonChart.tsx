'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { PortfolioHistoryPoint } from '@/lib/portfolio-calculator';
import type { HistoricalQuote } from '@/lib/stock-api';
import { findClosestQuote } from '@/lib/stock-api';

// Benchmarks disponibles. Les symboles Yahoo Finance sont directement utilisables
// via l'API /api/stocks/history existante.
const BENCHMARKS = {
  '^FCHI': { label: 'CAC 40', color: '#2563eb' },
  '^GSPC': { label: 'S&P 500', color: '#dc2626' },
  '^STOXX50E': { label: 'Euro Stoxx 50', color: '#9333ea' },
} as const;

type BenchmarkKey = keyof typeof BENCHMARKS;

// Normalise une série de cours en base 100 à la date de départ.
// Utile pour comparer un portefeuille et un indice sur la même échelle.
function normalizeToBase100(values: Array<{ date: string; value: number }>, baseValue: number): Array<{ date: string; value: number }> {
  if (baseValue <= 0 || values.length === 0) return values.map((v) => ({ ...v, value: 100 }));
  return values.map((v) => ({ date: v.date, value: (v.value / baseValue) * 100 }));
}

// Formate un nombre en pourcentage pour l'affichage.
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export function BenchmarkComparisonChart({
  portfolioHistory,
  loading,
}: {
  portfolioHistory: PortfolioHistoryPoint[];
  loading?: boolean;
}) {
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkKey>('^FCHI');
  const [benchmarkQuotes, setBenchmarkQuotes] = useState<Record<string, HistoricalQuote[]>>({});
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  // Plage temporelle déduite de l'historique du portefeuille.
  const { startDate, endDate } = useMemo(() => {
    if (portfolioHistory.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: today, endDate: today };
    }
    return {
      startDate: portfolioHistory[0].date,
      endDate: portfolioHistory[portfolioHistory.length - 1].date,
    };
  }, [portfolioHistory]);

  useEffect(() => {
    if (portfolioHistory.length === 0) return;
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
    return () => {
      cancelled = true;
    };
  }, [selectedBenchmark, startDate, endDate, portfolioHistory.length]);

  // Fusion en une série unique { date, portfolio, benchmark } (base 100 à la 1ère date).
  const chartData = useMemo(() => {
    if (portfolioHistory.length === 0) return [];
    const quotes = benchmarkQuotes[selectedBenchmark] ?? [];
    if (quotes.length === 0) return [];

    // Point de référence : 1ère date de l'historique du portefeuille avec valeur > 0.
    const firstValidIdx = portfolioHistory.findIndex((p) => p.totalValue > 0);
    if (firstValidIdx === -1) return [];

    const basePortfolio = portfolioHistory[firstValidIdx].totalValue;
    const baseDate = portfolioHistory[firstValidIdx].date;
    const baseBenchmark = findClosestQuote(quotes, baseDate)?.close ?? quotes[0].close;
    if (baseBenchmark <= 0) return [];

    const portfolioNorm = normalizeToBase100(
      portfolioHistory.map((p) => ({ date: p.date, value: p.totalValue })),
      basePortfolio
    );

    return portfolioNorm.map((p) => {
      const q = findClosestQuote(quotes, p.date);
      const benchValue = q ? (q.close / baseBenchmark) * 100 : 100;
      return {
        date: p.date,
        portfolio: Number(p.value.toFixed(2)),
        benchmark: Number(benchValue.toFixed(2)),
      };
    });
  }, [portfolioHistory, benchmarkQuotes, selectedBenchmark]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Portefeuille vs Benchmark
          </h3>
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(BENCHMARKS) as BenchmarkKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedBenchmark(key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                selectedBenchmark === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {BENCHMARKS[key].label}
            </button>
          ))}
        </div>
      </div>

      {benchmarkError && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-xs text-red-700 dark:text-red-300">
          Erreur benchmark : {benchmarkError}
        </div>
      )}

      {/* Synthèse des performances relatives */}
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
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Chargement…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Pas encore assez de données pour comparer.
          </div>
        ) : (
          <ResponsiveContainer>
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
                name="Portefeuille"
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
