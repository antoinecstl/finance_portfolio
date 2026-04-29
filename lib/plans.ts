export type PlanId = 'free' | 'pro';
export type BillingInterval = 'month' | 'year';
export type Feature =
  | 'basic_charts'
  | 'advanced_analytics'
  | 'csv_export'
  | 'full_history'
  | 'dividends_module'
  | 'import_transactions';

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  priceCentsYearly: number | null;
  currency: string;
  interval: 'month' | 'year' | null;
  maxAccounts: number;
  maxTransactions: number;
  maxPositions: number;
  features: readonly Feature[];
  tagline: string;
  highlights: readonly string[];
};

const INF = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    priceCentsYearly: null,
    currency: 'EUR',
    interval: null,
    maxAccounts: 1,
    maxTransactions: 50,
    maxPositions: 5,
    features: ['basic_charts'],
    tagline: 'Pour tester et suivre un petit patrimoine',
    highlights: [
      '1 compte',
      '50 transactions au total',
      '5 positions boursières',
      'Graphiques de base',
      'Cours en temps réel',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 499,
    priceCentsYearly: 4999,
    currency: 'EUR',
    interval: 'month',
    maxAccounts: INF,
    maxTransactions: INF,
    maxPositions: INF,
    features: [
      'basic_charts',
      'advanced_analytics',
      'csv_export',
      'full_history',
      'dividends_module',
      'import_transactions',
    ],
    tagline: 'Pour un suivi complet et sans limite',
    highlights: [
      'Comptes illimités (PEA, CTO, livrets, AV)',
      'Transactions et positions illimitées',
      'Analyses avancées & performance annuelle',
      'Historique complet du portefeuille',
      'Module dividendes',
      'Import de transactions',
      'Export CSV',
    ],
  },
};

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function formatPrice(plan: Plan): string {
  if (plan.priceCents === 0) return 'Gratuit';
  const suffix = plan.interval === 'month' ? ' / mois' : plan.interval === 'year' ? ' / an' : '';
  return `${formatAmount(plan.priceCents)} €${suffix}`;
}

export function formatPriceFor(plan: Plan, interval: BillingInterval): string {
  if (plan.priceCents === 0) return 'Gratuit';
  if (interval === 'year') {
    const yearly = plan.priceCentsYearly ?? plan.priceCents * 12;
    return `${formatAmount(yearly)} € / an`;
  }
  return `${formatAmount(plan.priceCents)} € / mois`;
}

export function getYearlySavingsPercent(plan: Plan): number | null {
  if (!plan.priceCentsYearly || plan.priceCents === 0) return null;
  const yearlyFull = plan.priceCents * 12;
  if (yearlyFull === 0) return null;
  const saved = yearlyFull - plan.priceCentsYearly;
  if (saved <= 0) return null;
  return Math.round((saved / yearlyFull) * 100);
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return plan.features.includes(feature);
}
