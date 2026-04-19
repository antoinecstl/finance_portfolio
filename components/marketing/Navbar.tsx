import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
            <TrendingUp className="w-4 h-4" />
          </span>
          Fi-Hub
        </Link>
        <div className="flex items-center gap-1 sm:gap-4 text-sm">
          <Link
            href="/#pricing"
            className="hidden sm:inline px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900"
          >
            Tarifs
          </Link>
          <Link
            href="/login"
            className="px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Commencer
          </Link>
        </div>
      </nav>
    </header>
  );
}
