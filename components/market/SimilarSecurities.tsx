'use client';

// Bas de fiche : titres similaires (même secteur d'activité, puis souvent
// consultés ensemble), avec cours, variation du jour et courbe d'un mois.
// Chargé quand le bloc approche de l'écran ; masqué sans données.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStockQuotes } from '@/lib/hooks';
import { instrumentLabel } from '@/lib/instrument-names';
import type { SimilarItem, SimilarResult } from '@/lib/market/similar';
import type { StockQuote } from '@/lib/types';
import { useMonthSparklines } from './MarketList';
import { Sparkline } from './Sparkline';
import { changeClass, fmtPct, fmtPrice, marketHref } from './format';
import { card } from './ui';
import { useJson } from './useJson';

/** Vrai dès que l'élément approche de la zone visible (une seule fois). */
function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setNear(true);
    }, { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}

function SimilarCard({ item, quote, spark, settled }: { item: SimilarItem; quote?: StockQuote; spark?: number[]; settled: boolean }) {
  const name = instrumentLabel(item.symbol, quote?.name ?? item.name);
  const pct = quote ? quote.changePercent / 100 : null;
  return (
    <li>
      <Link
        href={marketHref(item.symbol)}
        className="flex h-full flex-col gap-2 rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={name}>{name}</span>
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{item.symbol}</span>
        </span>
        <Sparkline values={spark ?? []} width={120} height={28} />
        <span className="mt-auto flex items-baseline justify-between gap-2 tabular-nums">
          <span className="text-sm text-zinc-900 dark:text-zinc-100">
            {quote ? fmtPrice(quote.price, quote.currency) : settled ? <span className="text-xs text-zinc-500">Indisponible</span> : <span className="inline-block h-4 w-14 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />}
          </span>
          <span className={`text-xs ${changeClass(pct)}`}>{quote ? fmtPct(pct) : ''}</span>
        </span>
      </Link>
    </li>
  );
}

function Group({ title, items, quotes, sparks, settled }: { title: string; items: SimilarItem[]; quotes: Record<string, StockQuote>; sparks: Record<string, number[]>; settled: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <SimilarCard key={item.symbol} item={item} quote={quotes[item.symbol]} spark={sparks[item.symbol]} settled={settled} />
        ))}
      </ul>
    </div>
  );
}

export function SimilarSecurities({ symbol }: { symbol: string }) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const similar = useJson<SimilarResult>(near ? `/api/market/similar?symbol=${encodeURIComponent(symbol)}` : null);
  const data = similar.data;
  const symbols = useMemo(() => (data ? [...data.peers, ...data.alsoWatched].map((i) => i.symbol) : []), [data]);
  const { quotes, ready } = useStockQuotes(symbols, { enabled: symbols.length > 0 });
  const sparks = useMonthSparklines(symbols);

  const empty = data && data.peers.length === 0 && data.alsoWatched.length === 0;
  // Module secondaire : rien n'est affiché en cas d'erreur ou sans résultat.
  if (similar.error || empty) return <div ref={ref} />;

  return (
    <div ref={ref}>
      {data && (
        <section className={`${card} p-4 sm:p-5`} aria-labelledby="similar-title">
          <h2 id="similar-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Titres similaires</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Pour comparer ou découvrir : ce ne sont pas des recommandations d’investissement.</p>
          <div className="mt-4 space-y-5">
            <Group title={data.industry ? `Même secteur · ${data.industry}` : 'Même secteur'} items={data.peers} quotes={quotes} sparks={sparks} settled={ready} />
            <Group title="Souvent consultés avec ce titre" items={data.alsoWatched} quotes={quotes} sparks={sparks} settled={ready} />
          </div>
        </section>
      )}
    </div>
  );
}
