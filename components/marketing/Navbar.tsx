import Link from 'next/link';
import { Logo } from './Logo';

const LINKS = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/guides', label: 'Guides' },
  { href: '/#pricing', label: 'Tarifs' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 backdrop-blur-sm">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-5 sm:gap-4 lg:px-8"
      >
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <ul className="mr-2 hidden items-center gap-6 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-[color:var(--text-2)] underline-offset-4 hover:text-[color:var(--text)] hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-[color:var(--text)] underline-offset-4 hover:underline sm:px-3"
          >
            <span className="sm:hidden">Connexion</span>
            <span className="hidden sm:inline">Se connecter</span>
          </Link>
          <Link href="/signup" className="btn-primary btn-sm whitespace-nowrap px-3! sm:px-3.5!">
            <span className="sm:hidden">Créer un compte</span>
            <span className="hidden sm:inline">Créer un compte gratuit</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
