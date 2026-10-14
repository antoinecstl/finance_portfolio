// Simulateur de valeur par actualisation des flux (DCF) : hypothèses par défaut
// tirées des comptes, trois scénarios, et lecture inversée du cours (quelle
// croissance le prix actuel suppose-t-il). docs/specs/explorateur-marches-v2.md §4.3.
// Fonctions pures.

import { dcfValuePerShare } from './fundamentals';
import { median } from './valuation';

export interface DcfAssumptions {
  /** Croissance annuelle du free cash flow les 5 premières années. */
  growth: number;
  /** Rendement exigé (taux d'actualisation). */
  discountRate: number;
  /** Croissance perpétuelle après 10 ans. */
  terminalGrowth: number;
}

export type DcfScenario = 'prudent' | 'central' | 'optimistic';

export interface DcfBasis {
  revenueCagr: number | null;
  epsCagr: number | null;
  fcfCagr: number | null;
  /** Années couvertes par ces croissances passées. */
  growthYears: number | null;
  /** Croissance du BPA attendue par les analystes sur 5 ans. */
  analystGrowth: number | null;
  beta: number | null;
}

export interface DcfPlan {
  scenarios: Record<DcfScenario, DcfAssumptions>;
  /** Ce sur quoi reposent les hypothèses, affiché pour les expliquer. */
  basis: DcfBasis;
}

/** Croissance de long terme : proche de l'inflation visée par les banques centrales. */
export const TERMINAL_GROWTH = 0.02;
const DEFAULT_GROWTH = 0.04;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
/** Arrondi au demi-point. */
const halfPoint = (v: number) => Math.round(v * 200) / 200;

/**
 * Rendement exigé : 4 % (taux sans risque) + 5 % × bêta (prime de risque des
 * actions, plus forte pour un titre plus volatil que le marché), borné à 7-12 %.
 * Sans bêta publié : 9 %, le rendement exigé moyen d'une grande valeur.
 */
export function discountRateFor(beta: number | null): number {
  if (beta === null || !Number.isFinite(beta) || beta <= 0) return 0.09;
  return clamp(halfPoint(0.04 + 0.05 * beta), 0.07, 0.12);
}

/**
 * Trois scénarios à partir des croissances passées (CA, BPA, FCF) et attendue :
 * le central prend leur médiane (bornée entre 0 et 15 %), prudent et optimiste
 * s'en écartent de 40 % (3 points au moins). Seule la croissance varie.
 */
export function dcfPlan(basis: DcfBasis): DcfPlan {
  const candidates = [basis.revenueCagr, basis.epsCagr, basis.fcfCagr, basis.analystGrowth]
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .map((v) => clamp(v, -0.1, 0.3));
  const central = candidates.length > 0 ? clamp(halfPoint(median(candidates)), 0, 0.15) : DEFAULT_GROWTH;
  const spread = Math.max(0.03, halfPoint(central * 0.4));
  const discountRate = discountRateFor(basis.beta);
  const scenario = (growth: number): DcfAssumptions => ({ growth: halfPoint(growth), discountRate, terminalGrowth: TERMINAL_GROWTH });
  return {
    scenarios: {
      prudent: scenario(Math.max(0, central - spread)),
      central: scenario(central),
      optimistic: scenario(Math.min(central + spread, 0.25)),
    },
    basis,
  };
}

const IMPLIED_MIN = -0.3;
const IMPLIED_MAX = 0.6;

/**
 * DCF inversé : croissance annuelle du free cash flow sur 5 ans que suppose le
 * cours actuel, à rendement exigé donné. `bound` signale un résultat hors de
 * la plage étudiée (-30 % à +60 % par an).
 */
export function impliedGrowth(input: { fcfPerShare: number; price: number; discountRate: number; terminalGrowth: number }):
  { growth: number; bound: 'above' | 'below' | null } | null {
  const { fcfPerShare, price, discountRate, terminalGrowth } = input;
  if (!(fcfPerShare > 0) || !(price > 0) || discountRate <= terminalGrowth) return null;
  const value = (growth: number) => dcfValuePerShare({ fcfPerShare, growth, discountRate, terminalGrowth }) ?? Number.NaN;
  if (value(IMPLIED_MAX) < price) return { growth: IMPLIED_MAX, bound: 'above' };
  if (value(IMPLIED_MIN) > price) return { growth: IMPLIED_MIN, bound: 'below' };
  // La valeur croît avec la croissance : dichotomie.
  let lo = IMPLIED_MIN;
  let hi = IMPLIED_MAX;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) < price) lo = mid;
    else hi = mid;
  }
  return { growth: (lo + hi) / 2, bound: null };
}
