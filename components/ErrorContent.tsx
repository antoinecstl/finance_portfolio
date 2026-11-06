'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

/** Contenu des pages d'erreur : message en français, nouvel essai, retour. */
export function ErrorContent({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center sm:py-24">
      <p className="mono text-xs uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">Erreur</p>
      <h1 className="display mt-3 text-4xl leading-tight text-[color:var(--ink)] sm:text-5xl">Un problème est survenu</h1>
      <p className="mt-4 text-[color:var(--ink-soft)]">
        La page n’a pas pu s’afficher. Vos données ne sont pas modifiées. Réessayez dans un instant.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <button type="button" onClick={reset} className="btn-ink inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Réessayer
        </button>
        <Link href="/dashboard" className="btn-outline inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm">
          Vue d’ensemble
        </Link>
      </div>
      {digest && <p className="mono mt-6 text-[10px] text-[color:var(--ink-soft)]">Référence : {digest}</p>}
    </div>
  );
}
