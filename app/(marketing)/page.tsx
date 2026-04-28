import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, TrendingUp, PieChart, Wallet, ShieldCheck, BarChart2, Coins } from 'lucide-react';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FAQ } from '@/components/marketing/FAQ';
import { FAQ_ITEMS } from '@/components/marketing/faq-data';
import { PLANS } from '@/lib/plans';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export const metadata: Metadata = {
  title: 'Suivi de patrimoine PEA, CTO, livrets, AV — sans Excel',
  description:
    "Fi-Hub regroupe vos comptes (PEA, CTO, livret A, LDDS, assurance-vie, PEL) en un tableau de bord unique. Valorisation temps réel, dividendes, historique. Gratuit pour démarrer.",
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'Fi-Hub — Suivi de patrimoine PEA, CTO, AV en temps réel',
    description:
      "Regroupez tous vos comptes financiers français en un tableau de bord. Valorisation Yahoo Finance, dividendes, historique complet.",
  },
};

const features = [
  {
    icon: Wallet,
    title: 'Tous vos comptes au même endroit',
    body: 'PEA, CTO, livret A, LDDS, assurance-vie, PEL. Regroupez tout en un coup d’œil.',
  },
  {
    icon: TrendingUp,
    title: 'Valorisation en temps réel',
    body: 'Cours live Yahoo Finance sur vos actions et ETFs. Plus-values mises à jour au centime.',
  },
  {
    icon: PieChart,
    title: 'Allocations et diversification',
    body: 'Visualisez votre répartition par actif, secteur, compte. Repérez les concentrations.',
  },
  {
    icon: BarChart2,
    title: 'Historique du patrimoine',
    body: 'Courbe complète depuis votre première transaction. Performance annuelle, mensuelle.',
  },
  {
    icon: Coins,
    title: 'Module dividendes',
    body: 'Suivi des dividendes reçus, projection annuelle, rendement par position.',
  },
  {
    icon: ShieldCheck,
    title: 'Vos données, vos règles',
    body: 'Isolation stricte par utilisateur, export JSON à tout moment, suppression en un clic.',
  },
];

function buildJsonLd() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Fi-Hub',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    sameAs: [] as string[],
  };

  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Fi-Hub',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description:
      "Plateforme SaaS de suivi de patrimoine personnel : PEA, CTO, livrets, assurance-vie, dividendes, valorisation temps réel.",
    url: SITE_URL,
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'EUR',
        category: 'Free',
      },
      {
        '@type': 'Offer',
        name: 'Pro mensuel',
        price: (PLANS.pro.priceCents / 100).toFixed(2),
        priceCurrency: PLANS.pro.currency,
        category: 'Subscription',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: (PLANS.pro.priceCents / 100).toFixed(2),
          priceCurrency: PLANS.pro.currency,
          unitCode: 'MON',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
        },
      },
      ...(PLANS.pro.priceCentsYearly
        ? [
            {
              '@type': 'Offer',
              name: 'Pro annuel',
              price: (PLANS.pro.priceCentsYearly / 100).toFixed(2),
              priceCurrency: PLANS.pro.currency,
              category: 'Subscription',
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: (PLANS.pro.priceCentsYearly / 100).toFixed(2),
                priceCurrency: PLANS.pro.currency,
                unitCode: 'ANN',
                referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'ANN' },
              },
            },
          ]
        : []),
    ],
    featureList: [
      'Suivi PEA, CTO, livrets, assurance-vie',
      'Cours en temps réel via Yahoo Finance',
      'Module dividendes',
      'Historique complet du portefeuille',
      'Export CSV / JSON',
      'Analyses avancées et performance annuelle',
    ],
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Fi-Hub',
    url: SITE_URL,
    inLanguage: 'fr-FR',
  };

  return [organization, softwareApplication, faqPage, website];
}

export default function LandingPage() {
  const jsonLd = buildJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section
        className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center"
        aria-labelledby="hero-title"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium mb-6">
          <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> Suivi de patrimoine français
        </div>
        <h1
          id="hero-title"
          className="text-4xl sm:text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight"
        >
          Suivez votre patrimoine
          <br />
          <span className="text-blue-600">sans Excel.</span>
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          Fi-Hub regroupe vos PEA, CTO, livrets et assurances-vie en un tableau de bord unique.
          Valorisation en temps réel, historique complet, dividendes — sans tableur.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            Commencer gratuitement <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg"
          >
            Voir les tarifs
          </Link>
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          Gratuit pour 1 compte et 50 transactions. Aucune carte requise.
        </p>
      </section>

      <section
        id="features"
        className="max-w-6xl mx-auto px-4 py-16"
        aria-labelledby="features-title"
      >
        <h2
          id="features-title"
          className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-4"
        >
          Tout ce dont vous avez besoin pour piloter votre patrimoine
        </h2>
        <p className="text-center text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-12">
          Une vue consolidée de vos actions, ETFs, livrets et assurances-vie. Pensé pour les
          investisseurs français.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <article
              key={f.title}
              className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 mb-4">
                <f.icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{f.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <PricingSection />

      <FAQ />

      <section
        className="max-w-3xl mx-auto px-4 py-16 text-center"
        aria-labelledby="cta-title"
      >
        <h2
          id="cta-title"
          className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4"
        >
          Prêt à reprendre le contrôle de votre patrimoine ?
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Créez votre compte gratuit en 30 secondes. Sans carte bancaire, sans engagement.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
        >
          Créer mon compte <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
