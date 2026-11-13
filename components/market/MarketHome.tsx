'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Clock, Star } from 'lucide-react';
import { useStockQuotes, useTransactions, usePositionsWithCalculatedValues } from '@/lib/hooks';
import { BENCHMARKS } from '@/lib/benchmarks';
import { MarketSearch } from './MarketSearch';
import { MarketRow, useMonthSparklines } from './MarketList';
import { FavoriteButton } from './FavoriteButton';
import { useRecents } from './useRecents';
import { useWatchlist } from './useWatchlist';
import { marketHref } from './format';
import { instrumentLabel } from '@/lib/instrument-names';

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
  const watchlist = useWatchlist();
  const favorites = watchlist.items;
  const allSymbols = useMemo(
    // 50 cours par requête au plus : indices et favoris d'abord, puis les titres détenus.
    () => Array.from(new Set([...benchmarks.map((b) => b.symbol), ...favorites.map((f) => f.symbol.toUpperCase()), ...holdings])).slice(0, 50),
    [favorites, holdings, benchmarks]
  );
  const { quotes, ready: quotesSettled } = useStockQuotes(allSymbols);
  const showHoldings = loadingTransactions || holdings.length > 0;
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
        {showHoldings && (
          <Panel title="Vos titres" description="Les lignes que vous détenez, du plus gros montant investi au plus petit.">
            {holdings.length === 0 ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {holdings.map((symbol) => (
                  <MarketRow key={symbol} symbol={symbol} name={instrumentLabel(symbol, quotes[symbol]?.name)} quote={quotes[symbol]} spark={sparks[symbol]} settled={quotesSettled} />
                ))}
              </ul>
            )}
          </Panel>
        )}

        {/* Sans titres détenus : favoris et indices côte à côte sur toute la largeur. */}
        <div className={showHoldings ? 'space-y-4 sm:space-y-6' : 'grid items-start gap-4 sm:gap-6 lg:col-span-2 lg:grid-cols-2'}>
          <Panel title="Favoris" description="Les titres que vous suivez, sans forcément les détenir.">
            {!watchlist.ready && !watchlist.failed ? (
              <div className="space-y-2 p-4" aria-busy="true">
                {[0, 1].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}
              </div>
            ) : watchlist.failed && favorites.length === 0 ? (
              <p className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                Favoris momentanément indisponibles.{' '}
                <button type="button" onClick={() => void watchlist.reload()} className="font-medium underline underline-offset-4">Réessayer</button>
              </p>
            ) : favorites.length === 0 ? (
              <p className="flex gap-2 p-4 text-sm text-zinc-600 dark:text-zinc-400">
                <Star className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Aucun favori pour l’instant. Sur la fiche d’un titre, touchez « Suivre » pour le retrouver ici.</span>
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {favorites.map((f) => {
                  const symbol = f.symbol.toUpperCase();
                  const name = instrumentLabel(symbol, quotes[symbol]?.name ?? f.name);
                  return (
                    <MarketRow
                      key={symbol}
                      symbol={symbol}
                      name={name}
                      quote={quotes[symbol]}
                      spark={sparks[symbol]}
                      settled={quotesSettled}
                      trailing={<FavoriteButton symbol={symbol} name={name} compact />}
                    />
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Indices et références" description="Les références du comparateur de performance.">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {benchmarks.map((b) => (
                <MarketRow key={b.symbol} symbol={b.symbol} name={b.label} quote={quotes[b.symbol]} spark={sparks[b.symbol]} settled={quotesSettled} />
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Données de marché fournies à titre informatif, parfois différées selon la place de cotation. Courbes sur un mois.
      </p>
    </div>
  );
}
