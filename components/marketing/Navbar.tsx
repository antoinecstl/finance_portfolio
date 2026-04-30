import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[color:var(--paper)]/85 border-b border-[color:var(--rule)]">
      <nav className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-baseline gap-2 text-[color:var(--ink)] hover:opacity-80 transition-opacity"
        >
          <span className="display text-2xl leading-none">Fi&#8209;Hub</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-5 text-sm">
          <Link
            href="/#features"
            className="hidden md:inline mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors"
          >
            Fonctionnalités
          </Link>
          <Link
            href="/#pricing"
            className="hidden sm:inline mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors"
          >
            Tarifs
          </Link>
          <Link
            href="/#faq"
            className="hidden md:inline mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors"
          >
            FAQ
          </Link>
          <Link
            href="/login"
            className="px-3 py-2 text-[color:var(--ink)] hover:underline underline-offset-4 decoration-[color:var(--accent)] decoration-2"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="btn-ink inline-flex items-center px-4 py-2 rounded-full text-sm font-medium"
          >
            Commencer
          </Link>
        </div>
      </nav>
    </header>
  );
}
