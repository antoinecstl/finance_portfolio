import type { ReactNode } from 'react';

// Conteneur unique de toutes les pages de l'application : même largeur maximale
// et mêmes marges partout, pour que les bords s'alignent d'une page à l'autre.
export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 2xl:px-10 ${className}`}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  wideActions = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Sur petit écran, les actions (ex. un champ de recherche) prennent toute la largeur. */
  wideActions?: boolean;
}) {
  return (
    // Les actions restent à droite du titre tant qu'il y a la place, sinon passent dessous.
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6 lg:mb-8">
      <div className="min-w-0 flex-1 basis-60">
        <h1 className="display text-3xl leading-none text-[color:var(--ink)] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-[color:var(--ink-soft)]">{description}</p>}
        {meta && <div className="mt-1.5">{meta}</div>}
      </div>
      {actions && (
        <div className={`flex shrink-0 flex-wrap items-center gap-2 ${wideActions ? 'w-full sm:w-auto' : ''}`}>{actions}</div>
      )}
    </header>
  );
}
