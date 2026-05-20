import type { Metadata } from 'next';
import { SeoIndexPage } from '@/components/marketing/SeoIndexPage';
import { guidePages } from '@/lib/seo-pages';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export const metadata: Metadata = {
  title: 'Guides suivi portefeuille, PEA, PRU et dividendes',
  description:
    'Guides Fi-Hub pour suivre un portefeuille boursier : PEA, PRU, dividendes, performance, benchmark et remplacement d’Excel.',
  alternates: { canonical: '/guides' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/guides`,
    title: 'Guides Fi-Hub pour mieux suivre votre portefeuille',
    description:
      'Méthodes concrètes pour suivre un PEA, calculer un PRU, mesurer les dividendes et comparer la performance au marché.',
  },
};

export default function GuidesPage() {
  return (
    <SeoIndexPage
      title="Guides de suivi portefeuille"
      eyebrow="Ressources"
      description="Des guides pratiques pour structurer votre suivi d’investissement : comptes, transactions, PRU, dividendes, performance hors apports et comparaison au marché."
      href="/guides"
      pages={guidePages}
      siteUrl={SITE_URL}
    />
  );
}
