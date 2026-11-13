// Résultats trimestriels d'une action (onglet Finances, bloc « Résultats
// trimestriels ») : BPA publié face au BPA attendu par les analystes,
// chiffre d'affaires et résultat net par trimestre, prévisions du consensus
// pour le trimestre et l'exercice en cours et suivants, date de la prochaine
// publication. Fonctions pures : lecture du module « résumé » du fournisseur
// et des trimestres déjà validés par `quarters.ts`.

import { rawNumber } from './fundamentals';
import type { RecentPeriods } from './quarters';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const DAY_MS = 86_400_000;

/** Date ISO (AAAA-MM-JJ) d'un horodatage en secondes, d'un `{ raw }` ou d'une chaîne ISO. */
function isoDay(v: unknown): string | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (isRecord(v) && typeof v.fmt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.fmt)) return v.fmt;
  const seconds = rawNumber(v);
  return seconds !== null && seconds > 0 ? new Date(seconds * 1000).toISOString().slice(0, 10) : null;
}

/**
 * Trimestre civil couvert par une période qui se termine à `endDate` : on lit
 * le milieu de la période (45 jours avant la fin), pour que les exercices
 * décalés tombent juste (trimestre clos fin octobre → T3, pas T4).
 */
export function quarterOfPeriod(endDate: string): { year: number; quarter: number; label: string } {
  const mid = new Date(Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`) - 45 * DAY_MS);
  const year = mid.getUTCFullYear();
  const quarter = Math.floor(mid.getUTCMonth() / 3) + 1;
  return { year, quarter, label: `T${quarter} ${year}` };
}

export interface EpsQuarter {
  /** Fin du trimestre publié. */
  date: string;
  label: string;
  actual: number | null;
  estimate: number | null;
  /** Écart relatif entre publié et attendu (0,05 = 5 % au-dessus) ; null sans base. */
  surprise: number | null;
}

export interface EstimateBlock {
  avg: number | null;
  low: number | null;
  high: number | null;
  /** Même période un an plus tôt (publiée). */
  yearAgo: number | null;
  analysts: number | null;
  /** Croissance attendue par rapport à `yearAgo`. */
  growth: number | null;
}

export type ForwardKey = '0q' | '+1q' | '0y' | '+1y';

export interface ForwardPeriod {
  key: ForwardKey;
  /** Fin de la période (trimestre ou exercice) visée. */
  endDate: string | null;
  eps: EstimateBlock;
  revenue: EstimateBlock;
  /** BPA moyen attendu aujourd'hui, il y a 30 et 90 jours : sens des révisions. */
  epsTrend: { current: number | null; days30: number | null; days90: number | null };
  /** Analystes ayant relevé ou abaissé leur prévision sur 30 jours. */
  revisions: { up30: number | null; down30: number | null };
}

export interface QuarterlyFinancial {
  date: string | null;
  label: string;
  revenue: number | null;
  netIncome: number | null;
}

export interface EarningsSummary {
  /** Devise du BPA (celle des comptes). */
  currency: string | null;
  /** Quatre derniers trimestres publiés, du plus ancien au plus récent. */
  history: EpsQuarter[];
  nextDate: string | null;
  /** La date de la prochaine publication est une estimation (pas encore annoncée). */
  nextDateEstimated: boolean;
  forward: ForwardPeriod[];
  /** CA et résultat du fournisseur (quatre trimestres), secours quand les séries ne suffisent pas. */
  quarterlyFinancials: QuarterlyFinancial[];
}

const FORWARD_KEYS: ForwardKey[] = ['0q', '+1q', '0y', '+1y'];

function estimateBlock(v: unknown, yearAgoKey: string): EstimateBlock {
  const r = isRecord(v) ? v : {};
  return {
    avg: rawNumber(r.avg),
    low: rawNumber(r.low),
    high: rawNumber(r.high),
    yearAgo: rawNumber(r[yearAgoKey]),
    analysts: rawNumber(r.numberOfAnalysts),
    growth: rawNumber(r.growth),
  };
}

export function surpriseOf(actual: number | null, estimate: number | null): number | null {
  if (actual === null || estimate === null || estimate === 0) return null;
  return (actual - estimate) / Math.abs(estimate);
}

/** « 3Q2025 » → T3 2025 (libellé du fournisseur, utilisé seulement en secours). */
function providerQuarterLabel(v: unknown): string | null {
  const m = /^([1-4])Q(\d{4})$/.exec(str(v) ?? '');
  return m ? `T${m[1]} ${m[2]}` : null;
}

/**
 * Lit les modules `earnings`, `earningsHistory`, `earningsTrend` et
 * `calendarEvents` d'une réponse du module « résumé ». Null si aucun ne
 * contient de résultat exploitable (ETF, indices, sociétés non suivies).
 */
export function parseEarningsSummary(result: Record<string, unknown>): EarningsSummary | null {
  const mod = (name: string): Record<string, unknown> => (isRecord(result[name]) ? (result[name] as Record<string, unknown>) : {});
  const earnings = mod('earnings');
  const historyModule = mod('earningsHistory');
  const trend = mod('earningsTrend');
  const calendar = isRecord(mod('calendarEvents').earnings) ? (mod('calendarEvents').earnings as Record<string, unknown>) : {};

  // BPA publié et attendu, trimestre par trimestre.
  let currency: string | null = null;
  const history: EpsQuarter[] = (Array.isArray(historyModule.history) ? historyModule.history : [])
    .filter(isRecord)
    .map((h) => {
      currency ??= str(h.currency);
      const date = isoDay(h.quarter);
      const actual = rawNumber(h.epsActual);
      const estimate = rawNumber(h.epsEstimate);
      return date ? { date, label: quarterOfPeriod(date).label, actual, estimate, surprise: surpriseOf(actual, estimate) } : null;
    })
    .filter((h): h is EpsQuarter => h !== null && (h.actual !== null || h.estimate !== null))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  // Prévisions : trimestre et exercice en cours, puis suivants.
  const trendRows = Array.isArray(trend.trend) ? trend.trend.filter(isRecord) : [];
  const forward: ForwardPeriod[] = FORWARD_KEYS.flatMap((key) => {
    const row = trendRows.find((t) => t.period === key);
    if (!row) return [];
    const eps = estimateBlock(row.earningsEstimate, 'yearAgoEps');
    const revenue = estimateBlock(row.revenueEstimate, 'yearAgoRevenue');
    if (eps.avg === null && revenue.avg === null) return [];
    const epsTrend = isRecord(row.epsTrend) ? row.epsTrend : {};
    const revisions = isRecord(row.epsRevisions) ? row.epsRevisions : {};
    currency ??= isRecord(row.earningsEstimate) ? str(row.earningsEstimate.earningsCurrency) : null;
    return [{
      key,
      endDate: isoDay(row.endDate),
      eps,
      revenue,
      epsTrend: { current: rawNumber(epsTrend.current), days30: rawNumber(epsTrend['30daysAgo']), days90: rawNumber(epsTrend['90daysAgo']) },
      revisions: { up30: rawNumber(revisions.upLast30days), down30: rawNumber(revisions.downLast30days) },
    }];
  });

  // Prochaine publication : le fournisseur donne parfois une plage, on garde le premier jour.
  const chart = isRecord(earnings.earningsChart) ? earnings.earningsChart : {};
  const dates = [
    ...(Array.isArray(calendar.earningsDate) ? calendar.earningsDate : []),
    ...(Array.isArray(chart.earningsDate) ? chart.earningsDate : []),
  ].map(isoDay).filter((d): d is string => d !== null).sort();
  const nextDate = dates[0] ?? null;
  const nextDateEstimated = calendar.isEarningsDateEstimate === true || chart.isEarningsDateEstimate === true;

  // Une société qui publie ses résultats par semestre (Schneider, LVMH…) a un CA
  // trimestriel mais un résultat trimestriel à 0 chez le fournisseur : 0 veut dire « non publié ».
  const published = (v: unknown) => {
    const n = rawNumber(v);
    return n === 0 ? null : n;
  };
  const financialsChart = isRecord(earnings.financialsChart) ? earnings.financialsChart : {};
  const quarterlyFinancials: QuarterlyFinancial[] = (Array.isArray(financialsChart.quarterly) ? financialsChart.quarterly : [])
    .filter(isRecord)
    .map((q) => ({ date: null, label: providerQuarterLabel(q.date) ?? '', revenue: published(q.revenue), netIncome: published(q.earnings) }))
    .filter((q) => q.label && (q.revenue !== null || q.netIncome !== null));

  currency ??= str(earnings.financialCurrency);
  if (history.length === 0 && forward.length === 0 && quarterlyFinancials.length === 0 && !nextDate) return null;
  return { currency, history, nextDate, nextDateEstimated, forward, quarterlyFinancials };
}

/**
 * Chiffre d'affaires et résultat net par trimestre : les trimestres validés
 * par `quarters.ts` (8 au plus, recoupés avec les comptes annuels) en
 * priorité, sinon les quatre trimestres du fournisseur. Vide pour une société
 * qui publie par semestre.
 */
export function quarterlyFinancials(periods: RecentPeriods | undefined, fallback: QuarterlyFinancial[] = []): QuarterlyFinancial[] {
  const revenue = periods?.revenue?.kind === 'quarter' ? periods.revenue.points : [];
  const net = periods?.netIncome?.kind === 'quarter' ? periods.netIncome.points : [];
  const dates = Array.from(new Set([...revenue, ...net].map((p) => p.date))).sort();
  if (dates.length >= 2) {
    return dates.map((date) => ({
      date,
      label: quarterOfPeriod(date).label,
      revenue: revenue.find((p) => p.date === date)?.value ?? null,
      netIncome: net.find((p) => p.date === date)?.value ?? null,
    }));
  }
  return fallback;
}

/** Marge nette d'un trimestre ; null sans chiffre d'affaires positif. */
export function netMargin(q: Pick<QuarterlyFinancial, 'revenue' | 'netIncome'>): number | null {
  return q.revenue !== null && q.revenue > 0 && q.netIncome !== null ? q.netIncome / q.revenue : null;
}

/** Bilan des quatre derniers trimestres : combien de fois le BPA a dépassé le consensus. */
export function beatCount(history: EpsQuarter[]): { beats: number; total: number } {
  const scored = history.filter((h) => h.surprise !== null);
  return { beats: scored.filter((h) => (h.surprise as number) > 0).length, total: scored.length };
}
