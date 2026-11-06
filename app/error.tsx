'use client';

import { useEffect } from 'react';
import { ErrorContent } from '@/components/ErrorContent';

// Erreur sur une page du site public.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[site] page error', error);
  }, [error]);
  return (
    <main className="min-h-screen bg-[color:var(--paper)] px-4 text-[color:var(--ink)]">
      <ErrorContent reset={reset} digest={error.digest} />
    </main>
  );
}
