import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export const metadata: Metadata = {
  title: 'Suivi portefeuille boursier Excel : limites et alternative',
  description:
    "Vous suivez encore votre portefeuille boursier sur Excel ? Découvrez les limites (temps, erreurs, maintenance) et une alternative plus fiable pour PEA et CTO.",
  alternates: { canonical: '/suivi-portefeuille-excel' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/suivi-portefeuille-excel`,
    title: 'Suivi portefeuille boursier Excel : quand passer à un vrai tracker',
    description:
      'Un guide pratique pour remplacer votre tableau Excel de suivi portefeuille sans perdre vos repères.',
  },
};

export default function SuiviPortefeuilleExcelPage() {
  return (
    <main className="max-w-4xl mx-auto px-5 py-14 sm:py-20">
      <p className="mono text-xs tracking-[0.15em] text-[color:var(--ink-soft)]">Guide pratique</p>
      <h1 className="display text-4xl sm:text-5xl leading-tight mt-3 text-[color:var(--ink)]">
        Suivi portefeuille boursier Excel : comment passer à un outil dédié
      </h1>
      <p className="mt-6 text-[17px] leading-relaxed text-[color:var(--ink-2)]">
        Excel peut suffire au début. Mais plus votre portefeuille grossit, plus les mises à jour,
        formules et consolidations deviennent chronophages. Un tracker dédié réduit les tâches
        manuelles et améliore la fiabilité de votre suivi.
      </p>

      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        <article className="ink-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[color:var(--ink)]">Limites d&apos;Excel</h2>
          <ul className="mt-4 space-y-2 text-[color:var(--ink-2)]">
            <li>• Saisie manuelle répétitive.</li>
            <li>• Erreurs de formule difficiles à repérer.</li>
            <li>• Peu adapté au multi-comptes (PEA + CTO + AV).</li>
          </ul>
        </article>
        <article className="ink-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[color:var(--ink)]">Bénéfices d&apos;un tracker</h2>
          <ul className="mt-4 space-y-2 text-[color:var(--ink-2)]">
            <li>• Vue consolidée de votre patrimoine.</li>
            <li>• Suivi de performance et dividendes en continu.</li>
            <li>• Export des données pour garder le contrôle.</li>
          </ul>
        </article>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/signup" className="btn-ink px-6 py-3 rounded-full text-sm font-medium">
          Créer un compte gratuit
        </Link>
        <Link href="/alternative-finary" className="btn-outline px-6 py-3 rounded-full text-sm font-medium">
          Voir la page alternative à Finary
        </Link>
      </div>
    </main>
  );
}
