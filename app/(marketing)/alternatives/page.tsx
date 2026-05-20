import type { Metadata } from 'next';
import { SeoIndexPage } from '@/components/marketing/SeoIndexPage';
import { alternativePages } from '@/lib/seo-pages';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export const metadata: Metadata = {
  title: 'Alternatives Finary, Portfolio Performance et Sharesight',
  description:
    'Comparez Fi-Hub aux outils de suivi de patrimoine et portefeuille : Finary, Portfolio Performance, Sharesight et tableurs.',
  alternates: { canonical: '/alternatives' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/alternatives`,
    title: 'Alternatives Fi-Hub',
    description:
      'Comparatifs pour choisir un outil de suivi portefeuille adapté aux investisseurs français.',
  },
};

export default function AlternativesPage() {
  return (
    <SeoIndexPage
      title="Alternatives et comparatifs"
      eyebrow="Comparatifs"
      description="Des comparatifs orientés investisseur particulier pour choisir un outil de suivi portefeuille adapté à vos comptes, vos dividendes et votre besoin d’export."
      href="/alternatives"
      pages={alternativePages}
      siteUrl={SITE_URL}
    />
  );
}
