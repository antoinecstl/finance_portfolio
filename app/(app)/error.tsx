'use client';

import { useEffect } from 'react';
import { PageContainer } from '@/components/app-shell/PageLayout';
import { ErrorContent } from '@/components/ErrorContent';

// Erreur dans une page de l'application : la navigation de l'app reste affichée.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] page error', error);
  }, [error]);
  return (
    <main className="py-5 sm:py-8">
      <PageContainer>
        <ErrorContent reset={reset} digest={error.digest} />
      </PageContainer>
    </main>
  );
}
