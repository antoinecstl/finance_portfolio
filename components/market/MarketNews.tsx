'use client';

import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { NewsItem } from '@/lib/market/news';
import { useJson } from './useJson';

const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'fr', label: 'Presse française' },
  { id: 'intl', label: 'International' },
] as const;

function ago(iso: string | null, now: number): string {
  if (!iso) return '';
  const minutes = Math.max(Math.round((now - Date.parse(iso)) / 60_000), 0);
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (minutes < 24 * 60) return rtf.format(-Math.round(minutes / 60), 'hour');
  if (minutes < 30 * 24 * 60) return rtf.format(-Math.round(minutes / 1440), 'day');
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Derniers articles : titre, média et date, avec lien vers la source.
export function MarketNews({ symbol, name }: { symbol: string; name: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const { data, error, loading, fetchedAt, reload } = useJson<{ query: string; items: NewsItem[] }>(
    `/api/market/news?symbol=${encodeURIComponent(symbol)}&q=${encodeURIComponent(name)}`
  );
  const items = (data?.items ?? []).filter((n) => filter === 'all' || n.lang === filter);
  const hasBoth = data ? new Set(data.items.map((n) => n.lang)).size > 1 : false;

  return (
    <section className={`${card} p-4 sm:p-5`} aria-labelledby="news-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="news-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Actualités</h2>
        {hasBoth && (
          <div className="flex gap-1" role="group" aria-label="Filtrer les actualités">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${filter === f.id ? 'border-zinc-400 text-zinc-900 dark:border-zinc-500 dark:text-zinc-100' : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="mt-3 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />)}</div>
      ) : error ? (
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          Actualités momentanément indisponibles.
          <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 underline underline-offset-4"><RefreshCw className="h-4 w-4" /> Réessayer</button>
        </p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Aucun article récent trouvé.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((n) => (
            <li key={n.url}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group flex items-start justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-zinc-900 group-hover:underline group-hover:underline-offset-4 dark:text-zinc-100" lang={n.lang === 'fr' ? 'fr' : undefined}>
                    {n.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {[n.publisher, ago(n.publishedAt, fetchedAt)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                <span className="sr-only">(ouvre un nouvel onglet)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        Titres et liens issus de Google Actualités et de la presse financière internationale. Les articles appartiennent à leurs éditeurs.
      </p>
    </section>
  );
}
