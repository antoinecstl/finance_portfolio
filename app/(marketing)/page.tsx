import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  FileSpreadsheet,
  Sparkles,
  Receipt,
  LineChart,
  History,
  FileText,
  Lock,
  Coins,
  Check,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PricingSection } from '@/components/marketing/PricingSection';
import { FAQ } from '@/components/marketing/FAQ';
import { FAQ_ITEMS } from '@/components/marketing/faq-data';
import { getStockQuotes } from '@/lib/stock-api';
import { PLANS } from '@/lib/plans';
import type { StockQuote } from '@/lib/types';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Suivi de patrimoine PEA, CTO, livrets, AV — sans Excel',
  description:
    "Fi-Hub regroupe vos comptes (PEA, CTO, livret A, LDDS, assurance-vie, PEL) en un tableau de bord unique. Valorisation temps réel, dividendes, import en un clic, comparaison vs CAC 40. Gratuit pour démarrer.",
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'Fi-Hub — Le journal de votre patrimoine, tenu en temps réel',
    description:
      "Regroupez tous vos comptes français. Import en un clic, valorisation Yahoo Finance, dividendes, benchmark CAC 40 / S&P 500.",
  },
};

/* ─────────── Ticker tape data (fallback, rafraîchi via Yahoo Finance) ─────────── */
type TickerItem = {
  sym: string;
  yahoo: string;
  val: string;
  delta: string;
  up: boolean;
};

const TICKER: TickerItem[] = [
  { sym: 'CAC 40', yahoo: '^FCHI', val: '7 924,12', delta: '+0,42%', up: true },
  { sym: 'S&P 500', yahoo: '^GSPC', val: '5 287,40', delta: '+0,18%', up: true },
  { sym: 'MC.PA', yahoo: 'MC.PA', val: '702,30', delta: '−0,51%', up: false },
  { sym: 'ASML.AS', yahoo: 'ASML.AS', val: '987,60', delta: '+1,24%', up: true },
  { sym: 'CW8.PA', yahoo: 'CW8.PA', val: '631,84', delta: '+0,33%', up: true },
  { sym: 'AAPL', yahoo: 'AAPL', val: '224,18', delta: '+0,07%', up: true },
  { sym: 'BNP.PA', yahoo: 'BNP.PA', val: '64,12', delta: '−0,22%', up: false },
  { sym: 'AIR.PA', yahoo: 'AIR.PA', val: '178,94', delta: '+0,68%', up: true },
  { sym: 'TTE.PA', yahoo: 'TTE.PA', val: '60,28', delta: '+0,15%', up: true },
  { sym: 'NVDA', yahoo: 'NVDA', val: '887,40', delta: '+1,92%', up: true },
];

const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
});

function formatTickerPercent(value: number) {
  return `${PERCENT_FORMATTER.format(value).replace('-', '−')}%`;
}

function tickerQuoteKey(symbol: string) {
  return symbol.toUpperCase();
}

function buildTickerItem(item: TickerItem, quote?: StockQuote): TickerItem {
  if (!quote || quote.price <= 0) return item;

  return {
    ...item,
    val: NUMBER_FORMATTER.format(quote.price),
    delta: formatTickerPercent(quote.changePercent),
    up: quote.changePercent >= 0,
  };
}

async function getTickerTape(): Promise<TickerItem[]> {
  try {
    const quotes = await getStockQuotes(TICKER.map((item) => item.yahoo));
    const quotesBySymbol = new Map(
      quotes.map((quote) => [tickerQuoteKey(quote.symbol), quote])
    );

    return TICKER.map((item) =>
      buildTickerItem(item, quotesBySymbol.get(tickerQuoteKey(item.yahoo)))
    );
  } catch (error) {
    console.error('Marketing ticker refresh failed:', error);
    return TICKER;
  }
}

const ENVELOPES = ['PEA', 'PEA-PME', 'CTO', 'Assurance-vie', 'Livret A', 'LDDS', 'PEL', 'CEL'];

/* ─────────── JSON-LD ─────────── */
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
      "Plateforme SaaS de suivi de patrimoine personnel : PEA, CTO, livrets, assurance-vie, dividendes, valorisation temps réel, import de transactions, benchmark.",
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
      'Suivi PEA, CTO, livrets, assurance-vie',
      'Cours en temps réel via Yahoo Finance',
      'Module dividendes',
      'Historique complet du portefeuille',
      'Import de transactions avec reconnaissance de tickers',
      'Comparaison vs indices (CAC 40, S&P 500)',
      'Export CSV / JSON / PDF',
      'Frais de transaction de première classe',
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

/* ────────────────────────────────────────────────────────── */

export default async function LandingPage() {
  const jsonLd = buildJsonLd();
  const ticker = await getTickerTape();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ───────── TICKER TAPE ───────── */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-b border-[color:var(--rule)] bg-[color:var(--paper-2)]/60"
      >
        <div className="ticker-track flex whitespace-nowrap py-2 mono text-[11px]">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-5">
              <span className="text-[color:var(--ink-soft)] tracking-[0.16em]">{t.sym}</span>
              <span className="text-[color:var(--ink)]">{t.val}</span>
              <span style={{ color: t.up ? 'var(--gain)' : 'var(--accent)' }}>{t.delta}</span>
              <span className="text-[color:var(--rule)]">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ───────── HERO ───────── */}
      <section
        className="relative max-w-6xl mx-auto px-5 pt-14 pb-20 sm:pt-20 sm:pb-28"
        aria-labelledby="hero-title"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Editorial column */}
          <div className="lg:col-span-7 pop-in">
            <div className="flex items-center gap-3 mb-7">
            </div>

            <h1
              id="hero-title"
              className="display text-[44px] sm:text-[64px] lg:text-[78px] leading-[0.95] text-[color:var(--ink)]"
            >
              Votre patrimoine
              <br />
              <span className="display-italic">mérite mieux</span>
              <br />
              qu&apos;un{' '}
              <span className="ink-mark text-[color:var(--paper)]">tableur.</span>
            </h1>

            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-[color:var(--ink-2)]">
              Fi-Hub tient le journal de tout ce que vous possédez. PEA, CTO,
              livrets, assurance-vie, dividendes&nbsp;— réunis en un outil,
              valorisés en direct, toujours face au marché.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="btn-ink inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] font-medium"
              >
                Ouvrir mon journal — c&apos;est gratuit
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href="#features"
                className="btn-outline inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] font-medium"
              >
                Voir ce qu&apos;il y a dedans
              </Link>
            </div>

            <p className="mt-5 mono text-[11px] tracking-[0.14em] uppercase text-[color:var(--ink-soft)]">
              Sans carte bancaire · 1 compte &amp; 50 transactions offerts
            </p>

            {/* Hero stats — editorial KPI strip */}
            <dl className="mt-12 grid grid-cols-3 gap-6 sm:gap-10 max-w-lg pt-6 rule-top">
              <div>
                <dt className="eyebrow">Cours</dt>
                <dd className="display text-2xl mt-1">Temps réel</dd>
              </div>
              <div>
                <dt className="eyebrow">Enveloppes</dt>
                <dd className="display text-2xl mt-1">8+ supports</dd>
              </div>
              <div>
                <dt className="eyebrow">Export & Import</dt>
                <dd className="display text-2xl mt-1">PDF · CSV · JSON...</dd>
              </div>
            </dl>
          </div>

          {/* Mockup column */}
          <div className="lg:col-span-5 lg:pl-2">
            <PortfolioMockup />
          </div>
        </div>
      </section>

      {/* ───────── KILLER FEATURE: IMPORT ───────── */}
      <section
        id="features"
        aria-labelledby="features-title"
        className="max-w-6xl mx-auto px-5 pt-24 pb-12"
      >
        <div className="flex items-baseline justify-between gap-4 mb-10">
          <div>
            <h2
              id="features-title"
              className="display text-4xl sm:text-5xl mt-2 leading-tight"
            >
              Saisissez moins,{' '}
              <span className="display-italic">suivez plus.</span>
            </h2>
          </div>
          <span className="mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--ink-soft)] hidden sm:inline">
            §&nbsp;01 — &nbsp;Import
          </span>
        </div>

        <article className="ink-card rounded-2xl pop-shadow overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-[color:var(--rule)]">
            <div className="inline-flex items-center gap-2 mono text-[11px] tracking-[0.16em] uppercase text-[color:var(--accent)] mb-5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Nouveau · 2026
            </div>
            <h3 className="display text-3xl leading-tight mb-4">
              Import en un clic, tickers reconnus pour vous.
            </h3>
            <p className="text-[15px] leading-relaxed text-[color:var(--ink-2)] mb-6">
              Glissez votre relevé Bourse Direct, Boursorama, Trade Republic ou Degiro.
              Fi-Hub lit le PDF ou le CSV, mappe les ISIN aux tickers Yahoo, contrôle
              la cohérence, et vous laisse valider chaque ligne — frais inclus.
            </p>
            <ul className="space-y-2.5 text-sm text-[color:var(--ink-2)]">
              {[
                'Reconnaissance ISIN → ticker (validation de cohérence)',
                'Garde-fous : pas de cash ni de positions négatifs',
                'Frais détectés et liés à la transaction parente',
                'Édition ligne par ligne avant import définitif',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: 'var(--gain)' }}
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7 p-6 sm:p-8 bg-[color:var(--paper)]">
            <ImportMockup />
          </div>
        </article>
      </section>

      {/* ───────── KILLER FEATURE: BENCHMARK ───────── */}
      <section className="max-w-6xl mx-auto px-5 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <BenchmarkMockup />
          </div>
          <div className="lg:col-span-5 order-1 lg:order-2">
            <span className="eyebrow">§&nbsp;02 — Benchmark</span>
            <h3 className="display text-3xl sm:text-4xl mt-3 leading-tight">
              Battre le marché ?{' '}
              <span className="display-italic">Vraiment ?</span>
            </h3>
            <p className="mt-5 text-[15px] leading-relaxed text-[color:var(--ink-2)]">
              Superposez votre courbe à celle du CAC 40, du S&amp;P 500 ou d&apos;un
              ETF Monde. La performance brute n&apos;a aucun sens sans référence —
              Fi-Hub vous donne la réponse honnête, en alpha, sur la période exacte
              de vos transactions.
            </p>
            <p className="mt-3 text-sm text-[color:var(--ink-soft)] mono tracking-wide">
              CAC 40 · S&amp;P 500 · MSCI World · Nasdaq 100
            </p>
          </div>
        </div>
      </section>

      {/* ───────── FEATURE GRID — magazine columns ───────── */}
      <section
        aria-label="Toutes les fonctionnalités"
        className="max-w-6xl mx-auto px-5 py-16"
      >
        <div className="flex items-baseline justify-between mb-10">
          <h3 className="display text-3xl sm:text-4xl leading-tight">
            Et tout le reste, fait sérieusement.
          </h3>
          <span className="eyebrow hidden sm:inline">§&nbsp;03 — Fonctionnalités</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-px bg-[color:var(--rule)] border border-[color:var(--rule)] rounded-2xl overflow-hidden">
          <FeatureCell
            span="md:col-span-3"
            num="01"
            icon={Coins}
            title="Module dividendes"
            body="Versements reçus, projection annuelle, rendement par position. Le DRIP n'est plus un mystère."
          />
          <FeatureCell
            span="md:col-span-3"
            num="02"
            icon={Receipt}
            title="Frais de transaction de première classe"
            badge="Nouveau"
            body="Chaque achat porte ses frais — créés, édités et supprimés atomiquement avec leur transaction parente."
          />
          <FeatureCell
            span="md:col-span-2"
            num="03"
            icon={History}
            title="Snapshots quotidiens"
            body="Une photo de votre patrimoine chaque jour, automatiquement. Comparez n'importe quelle période."
          />
          <FeatureCell
            span="md:col-span-2"
            num="04"
            icon={FileText}
            title="Export PDF, CSV, JSON"
            body="Pour votre comptable, votre conjoint, ou simplement pour partir : vos données vous suivent."
          />
          <FeatureCell
            span="md:col-span-2"
            num="05"
            icon={Lock}
            title="Sécurité par défaut"
            body="Row-Level Security Postgres, transactions atomiques, validation Zod. Vos données ne fuient pas."
          />
        </div>
      </section>

      {/* ───────── COMPARISON: Fi-Hub vs Excel ───────── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="ink-card rounded-2xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[color:var(--rule)]">
            <ComparisonColumn
              eyebrow="Avant"
              title="Excel, le dimanche soir"
              icon={FileSpreadsheet}
              accent={false}
              items={[
                { ok: false, t: 'Cours saisis à la main, jamais à jour' },
                { ok: false, t: 'Une formule cassée et tout part' },
                { ok: false, t: 'Frais oubliés, PRU faux' },
                { ok: false, t: 'Aucune comparaison vs marché' },
                { ok: false, t: '« Combien j\'ai vraiment ? » → 30 minutes' },
              ]}
            />
            <ComparisonColumn
              eyebrow="Après"
              title="Fi-Hub, en 30 secondes"
              icon={LineChart}
              accent
              items={[
                { ok: true, t: 'Cours Yahoo Finance, en direct' },
                { ok: true, t: 'Triggers Postgres : impossible de casser la séquence' },
                { ok: true, t: 'Frais auto-attachés, PRU recalculé' },
                { ok: true, t: 'Alpha vs CAC 40 / S&P / MSCI World' },
                { ok: true, t: '« Combien j\'ai vraiment ? » → un coup d\'œil' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="flex items-baseline justify-between mb-12">
          <h3 className="display text-3xl sm:text-4xl leading-tight">
            Trois pas, et puis c&apos;est <span className="display-italic">plié.</span>
          </h3>
          <span className="eyebrow hidden sm:inline">§&nbsp;04 — Démarrer</span>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--rule)] border border-[color:var(--rule)] rounded-2xl overflow-hidden">
          {[
            {
              n: '01',
              t: 'Créez votre compte',
              b: 'Email + mot de passe. Trente secondes. Aucune carte bancaire demandée.',
            },
            {
              n: '02',
              t: 'Ajoutez ou importez',
              b: 'Tapez vos comptes, ou collez un relevé broker. Fi-Hub fait le reste.',
            },
            {
              n: '03',
              t: 'Reprenez le contrôle',
              b: 'Tableau de bord, dividendes, benchmark, exports — tout est là.',
            },
          ].map((s) => (
            <li key={s.n} className="bg-[color:var(--paper)] p-8">
              <div className="display-italic display text-5xl text-[color:var(--accent)] leading-none mb-4">
                {s.n}
              </div>
              <h4 className="display text-2xl mb-2">{s.t}</h4>
              <p className="text-sm text-[color:var(--ink-2)] leading-relaxed">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── PRICING ───────── */}
      <PricingSection />

      {/* ───────── FAQ ───────── */}
      <FAQ />

      {/* ───────── FINAL CTA — editorial closer ───────── */}
      <section className="max-w-5xl mx-auto px-5 py-24 text-center" aria-labelledby="cta-title">
        <h2
          id="cta-title"
          className="display text-4xl sm:text-6xl mt-4 leading-[1.02] text-[color:var(--ink)]"
        >
          Le prochain dimanche soir,
          <br />
          <span className="display-italic">vous n&apos;ouvrirez pas Excel.</span>
        </h2>
        <p className="mt-6 text-[color:var(--ink-2)] max-w-xl mx-auto">
          Créez votre compte en 30 secondes. Importez votre patrimoine en un clic.
          Annulez quand vous voulez — vos données partent avec vous.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="btn-ink inline-flex items-center gap-2 px-7 py-4 rounded-full text-base font-medium"
          >
            Créer mon journal
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="#pricing"
            className="btn-outline inline-flex items-center gap-2 px-7 py-4 rounded-full text-base font-medium"
          >
            Comparer les offres
          </Link>
        </div>
      </section>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/*                       SUB-COMPONENTS                        */
/* ────────────────────────────────────────────────────────── */

function FeatureCell({
  num,
  icon: Icon,
  title,
  body,
  badge,
  span = '',
}: {
  num: string;
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
  span?: string;
}) {
  return (
    <article className={`relative bg-[color:var(--paper)] p-7 ${span}`}>
      <div className="flex items-center justify-between mb-5">
        <span className="mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)]">
          {num}
        </span>
        {badge && (
          <span
            className="mono text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-sm"
            style={{ background: 'var(--accent)', color: 'var(--paper)' }}
          >
            {badge}
          </span>
        )}
      </div>
      <Icon className="w-5 h-5 text-[color:var(--ink)] mb-4" aria-hidden="true" />
      <h4 className="display text-xl leading-snug mb-2 text-[color:var(--ink)]">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-[color:var(--ink-2)]">{body}</p>
    </article>
  );
}

function ComparisonColumn({
  eyebrow,
  title,
  icon: Icon,
  items,
  accent,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  items: { ok: boolean; t: string }[];
  accent: boolean;
}) {
  return (
    <div className="p-8 sm:p-10 bg-[color:var(--paper)]">
      <div className="flex items-center gap-3 mb-5">
        <Icon
          className="w-5 h-5"
          style={{ color: accent ? 'var(--gain)' : 'var(--ink-soft)' }}
        />
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <h4 className="display text-2xl sm:text-3xl mb-6 leading-tight">
        {title}
      </h4>
      <ul className="space-y-3">
        {items.map((it, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-[15px] text-[color:var(--ink-2)]"
          >
            {it.ok ? (
              <Check
                className="w-4 h-4 mt-1 shrink-0"
                style={{ color: 'var(--gain)' }}
                aria-hidden="true"
              />
            ) : (
              <X
                className="w-4 h-4 mt-1 shrink-0"
                style={{ color: 'var(--accent)' }}
                aria-hidden="true"
              />
            )}
            <span className={it.ok ? '' : 'line-through opacity-70'}>{it.t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Hero portfolio mockup ─── */
function PortfolioMockup() {
  // Synthetic curve points (positive trend)
  const points = [
    [0, 145],
    [22, 122],
    [44, 122],
    [66, 110],
    [88, 106],
    [110, 96],
    [132, 100],
    [154, 84],
    [176, 83],
    [198, 70],
    [220, 70],
    [242, 56],
    [264, 74],
    [286, 54],
    [308, 38],
    [330, 18],
  ];
  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');

  return (
    <div className="relative">
      <div className="ink-card rounded-2xl pop-shadow overflow-hidden grain relative">
        {/* Header strip */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--rule)] bg-[color:var(--paper)]">
          <div className="flex items-center gap-2">
            <span className="block w-2 h-2 rounded-full" style={{ background: 'var(--gain)' }} />
            <span className="mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)]">
              Patrimoine total
            </span>
          </div>
        </div>

        {/* KPI block */}
        <div className="px-5 sm:px-7 pt-6 pb-4">
          <div className="display text-4xl sm:text-5xl leading-none">
            142&nbsp;580<span className="text-[color:var(--ink-soft)]">,42&nbsp;€</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 mono text-[12px] font-medium"
              style={{ color: 'var(--gain)' }}
            >
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              +12,4 % YTD
            </span>
            <span className="text-[color:var(--rule)]">·</span>
            <span className="mono text-[11px] text-[color:var(--ink-soft)]">
              vs CAC 40 +6,8 %
            </span>
          </div>

          {/* Sparkline */}
          <svg
            viewBox="0 0 330 140"
            className="w-full mt-4 h-24"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--gain)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid */}
            {[0, 35, 70, 105].map((y) => (
              <line
                key={y}
                x1="0"
                x2="330"
                y1={y}
                y2={y}
                stroke="var(--rule)"
                strokeDasharray="2 4"
                strokeWidth="0.5"
              />
            ))}
            {/* Filled area */}
            <path
              d={`${path} L330,140 L0,140 Z`}
              fill="url(#fill)"
              opacity="0.85"
            />
            {/* Line */}
            <path
              d={path}
              fill="none"
              stroke="var(--gain)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="spark-path"
            />
            {/* End dot */}
            <circle cx="330" cy="18" r="3.5" fill="var(--gain)" />
            <circle cx="330" cy="18" r="6" fill="var(--gain)" opacity="0.25" />
          </svg>
        </div>

        {/* Allocation rows */}
        <div className="px-5 sm:px-7 pb-5">
          <div className="mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)] mb-3">
            Allocation par enveloppe
          </div>
          {[
            { lbl: 'PEA · ETF Monde', pct: 58, val: '82 696,64', color: 'var(--ink)' },
            { lbl: 'CTO · US Tech', pct: 24, val: '34 219,30', color: 'var(--accent)' },
            { lbl: 'Assurance-vie', pct: 12, val: '17 109,65', color: 'var(--gain)' },
            { lbl: 'Livret A · LDDS', pct: 6, val: '8 554,83', color: 'var(--ink-soft)' },
          ].map((row) => (
            <div key={row.lbl} className="flex items-center gap-3 py-1.5">
              <span className="text-[13px] text-[color:var(--ink-2)] flex-1 truncate">
                {row.lbl}
              </span>
              <div className="flex-1 h-1 max-w-[100px] bg-[color:var(--rule)] overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${row.pct}%`, background: row.color }}
                />
              </div>
              <span className="mono text-[12px] text-[color:var(--ink)] tabular-nums">
                {row.val}&nbsp;€
              </span>
            </div>
          ))}
        </div>

        {/* Holdings ticker rows */}
        <div className="border-t border-[color:var(--rule)] bg-[color:var(--paper-2)]/50">
          {[
            { sym: 'CW8.PA', name: 'Amundi MSCI World', qty: '124', px: '631,84', d: '+0,33%', up: true },
            { sym: 'ASML.AS', name: 'ASML Holding', qty: '8', px: '987,60', d: '+1,24%', up: true },
            { sym: 'MC.PA', name: 'LVMH', qty: '14', px: '702,30', d: '−0,51%', up: false },
          ].map((h) => (
            <div
              key={h.sym}
              className="flex items-center gap-3 px-5 sm:px-7 py-2.5 border-b last:border-b-0 border-[color:var(--rule)]"
            >
              <div className="flex flex-col min-w-[88px]">
                <span className="mono text-[12px] font-medium text-[color:var(--ink)]">
                  {h.sym}
                </span>
                <span className="text-[10px] text-[color:var(--ink-soft)] truncate">
                  {h.name}
                </span>
              </div>
              <span className="mono text-[11px] text-[color:var(--ink-soft)] flex-1">
                ×&nbsp;{h.qty}
              </span>
              <span className="mono text-[12px] text-[color:var(--ink)] tabular-nums">
                {h.px}&nbsp;€
              </span>
              <span
                className="mono text-[11px] tabular-nums w-[60px] text-right"
                style={{ color: h.up ? 'var(--gain)' : 'var(--accent)' }}
              >
                {h.d}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Import wizard mockup ─── */
function ImportMockup() {
  const rows = [
    { d: '12/04', t: 'BUY', sym: 'CW8.PA', q: '12', px: '628,40', match: 'good' },
    { d: '03/04', t: 'BUY', sym: 'ASML', q: '2', px: '982,10', match: 'good' },
    { d: '28/03', t: 'DIV', sym: 'TTE.PA', q: '—', px: '14,32', match: 'good' },
    { d: '15/03', t: 'BUY', sym: '???', q: '5', px: '210,00', match: 'warn' },
    { d: '02/03', t: 'SELL', sym: 'AIR.PA', q: '4', px: '171,50', match: 'good' },
  ] as const;

  return (
    <div className="relative">
      {/* file pill */}
      <div className="inline-flex items-center gap-2 mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--rule)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)] mb-4">
        <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
        releve_bourse_direct_2026Q1.pdf
      </div>

      <div className="ink-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-[44px_56px_1fr_44px_88px_92px] gap-2 px-4 py-2.5 bg-[color:var(--paper-2)] border-b border-[color:var(--rule)]">
          {['Date', 'Type', 'Symbole', 'Qté', 'Prix', 'Statut'].map((h) => (
            <span
              key={h}
              className="mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--ink-soft)]"
            >
              {h}
            </span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[44px_56px_1fr_44px_88px_92px] gap-2 px-4 py-2.5 border-b last:border-b-0 border-[color:var(--rule)] items-center"
          >
            <span className="mono text-[11px] text-[color:var(--ink-soft)]">{r.d}</span>
            <span
              className="mono text-[10px] tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-sm w-fit"
              style={{
                background:
                  r.t === 'BUY'
                    ? 'var(--gain-soft)'
                    : r.t === 'SELL'
                      ? 'var(--loss-soft)'
                      : 'var(--paper-2)',
                color:
                  r.t === 'BUY'
                    ? 'var(--gain)'
                    : r.t === 'SELL'
                      ? 'var(--accent)'
                      : 'var(--ink-2)',
              }}
            >
              {r.t}
            </span>
            <span className="mono text-[12px] font-medium text-[color:var(--ink)]">
              {r.sym}
            </span>
            <span className="mono text-[11px] text-[color:var(--ink-2)] tabular-nums">
              {r.q}
            </span>
            <span className="mono text-[12px] tabular-nums text-[color:var(--ink)]">
              {r.px} €
            </span>
            {r.match === 'good' ? (
              <span
                className="mono text-[10px] tracking-[0.12em] uppercase inline-flex items-center gap-1"
                style={{ color: 'var(--gain)' }}
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                Mappé
              </span>
            ) : (
              <span
                className="mono text-[10px] tracking-[0.12em] uppercase inline-flex items-center gap-1"
                style={{ color: 'var(--accent)' }}
              >
                à vérifier
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-[color:var(--ink-soft)]">
        <span className="mono">
          5 lignes lues · 4 mappées · <span style={{ color: 'var(--accent)' }}>1 à valider</span>
        </span>
        <span
          className="mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          Importer ✓
        </span>
      </div>
    </div>
  );
}

/* ─── Benchmark line chart mockup ─── */
function BenchmarkMockup() {
  // Two synthetic curves — Fi-Hub portfolio outperforming CAC 40
  const me = [
    [0, 110],
    [40, 105],
    [80, 100],
    [120, 92],
    [160, 88],
    [200, 78],
    [240, 70],
    [280, 64],
    [320, 50],
    [360, 46],
    [400, 36],
  ];
  const idx = [
    [0, 110],
    [40, 108],
    [80, 104],
    [120, 102],
    [160, 96],
    [200, 94],
    [240, 88],
    [280, 86],
    [320, 80],
    [360, 78],
    [400, 74],
  ];
  const toPath = (pts: number[][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  return (
    <div className="ink-card rounded-2xl overflow-hidden pop-shadow">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--rule)] bg-[color:var(--paper)]">
        <div className="flex items-center gap-4">
          <span className="mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)]">
            Performance · 12 mois
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] mono tracking-[0.14em] uppercase">
          <span className="inline-flex items-center gap-1.5">
            <span className="block w-3 h-px" style={{ background: 'var(--gain)' }} />
            Mon portefeuille
          </span>
          <span className="inline-flex items-center gap-1.5 text-[color:var(--ink-soft)]">
            <span
              className="block w-3 border-t border-dashed"
              style={{ borderColor: 'var(--ink-soft)' }}
            />
            CAC 40
          </span>
        </div>
      </div>
      <div className="p-5 sm:p-7 bg-[color:var(--paper)]">
        <div className="flex items-baseline gap-6 mb-3">
          <div>
            <div className="display text-3xl">
              +12,4&nbsp;<span className="text-[color:var(--ink-soft)]">%</span>
            </div>
            <div className="mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--ink-soft)] mt-0.5">
              vous
            </div>
          </div>
          <div>
            <div className="display text-3xl text-[color:var(--ink-soft)]">
              +6,8&nbsp;%
            </div>
            <div className="mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--ink-soft)] mt-0.5">
              cac 40
            </div>
          </div>
          <div className="ml-auto text-right">
            <div
              className="display text-2xl"
              style={{ color: 'var(--gain)' }}
            >
              +5,6 pts
            </div>
            <div className="mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--ink-soft)] mt-0.5">
              alpha
            </div>
          </div>
        </div>

        <svg
          viewBox="0 0 400 130"
          className="w-full h-40"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          {[20, 50, 80, 110].map((y) => (
            <line
              key={y}
              x1="0"
              x2="400"
              y1={y}
              y2={y}
              stroke="var(--rule)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          ))}
          {/* Index */}
          <path
            d={toPath(idx)}
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
          {/* Portfolio */}
          <path
            d={toPath(me)}
            fill="none"
            stroke="var(--gain)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="spark-path"
          />
          <circle cx="400" cy="36" r="4" fill="var(--gain)" />
        </svg>

        <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-[color:var(--rule)]">
          {['1 sem.', '1 mois', '6 mois', '12 mois'].map((p, i) => (
            <button
              key={p}
              type="button"
              tabIndex={-1}
              aria-disabled="true"
              className={`mono text-[10px] tracking-[0.14em] uppercase py-1.5 rounded ${
                i === 3
                  ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                  : 'text-[color:var(--ink-soft)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
