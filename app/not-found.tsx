import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundContent } from '@/components/NotFoundContent';

export const metadata: Metadata = {
  title: 'Page introuvable',
  robots: { index: false, follow: false },
};

// 404 du site public et de toute adresse inconnue : en français, avec un retour.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-[color:var(--paper)] px-4 text-[color:var(--ink)]">
      <div className="mx-auto max-w-6xl pt-6">
        <Link href="/" className="display text-2xl leading-none text-[color:var(--ink)]">
          Fi&#8209;Hub
        </Link>
      </div>
      <NotFoundContent />
    </main>
  );
}
