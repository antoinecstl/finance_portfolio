'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { useStockQuotes, useTransactions, usePositionsWithCalculatedValues } from '@/lib/hooks';
import { BENCHMARKS } from '@/lib/benchmarks';
import type { StockQuote } from '@/lib/types';
import { MarketSearch } from './MarketSearch';
import { Sparkline } from './Sparkline';
import { useRecents } from './useRecents';
import { changeClass, fmtPct, fmtPrice, marketHref } from './format';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// Courbes 1 mois de toutes les lignes, en un seul appel groupé.
function useMonthSparklines(symbols: string[]): Record<string, number[]> {
  const key = symbols.join(',');
  const [state, setState] = useState<{ key: string; data: Record<string, number[]> }>({ key: '', data: {} });

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const end = new Date();
    const start = new Date(end.getTime() - 35 * 86_400_000);
    const params = new URLSearchParams({ symbols: key, startDate: isoDay(start), endDate: isoDay(end), interval: '1d' });
    fetch(`/api/stocks/history?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : {}))
      .then((json: Record<string, Array<{ close: number }>>) => {
        const data: Record<string, number[]> = {};
        for (const [symbol, rows] of Object.entries(json ?? {})) {
          if (Array.isArray(rows)) data[symbol.toUpperCase()] = rows.map((r) => r.close).filter(Number.isFinite);
        }
        setState({ key, data });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [key]);

  return state.key === key ? state.data : {};
}

function MarketRow({ symbol, name, quote, spark }: { symbol: string; name: string; quote?: StockQuote; spark?: number[] }) {
  const pct = quote ? quote.changePercent / 100 : null;
  return (
    <li>
      <Link
        href={marketHref(symbol)}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{symbol}</span>
        </span>
        <span className="hidden sm:block">
          <Sparkline values={spark ?? []} />
        </span>
        <span className="w-28 shrink-0 text-right">
          <span className="block text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
            {quote ? fmtPrice(quote.price, quote.currency) : <span className="inline-block h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />}
          </span>
          <span className={`block text-xs tabular-nums ${changeClass(pct)}`}>{quote ? fmtPct(pct) : ' '}</span>
        </span>
      </Link>
    </li>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function MarketHome() {
  const recents = useRecents();
  const { transactions, loading: loadingTransactions } = useTransactions();
  const positions = usePositionsWithCalculatedValues(transactions);

  // Titres détenus, du plus gros montant investi au plus petit.
  const holdings = useMemo(() => {
    const invested = new Map<string, number>();
    for (const p of positions) {
      const symbol = p.symbol.toUpperCase();
      invested.set(symbol, (invested.get(symbol) ?? 0) + (p.calculatedTotalInvested ?? 0));
    }
    return Array.from(invested.entries()).sort((a, b) => b[1] - a[1]).map(([symbol]) => symbol);
  }, [positions]);

  const benchmarks = useMemo(
    () => Object.entries(BENCHMARKS).map(([symbol, b]) => ({ symbol, label: b.label })),
    []
  );
  const allSymbols = useMemo(
    () => Array.from(new Set([...holdings, ...benchmarks.map((b) => b.symbol)])).slice(0, 50),
    [holdings, benchmarks]
  );
  const { quotes } = useStockQuotes(allSymbols);
  const sparks = useMonthSparklines(allSymbols);

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl">
        <MarketSearch autoFocus />
        {recents.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Récents
            </span>
            {recents.map((r) => (
              <Link
                key={r.symbol}
                href={marketHref(r.symbol)}
                title={r.name}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {r.symbol}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {(loadingTransactions || holdings.length > 0) && (
          <Panel title="Vos titres" description="Les lignes que vous détenez, du plus gros montant investi au plus petit.">
            {holdings.length === 0 ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {holdings.map((symbol) => (
                  <MarketRow key={symbol} symbol={symbol} name={quotes[symbol]?.name ?? symbol} quote={quotes[symbol]} spark={sparks[symbol]} />
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="Indices et références" description="Les références du comparateur de performance.">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {benchmarks.map((b) => (
              <MarketRow key={b.symbol} symbol={b.symbol} name={b.label} quote={quotes[b.symbol]} spark={sparks[b.symbol]} />
            ))}
          </ul>
        </Panel>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Données de marché fournies à titre informatif, parfois différées selon la place de cotation. Courbes sur un mois.
      </p>
    </div>
  );
}
