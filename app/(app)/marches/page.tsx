import type { Metadata } from 'next';
import { MarketHome } from '@/components/market/MarketHome';
import { PageContainer, PageHeader } from '@/components/app-shell/PageLayout';

export const metadata: Metadata = { title: 'Marchés' };

export default function MarketsPage() {
  return (
    <main className="py-5 sm:py-8">
      <PageContainer>
        <PageHeader
          title="Marchés"
          description="Cours, graphiques et statistiques des actions, ETF, indices et cryptos."
        />
        <MarketHome />
      </PageContainer>
    </main>
  );
}
