// Indices offered by the benchmark comparison. Shared by the app chart and the
// public pages so the marketing copy never drifts from what the product offers.
export const BENCHMARKS = {
  '^FCHI': { label: 'CAC 40', color: 'var(--chart-1)' },
  '^GSPC': { label: 'S&P 500', color: 'var(--chart-3)' },
  '^NDX': { label: 'Nasdaq 100', color: 'var(--chart-6)' },
  '^IXIC': { label: 'Nasdaq Composite', color: 'var(--chart-2)' },
  '^DJI': { label: 'Dow Jones', color: 'var(--chart-5)' },
  '^STOXX50E': { label: 'Euro Stoxx 50', color: 'var(--chart-secondary)' },
  '^GDAXI': { label: 'DAX', color: 'var(--chart-3)' },
  '^FTSE': { label: 'FTSE 100', color: 'var(--chart-7)' },
  '^N225': { label: 'Nikkei 225', color: 'var(--chart-9)' },
  '^RUT': { label: 'Russell 2000', color: 'var(--chart-8)' },
} as const;

export type BenchmarkKey = keyof typeof BENCHMARKS;

export const BENCHMARK_LABELS = Object.values(BENCHMARKS).map((b) => b.label);
