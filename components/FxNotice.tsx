'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useFxStatus } from '@/lib/fx-client';
import { formatDate } from '@/lib/utils';

const listOf = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;

/**
 * Bandeau affiché quand un taux de change manque : montants valorisés au
 * dernier taux connu, ou non convertis faute de taux. Évite qu'un total faux
 * passe inaperçu.
 */
export function FxNotice({ onRetry }: { onRetry?: () => void }) {
  const { stale, missing } = useFxStatus();
  if (stale.length === 0 && missing.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          {missing.length > 0 && (
            <p>
              <span className="font-medium">Taux de change indisponible ({listOf(missing)}).</span>{' '}
              Les montants dans {missing.length > 1 ? 'ces devises' : 'cette devise'} sont comptés sans conversion : les totaux en euros sont approximatifs.
            </p>
          )}
          {stale.length > 0 && (
            <p>
              <span className="font-medium">Taux de change non mis à jour.</span>{' '}
              {stale.map(({ currency, savedAt }) => `${currency} au taux du ${formatDate(savedAt)}`).join(', ')}.
            </p>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium hover:bg-amber-100 sm:self-auto dark:border-amber-700 dark:hover:bg-amber-900/40"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Réessayer
        </button>
      )}
    </div>
  );
}
