import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd, buildBreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import { PruCalculator } from '@/components/marketing/PruCalculator';
import { freePlanSummary } from '@/components/marketing/product-facts';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';
const PATH = '/outils/calcul-pru';

export const metadata: Metadata = {
  title: 'Calculateur de PRU : prix de revient unitaire d’une action ou d’un ETF',
  description:
    'Calculez gratuitement le PRU d’une action ou d’un ETF après plusieurs achats et ventes, frais inclus, et votre plus-value latente. Sans inscription.',
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}${PATH}`,
    title: 'Calculateur de PRU gratuit',
    description: 'PRU frais inclus après plusieurs achats et ventes, plus-value latente et réalisée. Sans inscription.',
  },
};

const FAQ = [
  {
    q: 'Comment se calcule le PRU ?',
    a: 'Le prix de revient unitaire est le coût total de vos achats, frais de courtage inclus, divisé par le nombre de titres détenus. Avec 10 titres achetés 100 € puis 15 titres achetés 84 €, le PRU est (10 × 100 + 15 × 84) ÷ 25 = 90,40 €, avant frais.',
  },
  {
    q: 'Une vente change-t-elle mon PRU ?',
    a: 'Non. Avec la méthode du coût moyen pondéré, utilisée par les courtiers français, une vente réduit la quantité détenue mais laisse le PRU inchangé. Elle dégage une plus ou moins-value égale à l’écart entre le prix de vente et le PRU. Seul un nouvel achat fait évoluer le PRU.',
  },
  {
    q: 'Faut-il inclure les frais de courtage ?',
    a: 'Oui pour connaître votre vrai prix de revient : les frais d’achat s’ajoutent au coût des titres. Certains courtiers affichent un PRU hors frais, ce qui explique un petit écart avec ce calculateur.',
  },
  {
    q: 'Pourquoi mon PRU diffère-t-il de celui de mon courtier ?',
    a: 'Les causes habituelles : frais inclus ou non, opérations sur titres (division du nominal, attribution gratuite), transfert de titres d’un autre établissement, ou dividendes réinvestis. Vérifiez que toutes vos opérations figurent bien dans le calcul.',
  },
  {
    q: 'Moyenner à la baisse fait-il gagner de l’argent ?',
    a: 'Acheter après une baisse réduit votre PRU, donc le cours à partir duquel vous êtes en plus-value. Cela ne change pas la valeur du titre : vous augmentez simplement votre exposition à un prix plus bas.',
  },
];

export default function PruCalculatorPage() {
  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Calculateur de PRU', href: PATH },
  ];
  const jsonLd = [
    buildBreadcrumbJsonLd(SITE_URL, breadcrumbs),
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Calculateur de PRU Fi-Hub',
      url: `${SITE_URL}${PATH}`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      inLanguage: 'fr-FR',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      description: 'Calcul du prix de revient unitaire d’une action ou d’un ETF après plusieurs achats et ventes, frais inclus.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={breadcrumbs} />

      <header className="max-w-3xl">
        <p className="text-[13px] font-medium text-[color:var(--text-muted)]">Outil gratuit · sans inscription</p>
        <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-[color:var(--text)] lg:text-5xl">
          Calculateur de PRU
        </h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-[1.55] text-[color:var(--text-2)] lg:text-[19px]">
          Saisissez vos achats et vos ventes d’une action ou d’un ETF : le prix de revient unitaire se calcule
          aussitôt, frais inclus, avec votre plus-value latente au cours du jour.
        </p>
      </header>

      <div className="mt-10 max-w-4xl">
        <PruCalculator />
      </div>

      <div className="mt-16 max-w-[68ch] space-y-12">
        <section>
          <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-[32px]">
            La formule du PRU
          </h2>
          <div className="mt-4 space-y-4 text-[17px] leading-[1.6] text-[color:var(--text-2)]">
            <p>
              Le prix de revient unitaire (PRU) est le prix moyen auquel vous avez acquis un titre :{' '}
              <strong>PRU = (somme des quantités achetées × prix d’achat + frais) ÷ quantité détenue</strong>.
            </p>
            <p>
              C’est votre seuil de rentabilité : au-dessus, la ligne est en plus-value latente ; en dessous, en
              moins-value. Chaque nouvel achat le rapproche du dernier prix payé, d’autant plus que la quantité
              achetée est importante.
            </p>
            <p>
              Une vente ne le modifie pas. Elle transforme une partie de votre plus-value latente en plus-value
              réalisée, calculée par rapport au PRU du moment.
            </p>
          </div>
        </section>

        <section aria-labelledby="pru-faq">
          <h2 id="pru-faq" className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-[32px]">
            Questions fréquentes
          </h2>
          <div className="mt-4 border-t border-[color:var(--text)]">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-[color:var(--border)]">
                <summary className="cursor-pointer list-none py-4 text-base font-medium leading-snug text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-[color:var(--text-2)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="pru-cta" className="border-t border-[color:var(--text)] pt-8">
          <h2 id="pru-cta" className="text-2xl font-semibold leading-[1.2] text-[color:var(--text)]">
            Votre PRU, recalculé à chaque opération
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-[color:var(--text-2)]">
            Fi-Hub tient ce calcul à jour pour tous vos titres, sur PEA, compte-titres et assurance-vie, avec les
            cours actualisés, vos dividendes et votre performance hors apports. Vous pouvez saisir vos positions
            actuelles en une minute ou importer un relevé.
          </p>
          <div className="mt-6">
            <Link href="/signup" className="btn-primary">
              Créer un compte gratuit
            </Link>
          </div>
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">{freePlanSummary()}</p>
          <p className="mt-6 text-[15px] text-[color:var(--text-2)]">
            Pour aller plus loin :{' '}
            <Link href="/guides/calcul-pru" className="link">
              le guide du calcul du PRU
            </Link>{' '}
            et{' '}
            <Link href="/guides/suivi-pea" className="link">
              le suivi d’un PEA
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
