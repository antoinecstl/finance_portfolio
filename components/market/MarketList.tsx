'use client';

// Lignes de cotation partagées par l'accueil Marchés et les titres similaires :
// nom, code, courbe d'un mois, cours et variation du jour.

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { StockQuote } from '@/lib/types';
import { Sparkline } from './Sparkline';
import { changeClass, fmtPct, fmtPrice, marketHref } from './format';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// Courbes 1 mois de toutes les lignes, en un seul appel groupé.
export function useMonthSparklines(symbols: string[]): Record<string, number[]> {
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

export function MarketRow({
  symbol,
  name,
  quote,
  spark,
  settled,
  trailing,
}: {
  symbol: string;
  name: string;
  quote?: StockQuote;
  spark?: number[];
  settled: boolean;
  /** Action en bout de ligne (étoile des favoris), hors du lien. */
  trailing?: ReactNode;
}) {
  const pct = quote ? quote.changePercent / 100 : null;
  return (
    <li className="flex items-center">
      <Link
        href={marketHref(symbol)}
        className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${trailing ? 'pr-2' : 'pr-4'}`}
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
            {quote ? (
              fmtPrice(quote.price, quote.currency)
            ) : settled ? (
              // Cours non revenu : on le dit plutôt que de laisser un chargement sans fin.
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Indisponible</span>
            ) : (
              <span className="inline-block h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            )}
          </span>
          <span className={`block text-xs tabular-nums ${changeClass(pct)}`}>{quote ? fmtPct(pct) : ' '}</span>
        </span>
      </Link>
      {trailing && <span className="pr-2">{trailing}</span>}
    </li>
  );
}

