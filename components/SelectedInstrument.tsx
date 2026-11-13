'use client';

import { Check } from 'lucide-react';
import { instrumentLabel } from '@/lib/instrument-names';

interface SelectedInstrumentProps {
  symbol: string;
  name?: string | null;
  /** Petit libellé au-dessus du nom (« Titre choisi », « Dividende de »…). */
  caption?: string;
  /** Retire la sélection ; sans callback, le bouton « Changer » est masqué. */
  onClear?: () => void;
  className?: string;
}

/**
 * Titre retenu dans un formulaire : même famille visuelle que les puces
 * « Titres populaires » (fond neutre), marquée d'une coche pour la distinguer
 * d'une suggestion. Jamais de rouge : ce n'est ni une erreur ni un titre indisponible.
 */
export function SelectedInstrument({ symbol, name, caption = 'Titre choisi', onClear, className = '' }: SelectedInstrumentProps) {
  const label = instrumentLabel(symbol, name);
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-800/60 ${className}`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--ink)] text-[color:var(--paper)]"
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{caption}</p>
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={label !== symbol ? `${label} (${symbol})` : symbol}>
          {label}
          {label !== symbol && <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">{symbol}</span>}
        </p>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Changer de titre (${label})`}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 underline-offset-2 hover:bg-zinc-200 hover:underline dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Changer
        </button>
      )}
    </div>
  );
}
