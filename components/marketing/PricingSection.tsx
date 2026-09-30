'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import {
  MONTHLY_TRIAL_LABEL,
  PLANS,
  YEARLY_VALUE_LABEL,
  type BillingInterval,
  type Feature,
  type Plan,
  formatPriceFor,
  getYearlySavingsPercent,
  hasFeature,
} from '@/lib/plans';

type Cell = string | boolean;

function limit(value: number, unlimited: string): string {
  return Number.isFinite(value) ? String(value) : unlimited;
}

function feature(f: Feature): [boolean, boolean] {
  return [hasFeature(PLANS.free, f), hasFeature(PLANS.pro, f)];
}

// Rows shared by both plans. Only features that exist in the product are listed.
const ROWS: { label: string; free: Cell; pro: Cell }[] = [
  { label: 'Comptes', free: limit(PLANS.free.maxAccounts, 'Illimités'), pro: limit(PLANS.pro.maxAccounts, 'Illimités') },
  { label: 'Transactions', free: limit(PLANS.free.maxTransactions, 'Illimitées'), pro: limit(PLANS.pro.maxTransactions, 'Illimitées') },
  { label: 'Positions', free: limit(PLANS.free.maxPositions, 'Illimitées'), pro: limit(PLANS.pro.maxPositions, 'Illimitées') },
  { label: 'Positions, PRU et historique jour par jour', ...pair(feature('full_history')) },
  { label: 'Performance hors apports et benchmark', ...pair(feature('advanced_analytics')) },
  { label: 'Cours actualisés automatiquement', free: true, pro: true },
  { label: 'Export JSON et PDF', free: true, pro: true },
  { label: 'Module dividendes', ...pair(feature('dividends_module')) },
  { label: 'Import de relevés (CSV, Excel, PDF, captures)', ...pair(feature('import_transactions')) },
];

function pair([free, pro]: [boolean, boolean]) {
  return { free, pro };
}

function CellValue({ value }: { value: Cell }) {
  if (typeof value === 'string') {
    return <span className="tabular-nums text-[color:var(--text)]">{value}</span>;
  }
  return value ? (
    <>
      <Check className="inline h-4 w-4 text-[color:var(--text)]" strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">Inclus</span>
    </>
  ) : (
    <>
      <Minus className="inline h-4 w-4 text-[color:var(--text-muted)]" strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">Non inclus</span>
    </>
  );
}

function PlanSummary({ plan, interval }: { plan: Plan; interval: BillingInterval }) {
  const isPro = plan.id === 'pro';
  const savings = getYearlySavingsPercent(plan);
  const monthlyEquivalent =
    isPro && plan.priceCentsYearly
      ? (plan.priceCentsYearly / 12 / 100).toFixed(2).replace('.', ',')
      : null;

  return (
    <div className="flex flex-col">
      <h3 className="text-xl font-semibold text-[color:var(--text)]">{plan.name}</h3>
      <p className="mt-2 whitespace-nowrap text-2xl font-semibold tabular-nums tracking-[-0.01em] text-[color:var(--text)]">
        {isPro ? formatPriceFor(plan, interval) : 'Gratuit'}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-[color:var(--text-muted)] sm:min-h-[2.5rem]">
        {!isPro && 'Sans carte bancaire.'}
        {isPro && interval === 'month' && `${MONTHLY_TRIAL_LABEL}, puis ${formatPriceFor(plan, 'month')}.`}
        {isPro && interval === 'year' &&
          `Soit ${monthlyEquivalent} € / mois. ${YEARLY_VALUE_LABEL}${savings !== null ? ` (-${savings} %)` : ''}.`}
      </p>
      <Link
        href="/signup"
        className={`${isPro ? 'btn-secondary' : 'btn-primary'} btn-sm mt-4 w-full sm:w-auto sm:self-start`}
      >
        {isPro ? (interval === 'month' ? 'Essayer Pro' : 'Choisir Pro annuel') : 'Créer un compte gratuit'}
      </Link>
    </div>
  );
}

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const savings = getYearlySavingsPercent(PLANS.pro);

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 border-t border-[color:var(--border)]"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2
              id="pricing-title"
              className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-4xl"
            >
              Free pour suivre. Pro pour importer et analyser vos dividendes.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[color:var(--text-2)]">
              Le plan Free couvre le suivi complet de quelques comptes. Pro lève les limites et
              ajoute l’import de relevés et le module dividendes.
            </p>
          </div>

          <div
            role="group"
            aria-label="Période de facturation de l’offre Pro"
            className="inline-flex w-fit items-center gap-1 rounded-md border border-[color:var(--border-input)] p-1"
          >
            {(['month', 'year'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setInterval(value)}
                aria-pressed={interval === value}
                className={`min-h-9 rounded px-3 text-sm font-medium transition-colors ${
                  interval === value
                    ? 'bg-[color:var(--action)] text-[color:var(--action-fg)]'
                    : 'text-[color:var(--text-2)] hover:bg-[color:var(--surface-2)]'
                }`}
              >
                {value === 'month' ? 'Mensuel' : `Annuel${savings !== null ? ` · -${savings} %` : ''}`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-2)]">
          <div className="grid grid-cols-1 gap-8 border-b border-[color:var(--border)] p-5 sm:grid-cols-2 sm:gap-6 md:grid-cols-[minmax(0,1fr)_14rem_14rem] md:gap-8 md:p-6">
            <p className="hidden text-sm leading-relaxed text-[color:var(--text-muted)] md:block">
              Les deux offres utilisent les mêmes calculs. Seules les limites et les modules
              changent.
            </p>
            <PlanSummary plan={PLANS.free} interval={interval} />
            <PlanSummary plan={PLANS.pro} interval={interval} />
          </div>

          <table className="w-full table-fixed border-collapse text-[15px]">
            <caption className="sr-only">Comparaison des offres Free et Pro</caption>
            <colgroup>
              <col />
              <col className="w-[28%] md:w-[15.5rem]" />
              <col className="w-[28%] md:w-[15.5rem]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[13px] text-[color:var(--text-muted)]">
                <th scope="col" className="px-5 py-3 font-medium md:px-6">Fonction</th>
                <th scope="col" className="px-2 py-3 font-medium md:px-4">Free</th>
                <th scope="col" className="px-2 py-3 font-medium md:px-4">Pro</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-[color:var(--border)]">
                  <th scope="row" className="px-5 py-3 text-left font-normal leading-snug text-[color:var(--text-2)] md:px-6">
                    {row.label}
                  </th>
                  <td className="px-2 py-3 md:px-4"><CellValue value={row.free} /></td>
                  <td className="px-2 py-3 md:px-4"><CellValue value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-[color:var(--text-muted)]">
          Pro s’active depuis les paramètres de votre compte, après l’inscription. L’abonnement se
          résilie à tout moment ; l’accès reste actif jusqu’à la fin de la période payée.
        </p>
      </div>
    </section>
  );
}
