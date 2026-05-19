import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export const metadata: Metadata = {
  title: 'Alternative à Finary : comparez pour choisir le meilleur outil',
  description:
    "Vous cherchez une alternative à Finary ? Comparez les fonctionnalités clés : suivi PEA/CTO/AV, dividendes, benchmark, import et exports. Essayez Fi-Hub gratuitement.",
  alternates: { canonical: '/alternative-finary' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/alternative-finary`,
    title: 'Alternative à Finary : comparaison orientée investisseur particulier',
    description:
      'Un comparatif concret pour choisir votre outil de suivi de patrimoine sans rester bloqué dans Excel.',
  },
};

const POINTS = [
  'Suivi multi-enveloppes : PEA, CTO, assurance-vie, livrets.',
  'Performance lisible avec historique et comparaison indices.',
  'Module dividendes intégré pour suivre vos revenus passifs.',
  'Imports et exports pour garder la maîtrise de vos données.',
];

export default function AlternativeFinaryPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 py-14 sm:py-20">
      <p className="mono text-xs tracking-[0.15em] text-[color:var(--ink-soft)]">Comparatif</p>
      <h1 className="display text-4xl sm:text-5xl leading-tight mt-3 text-[color:var(--ink)]">
        Alternative à Finary : une option claire pour suivre votre portefeuille
      </h1>
      <p className="mt-6 text-[17px] leading-relaxed text-[color:var(--ink-2)]">
        Si vous comparez les outils de suivi de patrimoine, l&apos;objectif est simple : obtenir une vue
        fiable de vos comptes sans vous perdre dans un tableur. Fi-Hub est pensé pour le suivi
        quotidien des investisseurs particuliers en France.
      </p>

      <section className="mt-10 ink-card rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Ce qui compte dans la comparaison</h2>
        <ul className="mt-5 space-y-3 text-[color:var(--ink-2)]">
          {POINTS.map((point) => (
            <li key={point}>• {point}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Pourquoi commencer maintenant</h2>
        <p className="mt-4 text-[color:var(--ink-2)] leading-relaxed">
          Le meilleur outil est celui que vous utilisez régulièrement. En démarrant avec une interface
          dédiée au suivi de portefeuille, vous gagnez du temps sur la mise à jour et vous concentrez
          votre énergie sur vos décisions d&apos;investissement.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/signup" className="btn-ink px-6 py-3 rounded-full text-sm font-medium">
          Tester Fi-Hub gratuitement
        </Link>
        <Link href="/" className="btn-outline px-6 py-3 rounded-full text-sm font-medium">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
