import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketSymbolView } from '@/components/market/MarketSymbolView';
import { PageContainer } from '@/components/app-shell/PageLayout';

type Props = { params: Promise<{ symbol: string }> };

const decode = (raw: string) => {
  try {
    return decodeURIComponent(raw).toUpperCase();
  } catch {
    return raw.toUpperCase();
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${decode(symbol)} · Marchés` };
}

export default async function MarketSymbolPage({ params }: Props) {
  const { symbol } = await params;
  return (
    <main className="py-5 sm:py-8">
      <PageContainer>
        {/* useSearchParams (période dans l'URL) */}
        <Suspense fallback={null}>
          <MarketSymbolView key={decode(symbol)} symbol={decode(symbol)} />
        </Suspense>
      </PageContainer>
    </main>
  );
}
