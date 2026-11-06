import type { Metadata } from 'next';
import { PageContainer } from '@/components/app-shell/PageLayout';
import { NotFoundContent } from '@/components/NotFoundContent';

export const metadata: Metadata = { title: 'Page introuvable' };

// 404 dans l'application : affichée dans la navigation de l'app.
export default function AppNotFound() {
  return (
    <main className="py-5 sm:py-8">
      <PageContainer>
        <NotFoundContent inApp />
      </PageContainer>
    </main>
  );
}
