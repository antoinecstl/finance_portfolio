import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FAQ } from '@/components/marketing/FAQ';
import { FAQ_ITEMS } from '@/components/marketing/faq-data';
import { FIGURES, ProductFigure } from '@/components/marketing/ProductFigure';
import { ImportSteps } from '@/components/marketing/ImportSteps';
import { BENCHMARK_REFERENCE_COUNT, freePlanSummary } from '@/components/marketing/product-facts';
import { MONTHLY_TRIAL_LABEL, PLANS } from '@/lib/plans';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';
const SEARCH_SITE_NAME = 'Fi-Hub';
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Fi-Hub — Suivi de patrimoine PEA, CTO, livrets et assurance-vie' },
  description: `Fi-Hub suit vos PEA, CTO, livrets et assurances-vie au même endroit. Positions et PRU recalculés depuis vos transactions, performance hors apports comparée à un indice. Gratuit jusqu'à ${PLANS.free.maxAccounts} comptes.`,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SEARCH_SITE_NAME,
    title: 'Fi-Hub — Vos placements réunis. Votre performance en clair.',
    description:
      'Positions et PRU recalculés depuis vos transactions, performance hors apports face au CAC 40, au S&P 500 ou à un autre indice, dividendes et import de relevés avec Pro.',
  },
};

/* ─────────── JSON-LD ─────────── */
function buildJsonLd() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Fi-Hub',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
  };

  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Fi-Hub',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description:
      'Suivi de patrimoine personnel : PEA, CTO, livrets, assurance-vie, positions et PRU, performance hors apports comparée à un indice, dividendes, import de relevés.',
    url: SITE_URL,
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'EUR', category: 'Free' },
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
      'PEA, CTO, livrets, PEL, assurance-vie et comptes crypto',
      'Positions et PRU recalculés depuis les transactions',
      'Performance hors apports comparée à un indice',
      'Historique du patrimoine jour par jour',
      'Module dividendes (Pro)',
      'Import de relevés CSV, Excel, PDF ou captures (Pro)',
      'Export JSON et PDF',
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
    alternateName: ['fi-hub', 'Fi Hub', 'fi-hub.subleet.com'],
    url: SITE_URL,
    inLanguage: 'fr-FR',
  };

  return [organization, softwareApplication, faqPage, website];
}

/* ────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const jsonLd = buildJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ───────── Hero ───────── */}
      <section aria-labelledby="hero-title" className="mx-auto max-w-6xl px-5 pt-12 pb-16 sm:pt-16 lg:px-8 lg:pt-20 lg:pb-24">
        <div className="max-w-4xl">
          <h1
            id="hero-title"
            className="text-[34px] font-semibold leading-[1.04] tracking-[-0.03em] text-[color:var(--text)] min-[380px]:text-[40px] sm:text-[56px] lg:text-[68px]"
          >
            <span className="block">Vos placements réunis.</span>
            <span className="block">Votre performance en clair.</span>
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-[1.55] text-[color:var(--text-2)] lg:text-[19px]">
            Retrouvez vos PEA, CTO et livrets au même endroit. Distinguez vos versements de vos gains
            et comparez la performance de votre portefeuille à un indice.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/signup" className="btn-primary">
              Créer un compte gratuit
            </Link>
            <Link href="#calculs" className="link text-[15px] font-medium">
              Voir ce que Fi-Hub calcule
            </Link>
          </div>
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">{freePlanSummary()}</p>
        </div>

        <div className="mt-12 lg:mt-16">
          <ProductFigure
            figure={FIGURES.overview}
            priority
            caption="Tableau de bord : valeur totale, portefeuille actions, variation du jour, épargne et évolution sur un an."
          />
        </div>
      </section>

      {/* ───────── Ce que Fi-Hub calcule ───────── */}
      <div id="calculs" className="scroll-mt-20">
        <FeatureSection
          id="positions"
          plan="free"
          title="Chaque position recalculée à partir de vos transactions."
          body="Quantité, PRU, cours, valeur, poids dans le portefeuille et plus ou moins-value latente : Fi-Hub dérive tout de l’historique de vos achats et ventes. Si vous corrigez une opération ancienne, les positions sont recalculées."
          points={[
            'Positions regroupées par compte : PEA, CTO, assurance-vie, crypto.',
            'Liquidités suivies à part des titres. Les frais sont enregistrés avec l’opération et débités du compte.',
            'Plusieurs devises dans un même compte.',
          ]}
          link={{ href: '/fonctionnalites/positions-pru', label: 'Positions et PRU en détail' }}
          figure={
            <ProductFigure
              figure={FIGURES.positions}
              caption="Détail par position, regroupé par compte."
            />
          }
        />

        <FeatureSection
          id="benchmark"
          plan="free"
          title="Votre performance hors apports, face à un indice."
          body="Un versement fait monter la valeur d’un portefeuille sans rien dire de vos choix. Fi-Hub neutralise les apports et les retraits (méthode de Dietz modifiée), puis compare le résultat à l’indice de votre choix sur la même période."
          points={[
            `${BENCHMARK_REFERENCE_COUNT} références, dont le S&P 500, le MSCI World, Bitcoin et Ethereum, ou tout actif recherché.`,
            'Périodes d’une semaine à un an, depuis le 1er janvier ou depuis le début.',
            'Quand le portefeuille fait moins bien que l’indice, l’écart l’indique, comme dans cet exemple.',
          ]}
          link={{ href: '/fonctionnalites/benchmark', label: 'Le benchmark en détail' }}
          layout="side-right"
          figure={
            <ProductFigure
              figure={FIGURES.benchmark}
              variant="narrow"
              caption="Vue mobile : performance hors apports comparée au CAC 40 depuis le 1er janvier."
            />
          }
        />

        <FeatureSection
          id="dividendes"
          plan="pro"
          title="Ce que vos dividendes rapportent, rapporté à votre prix d’achat."
          body="Chaque dividende est rattaché à son titre. Fi-Hub en tire le total reçu, le nombre de versements, le montant moyen par action et le rendement sur coût, année par année."
          points={[
            'Évolution des dividendes par année.',
            'Rendement sur coût par action, calculé sur votre PRU.',
            'Historique détaillé de chaque versement.',
          ]}
          link={{ href: '/fonctionnalites/dividendes', label: 'Le module dividendes en détail' }}
          layout="side-left"
          figure={
            <ProductFigure
              figure={FIGURES.dividends}
              variant="narrow"
              caption="Vue mobile : totaux, évolution par année et rendement sur coût."
            />
          }
        />
      </div>

      {/* ───────── Import (Pro) ───────── */}
      <section
        id="import"
        aria-labelledby="import-title"
        className="border-t border-[color:var(--border)]"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-4">
              <PlanLabel plan="pro" />
              <h2
                id="import-title"
                className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-4xl"
              >
                Importez un relevé, vérifiez chaque ligne, puis validez.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[color:var(--text-2)]">
                Pour reprendre un historique sans tout ressaisir. {MONTHLY_TRIAL_LABEL} avec l’offre
                Pro mensuelle.
              </p>
              <div className="mt-6 flex flex-col items-start gap-3 text-[15px]">
                <Link href="/fonctionnalites/import-transactions" className="link font-medium">
                  L’import en détail
                </Link>
                <Link href="#pricing" className="link font-medium">
                  Voir l’offre Pro
                </Link>
              </div>
            </div>

            <div className="lg:col-span-8">
              <ImportSteps />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Ce que Fi-Hub fait, et ne fait pas ───────── */}
      <section aria-labelledby="scope-title" className="border-t border-[color:var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <h2
            id="scope-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-4xl"
          >
            Ce que Fi-Hub fait, et ce qu’il ne fait pas.
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-12">
            <ScopeList
              title="Ce que Fi-Hub fait"
              icon="yes"
              items={[
                'Suit les PEA, CTO, livrets A et LDDS, PEL, assurances-vie, comptes crypto et autres comptes.',
                'Valorise vos titres avec des cours de marché actualisés automatiquement.',
                'Reconstruit l’historique de votre patrimoine jour par jour.',
                'Exporte vos comptes et transactions en JSON, et un relevé en PDF, à tout moment.',
                'Supprime votre compte et vos données depuis les paramètres.',
              ]}
            />
            <ScopeList
              title="Ce que Fi-Hub ne fait pas"
              icon="no"
              items={[
                'Pas de connexion à votre banque ou à votre courtier : vous saisissez ou importez vos opérations.',
                'Pas de conseil en investissement : Fi-Hub mesure, il ne recommande rien.',
                'Pas de publicité ni de traceur publicitaire.',
              ]}
            />
          </div>
          <p className="mt-10 max-w-[68ch] text-sm leading-relaxed text-[color:var(--text-muted)]">
            Chaque utilisateur n’a accès qu’à ses propres données : cette séparation est appliquée par
            la base de données elle-même, à chaque requête.
          </p>
        </div>
      </section>

      <PricingSection />

      <FAQ />

      {/* ───────── Conclusion ───────── */}
      <section aria-labelledby="cta-title" className="border-t border-[color:var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <h2
            id="cta-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-4xl"
          >
            Commencez avec vos comptes actuels.
          </h2>
          <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-[color:var(--text-2)] lg:text-lg">
            Ajoutez un premier compte et quelques transactions : positions, PRU et performance se
            calculent aussitôt. Vos données restent exportables à tout moment.
          </p>
          <div className="mt-8">
            <Link href="/signup" className="btn-primary">
              Créer un compte gratuit
            </Link>
          </div>
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">{freePlanSummary()}</p>
        </div>
      </section>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */

function PlanLabel({ plan }: { plan: 'free' | 'pro' }) {
  return (
    <p className="text-[13px] font-medium text-[color:var(--text-muted)]">
      {plan === 'free' ? 'Inclus dans l’offre Free' : 'Offre Pro'}
    </p>
  );
}

function FeatureSection({
  id,
  plan,
  title,
  body,
  points,
  link,
  figure,
  layout = 'stacked',
}: {
  id: string;
  plan: 'free' | 'pro';
  title: string;
  body: string;
  points: string[];
  link: { href: string; label: string };
  figure: React.ReactNode;
  // stacked: wide capture below the text. side-*: narrow capture beside it.
  layout?: 'stacked' | 'side-right' | 'side-left';
}) {
  const titleId = `${id}-title`;
  const heading = (
    <>
      <PlanLabel plan={plan} />
      <h2
        id={titleId}
        className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-4xl"
      >
        {title}
      </h2>
    </>
  );
  const details = (
    <>
      <p className="text-base leading-relaxed text-[color:var(--text-2)] lg:text-[17px]">{body}</p>
      <ul className="mt-6 border-t border-[color:var(--border)]">
        {points.map((point) => (
          <li
            key={point}
            className="border-b border-[color:var(--border)] py-3 text-[15px] leading-snug text-[color:var(--text-2)]"
          >
            {point}
          </li>
        ))}
      </ul>
      <Link href={link.href} className="link mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium">
        {link.label}
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </>
  );

  if (layout === 'stacked') {
    return (
      <section id={id} aria-labelledby={titleId} className="scroll-mt-20 border-t border-[color:var(--border)]">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">{heading}</div>
            <div className="lg:col-span-6 lg:col-start-7">{details}</div>
          </div>
          <div className="mt-12">{figure}</div>
        </div>
      </section>
    );
  }

  const figureLeft = layout === 'side-left';
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-20 border-t border-[color:var(--border)]">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:py-24">
        <div className={`lg:col-span-6 ${figureLeft ? 'lg:col-start-7 lg:row-start-1' : ''}`}>
          {heading}
          <div className="mt-6">{details}</div>
        </div>
        <div className={`lg:col-span-5 ${figureLeft ? 'lg:col-start-1 lg:row-start-1' : 'lg:col-start-8'}`}>
          {figure}
        </div>
      </div>
    </section>
  );
}

function ScopeList({ title, items, icon }: { title: string; items: string[]; icon: 'yes' | 'no' }) {
  const Icon = icon === 'yes' ? Check : Minus;
  return (
    <div>
      <h3 className="text-xl font-semibold leading-[1.3] text-[color:var(--text)]">{title}</h3>
      <ul className="mt-4 border-t border-[color:var(--border)]">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 border-b border-[color:var(--border)] py-3 text-[15px] leading-snug text-[color:var(--text-2)]"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--text-muted)]" strokeWidth={1.75} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
