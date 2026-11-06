import Link from 'next/link';

/** Contenu de la page 404, partagé par le site public et l'application. */
export function NotFoundContent({ inApp = false }: { inApp?: boolean }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center sm:py-24">
      <p className="mono text-xs uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">Erreur 404</p>
      <h1 className="display mt-3 text-4xl leading-tight text-[color:var(--ink)] sm:text-5xl">Page introuvable</h1>
      <p className="mt-4 text-[color:var(--ink-soft)]">
        Cette adresse n’existe pas ou a été déplacée. Vérifiez le lien, ou repartez d’une page connue.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href="/dashboard" className="btn-ink inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm">
          {inApp ? 'Retour à la vue d’ensemble' : 'Mon tableau de bord'}
        </Link>
        {!inApp && (
          <Link href="/" className="btn-outline inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm">
            Page d’accueil de Fi-Hub
          </Link>
        )}
      </div>
    </div>
  );
}
