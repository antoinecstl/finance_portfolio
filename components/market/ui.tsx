'use client';

// Briques d'interface partagées par les onglets de la fiche valeur.

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

export const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

/** Style commun des graphiques : quadrillage et axes discrets, info-bulle aux couleurs de l'app. */
export const chartStyle = {
  grid: { stroke: 'var(--rule)', strokeOpacity: 0.6 },
  tick: { fontSize: 11, fill: 'var(--ink-soft)' },
  tooltip: {
    backgroundColor: 'var(--paper-2)',
    border: '1px solid var(--rule)',
    borderRadius: '8px',
    color: 'var(--ink)',
    fontSize: 12,
  },
  cursor: { fill: 'var(--paper-2)' },
} as const;

export function Panel({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`${card} p-4 sm:p-5`} aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PanelSkeleton({ title, height = 220 }: { title: string; height?: number }) {
  return (
    <section className={`${card} p-4 sm:p-5`} aria-busy="true">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <span className="sr-only">Chargement…</span>
      <div className="mt-3 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" style={{ height }} />
    </section>
  );
}

export function PanelError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-sm underline underline-offset-4">
          <RefreshCw className="h-4 w-4" /> Réessayer
        </button>
      )}
    </section>
  );
}

/** Copie de secours servie pendant une panne de la source. */
export function StaleNotice({ asOf, stale }: { asOf?: string; stale?: boolean }) {
  if (!stale || !asOf) return null;
  const date = new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      Source momentanément indisponible : données du {date}.
    </p>
  );
}

/** Indicateur chiffré avec son explication en une phrase. */
export function Figure({
  label,
  value,
  detail,
  hint,
  valueClass = '',
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/60">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100 ${valueClass}`}>{value}</dd>
      {detail && <dd className="text-xs text-zinc-600 dark:text-zinc-300">{detail}</dd>}
      {hint && <dd className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</dd>}
    </div>
  );
}

/** Bascule à deux ou trois positions (aria-pressed). */
export function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`focus-inset whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors sm:text-sm ${
            o.value === value ? 'btn-ink' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Graduations au 1er janvier (une sur deux au-delà de 12 ans), pour un axe temporel en ms. */
export function yearTicks(fromMs: number, toMs: number): number[] {
  const first = new Date(fromMs).getUTCFullYear() + 1;
  const last = new Date(toMs).getUTCFullYear();
  const step = last - first > 12 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = first; y <= last; y += step) ticks.push(Date.UTC(y, 0, 1));
  return ticks;
}

export const fmtDate = (iso: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' }) : '—';
