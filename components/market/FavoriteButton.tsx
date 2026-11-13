'use client';

import { Star } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useWatchlist } from './useWatchlist';

/**
 * Étoile « Suivre » d'une fiche : ajoute le titre aux favoris de l'accueil
 * Marchés, ou l'en retire. `compact` : icône seule (lignes de liste).
 */
export function FavoriteButton({ symbol, name, compact = false }: { symbol: string; name?: string | null; compact?: boolean }) {
  const watchlist = useWatchlist();
  const toast = useToast();
  const active = watchlist.has(symbol);
  const label = active ? `Retirer ${name || symbol} des favoris` : `Ajouter ${name || symbol} aux favoris`;

  const toggle = async () => {
    const result = active ? await watchlist.remove(symbol) : await watchlist.add(symbol, name ?? null);
    if (!result.ok) toast.show({ kind: 'error', message: result.message });
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className="focus-inset shrink-0 rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <Star className={`h-4 w-4 ${active ? 'fill-[color:var(--ink)] text-[color:var(--ink)]' : ''}`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={label}
      disabled={!watchlist.ready && !watchlist.failed}
      className={`focus-inset inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
        active
          ? 'border-[color:var(--ink)] bg-zinc-50 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <Star className={`h-4 w-4 ${active ? 'fill-[color:var(--ink)] text-[color:var(--ink)]' : ''}`} aria-hidden="true" />
      {active ? 'Suivi' : 'Suivre'}
    </button>
  );
}
