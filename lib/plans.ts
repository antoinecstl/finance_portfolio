export type PlanId = 'free' | 'pro';
export type Feature =
  | 'basic_charts'
  | 'advanced_analytics'
  | 'csv_export'
  | 'full_history'
  | 'dividends_module';

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
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
    currency: 'EUR',
    interval: 'month',
    maxAccounts: INF,
    maxTransactions: INF,
    maxPositions: INF,
    features: ['basic_charts', 'advanced_analytics', 'csv_export', 'full_history', 'dividends_module'],
    tagline: 'Pour un suivi complet et sans limite',
    highlights: [
      'Comptes illimités (PEA, CTO, livrets, AV)',
      'Transactions et positions illimitées',
      'Analyses avancées & performance annuelle',
      'Historique complet du portefeuille',
      'Module dividendes',
      'Export CSV',
    ],
  },
};

export function formatPrice(plan: Plan): string {
  if (plan.priceCents === 0) return 'Gratuit';
  const amount = (plan.priceCents / 100).toFixed(2).replace('.', ',');
  const suffix = plan.interval === 'month' ? ' / mois' : plan.interval === 'year' ? ' / an' : '';
  return `${amount} € ${suffix}`.trim();
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return plan.features.includes(feature);
}
