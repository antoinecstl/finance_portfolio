'use client';

import { CloudOff, RefreshCw } from 'lucide-react';

/**
 * État d'un graphique dont les cours n'ont pas pu être chargés. À distinguer
 * de l'état vide (aucune transaction) : les données de l'utilisateur ne sont
 * pas en cause.
 */
export function ChartUnavailable({ onRetry, className = 'py-8 sm:py-12' }: { onRetry?: () => void; className?: string }) {
  return (
    <div role="status" className={`text-center ${className}`}>
      <CloudOff className="mx-auto h-9 w-9 text-[color:var(--ink-soft)]" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-[color:var(--ink)]">Données momentanément indisponibles</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[color:var(--ink-soft)]">
        Les cours n’ont pas pu être chargés. Vos transactions ne sont pas en cause.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-outline mt-4 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Réessayer
        </button>
      )}
    </div>
  );
}
