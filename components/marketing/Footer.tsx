import Link from 'next/link';
import { LogoMark } from './Logo';

const COLUMNS = [
  {
    title: 'Produit',
    links: [
      { href: '/fonctionnalites', label: 'Fonctionnalités' },
      { href: '/#pricing', label: 'Tarifs' },
      { href: '/signup', label: 'Créer un compte' },
      { href: '/login', label: 'Se connecter' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { href: '/guides', label: 'Tous les guides' },
      { href: '/guides/suivi-portefeuille-boursier', label: 'Suivi de portefeuille' },
      { href: '/guides/suivi-pea', label: 'PEA et positions' },
      { href: '/guides/calcul-pru', label: 'Calcul du PRU' },
      { href: '/guides/suivi-dividendes', label: 'Dividendes' },
    ],
  },
  {
    title: 'Comparatifs',
    links: [
      { href: '/alternatives', label: 'Toutes les alternatives' },
      { href: '/alternatives/finary', label: 'Alternative à Finary' },
      { href: '/alternatives/portfolio-performance', label: 'Alternative à Portfolio Performance' },
      { href: '/alternatives/sharesight', label: 'Alternative à Sharesight' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { href: '/legal/cgu', label: 'CGU' },
      { href: '/legal/confidentialite', label: 'Confidentialité' },
      { href: '/legal/mentions-legales', label: 'Mentions légales' },
      { href: '/legal/cookies', label: 'Cookies' },
      { href: '/legal/remboursement', label: 'Remboursement' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 lg:grid-cols-[1.2fr_repeat(4,1fr)] lg:px-8">
        <div className="col-span-2 max-w-xs lg:col-span-1">
          <p className="flex items-center gap-2 text-[color:var(--text)]">
            <LogoMark className="h-5 w-5" />
            <span className="display text-xl leading-none">Fi&#8209;Hub</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            Suivi de PEA, CTO, livrets et assurances-vie, avec une performance calculée hors apports.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold text-[color:var(--text)]">{column.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[color:var(--text-2)] underline-offset-4 hover:text-[color:var(--text)] hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-[color:var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-4 text-xs text-[color:var(--text-muted)] lg:px-8">
          © {new Date().getFullYear()} Fi-Hub
        </div>
      </div>
    </footer>
  );
}
