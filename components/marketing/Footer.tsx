import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-24">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Produit</h4>
          <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
            <li><Link href="/#pricing" className="hover:text-zinc-900">Tarifs</Link></li>
            <li><Link href="/signup" className="hover:text-zinc-900">Créer un compte</Link></li>
            <li><Link href="/login" className="hover:text-zinc-900">Se connecter</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Légal</h4>
          <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
            <li><Link href="/legal/cgu" className="hover:text-zinc-900">CGU</Link></li>
            <li><Link href="/legal/confidentialite" className="hover:text-zinc-900">Confidentialité</Link></li>
            <li><Link href="/legal/mentions-legales" className="hover:text-zinc-900">Mentions légales</Link></li>
            <li><Link href="/legal/cookies" className="hover:text-zinc-900">Cookies</Link></li>
          </ul>
        </div>
        <div className="col-span-2">
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Fi-Hub</h4>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xs">
            Suivi de patrimoine — PEA, CTO, livrets, assurances-vie. Un tableau de bord unique,
            valorisé en temps réel.
          </p>
        </div>
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-zinc-500 flex justify-between">
          <span>© {new Date().getFullYear()} Fi-Hub</span>
          <span>Fait en France</span>
        </div>
      </div>
    </footer>
  );
}
