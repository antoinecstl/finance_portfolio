import type { Metadata } from 'next';
import { SeoIndexPage } from '@/components/marketing/SeoIndexPage';
import { featurePages } from '@/lib/seo-pages';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export const metadata: Metadata = {
  title: 'Fonctionnalités Fi-Hub : positions, PRU, dividendes, benchmark, import',
  description:
    'Découvrez les fonctionnalités Fi-Hub pour suivre un portefeuille : positions, PRU, dividendes, benchmark, import de transactions et exports.',
  alternates: { canonical: '/fonctionnalites' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/fonctionnalites`,
    title: 'Fonctionnalités Fi-Hub',
    description:
      'Positions, PRU, dividendes, benchmark et import de transactions pour investisseurs particuliers.',
  },
};

export default function FonctionnalitesPage() {
  return (
    <SeoIndexPage
      title="Fonctionnalités Fi-Hub"
      eyebrow="Produit"
      description="Les briques utiles pour tenir un journal de portefeuille fiable : positions, cash, PRU, dividendes, benchmark, import et exports."
      href="/fonctionnalites"
      pages={featurePages}
      siteUrl={SITE_URL}
    />
  );
}
