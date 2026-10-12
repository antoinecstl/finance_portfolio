// Silhouettes de chargement : on montre la forme de la page plutôt que des
// montants provisoires qui changeraient une fois les cours et taux arrivés.

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded bg-[color:var(--rule)] ${className}`}
      aria-hidden="true"
    />
  );
}

// Carte générique : titre réel (on sait ce qui charge) + lignes en attente.
export function PanelSkeleton({ title, rows = 4 }: { title?: string; rows?: number }) {
  return (
    <div
      aria-busy="true"
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm"
    >
      {title ? (
        <h3 className="mb-4 font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">{title}</h3>
      ) : (
        <Skeleton className="mb-4 h-5 w-40" />
      )}
      <span className="sr-only">Chargement…</span>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className={`h-4 ${index % 2 === 0 ? 'w-1/3' : 'w-1/4'}`} />
            <Skeleton className="h-4 w-20 sm:w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
