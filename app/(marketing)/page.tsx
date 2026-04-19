import Link from 'next/link';
import { ArrowRight, TrendingUp, PieChart, Wallet, ShieldCheck, BarChart2, Coins } from 'lucide-react';
import { PricingCard } from '@/components/marketing/PricingCard';
import { FAQ } from '@/components/marketing/FAQ';
import { PLANS } from '@/lib/plans';

const features = [
  {
    icon: Wallet,
    title: 'Tous vos comptes au même endroit',
    body: 'PEA, CTO, livret A, LDDS, assurance-vie, PEL. Regroupez tout en un coup d\u2019\u0153il.',
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

export default function LandingPage() {
  return (
    <>
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium mb-6">
          <TrendingUp className="w-3.5 h-3.5" /> Suivi de patrimoine
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">
          Suivez votre patrimoine
          <br />
          <span className="text-blue-600">sans Excel.</span>
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
          Fi-Hub regroupe vos PEA, CTO, livrets et assurances-vie en un tableau de bord unique.
          Valorisation en temps réel, historique, dividendes.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            Commencer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-6 py-3 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg"
          >
            Voir les tarifs
          </Link>
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          Gratuit pour 1 compte et 50 transactions. Aucune carte requise.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-12">
          Tout ce dont vous avez besoin
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{f.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-4">
          Tarifs simples
        </h2>
        <p className="text-center text-zinc-600 dark:text-zinc-400 mb-10">
          Commencez gratuitement, passez Pro quand vous voulez.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <PricingCard plan={PLANS.free} />
          <PricingCard plan={PLANS.pro} highlight />
        </div>
      </section>

      <FAQ />

      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Prêt à reprendre le contrôle ?
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Créez votre compte gratuit en 30 secondes.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
        >
          Créer mon compte <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </>
  );
}
