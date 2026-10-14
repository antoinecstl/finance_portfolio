// Finances historiques des actions (docs/specs/explorateur-marches-v2.md §4.2, §6).
// Fusion des comptes officiels (SEC) et du fournisseur, indicateurs dérivés par
// exercice, catalogue des indicateurs du graphique personnalisé. Fonctions pures.

import { STATEMENT_ITEMS, type StatementItem, type StatementRow } from './fundamentals';

const DAY_MS = 86_400_000;
const sameFiscalYear = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 20 * DAY_MS;

export interface MergeResult {
  rows: StatementRow[];
  /** Exercices où les deux sources divergent de plus de 5 % sur le chiffre d'affaires. */
  divergences: Array<{ date: string; official: number; provider: number }>;
  officialYears: number;
}

/**
 * Exercice par exercice : la source officielle donne chaque poste qu'elle publie,
 * le fournisseur comble les trous et les exercices absents.
 */
export function mergeAnnualRows(official: readonly StatementRow[], provider: readonly StatementRow[], maxYears = 15): MergeResult {
  const keys = Object.keys(STATEMENT_ITEMS) as StatementItem[];
  const merged: StatementRow[] = official.map((row) => ({ ...row }));
  const divergences: MergeResult['divergences'] = [];

  for (const p of provider) {
    const target = merged.find((row) => sameFiscalYear(row.date, p.date));
    if (!target) {
      merged.push({ ...p });
      continue;
    }
    if (target.revenue !== null && p.revenue !== null && target.revenue !== 0 && Math.abs(p.revenue / target.revenue - 1) > 0.05) {
      divergences.push({ date: target.date, official: target.revenue, provider: p.revenue });
    }
    for (const key of keys) if (target[key] === null && p[key] !== null) target[key] = p[key];
  }
  for (const row of merged) {
    if (row.freeCashFlow === null && row.operatingCashFlow !== null && row.capitalExpenditure !== null) {
      row.freeCashFlow = row.operatingCashFlow + row.capitalExpenditure;
    }
  }
  return {
    rows: merged.sort((a, b) => a.date.localeCompare(b.date)).slice(-maxYears),
    divergences,
    officialYears: official.length,
  };
}

/** Indicateurs disponibles par exercice : postes publiés + dérivés. */
export type HistoryMetric =
  | StatementItem
  | 'grossMargin'
  | 'operatingMargin'
  | 'netMargin'
  | 'fcfMargin'
  | 'netDebt'
  | 'netDebtToEbitda'
  | 'roe'
  | 'payoutRatio'
  | 'dividendPerShare'
  | 'fcfPerShare';

export type MetricUnit = 'money' | 'perShare' | 'percent' | 'multiple' | 'count';

export interface MetricDef {
  key: HistoryMetric;
  label: string;
  unit: MetricUnit;
}

/** Catalogue proposé dans le graphique personnalisé, dans l'ordre de lecture des comptes. */
export const HISTORY_METRICS: readonly MetricDef[] = [
  { key: 'revenue', label: 'Chiffre d’affaires', unit: 'money' },
  { key: 'grossProfit', label: 'Marge brute (montant)', unit: 'money' },
  { key: 'ebitda', label: 'EBITDA', unit: 'money' },
  { key: 'operatingIncome', label: 'Résultat opérationnel', unit: 'money' },
  { key: 'netIncome', label: 'Résultat net', unit: 'money' },
  { key: 'operatingCashFlow', label: 'Flux d’exploitation', unit: 'money' },
  { key: 'freeCashFlow', label: 'Free cash flow', unit: 'money' },
  { key: 'cash', label: 'Trésorerie', unit: 'money' },
  { key: 'totalDebt', label: 'Dette financière', unit: 'money' },
  { key: 'netDebt', label: 'Dette nette', unit: 'money' },
  { key: 'equity', label: 'Capitaux propres', unit: 'money' },
  { key: 'eps', label: 'BPA dilué', unit: 'perShare' },
  { key: 'fcfPerShare', label: 'FCF par action', unit: 'perShare' },
  { key: 'dividendPerShare', label: 'Dividende par action', unit: 'perShare' },
  { key: 'grossMargin', label: 'Marge brute', unit: 'percent' },
  { key: 'operatingMargin', label: 'Marge opérationnelle', unit: 'percent' },
  { key: 'netMargin', label: 'Marge nette', unit: 'percent' },
  { key: 'fcfMargin', label: 'Marge FCF', unit: 'percent' },
  { key: 'roe', label: 'ROE', unit: 'percent' },
  { key: 'payoutRatio', label: 'Taux de distribution', unit: 'percent' },
  { key: 'netDebtToEbitda', label: 'Dette nette / EBITDA', unit: 'multiple' },
  { key: 'shares', label: 'Nombre d’actions', unit: 'count' },
];

export interface HistoryRow {
  date: string;
  year: number;
  values: Record<HistoryMetric, number | null>;
}

const div = (a: number | null, b: number | null, positiveDenominator = true): number | null => {
  if (a === null || b === null || b === 0 || (positiveDenominator && b < 0)) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
};

/**
 * Exercices enrichis des indicateurs dérivés. `dividendsByYear` : dividendes
 * versés par action, par année civile (événements de cotation).
 */
export function buildHistory(rows: readonly StatementRow[], dividendsByYear: ReadonlyMap<number, number> = new Map()): HistoryRow[] {
  return rows.map((row) => {
    const year = Number(row.date.slice(0, 4));
    const shares = row.shares ?? row.dilutedShares;
    const netDebt = row.totalDebt !== null ? row.totalDebt - (row.cash ?? 0) : null;
    const values = { ...row } as unknown as Record<HistoryMetric, number | null>;
    delete (values as Record<string, unknown>).date;
    Object.assign(values, {
      grossMargin: div(row.grossProfit, row.revenue),
      operatingMargin: div(row.operatingIncome, row.revenue),
      netMargin: div(row.netIncome, row.revenue),
      fcfMargin: div(row.freeCashFlow, row.revenue),
      netDebt,
      netDebtToEbitda: div(netDebt, row.ebitda),
      roe: div(row.netIncome, row.equity),
      payoutRatio: row.dividendsPaid !== null ? div(Math.abs(row.dividendsPaid), row.netIncome) : null,
      dividendPerShare: dividendsByYear.get(year) ?? null,
      fcfPerShare: div(row.freeCashFlow, shares),
    });
    return { date: row.date, year, values };
  });
}

/** Valeurs d'un indicateur, exercice par exercice. */
export function metricValues(history: readonly HistoryRow[], key: HistoryMetric): Array<number | null> {
  return history.map((row) => row.values[key] ?? null);
}

/** Indicateurs présents sur au moins deux exercices. */
export function availableMetrics(history: readonly HistoryRow[]): MetricDef[] {
  return HISTORY_METRICS.filter((m) => metricValues(history, m.key).filter((v) => v !== null).length >= 2);
}

/**
 * Croissance annuelle moyenne d'un montant entre le premier et le dernier
 * exercice positifs (3 exercices au moins). Null pour les pourcentages.
 */
export function metricGrowth(history: readonly HistoryRow[], key: HistoryMetric): { rate: number; years: number } | null {
  const points = history.map((row) => ({ date: row.date, v: row.values[key] })).filter((p): p is { date: string; v: number } => p.v !== null);
  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const years = Math.round((Date.parse(last.date) - Date.parse(first.date)) / (365.25 * DAY_MS));
  if (first.v <= 0 || last.v <= 0 || years < 2) return null;
  return { rate: Math.pow(last.v / first.v, 1 / years) - 1, years };
}

/** Base 100 au premier exercice positif ; null avant et pour les valeurs négatives. */
export function indexTo100(values: ReadonlyArray<number | null>): Array<number | null> {
  const base = values.find((v): v is number => v !== null && v > 0);
  if (base === undefined) return values.map(() => null);
  let started = false;
  return values.map((v) => {
    if (v === base) started = true;
    return started && v !== null && v > 0 ? (v / base) * 100 : null;
  });
}

/** Somme des dividendes par année civile. */
export function dividendsPerYear(dividends: ReadonlyArray<{ date: string; amount: number }>): Map<number, number> {
  const out = new Map<number, number>();
  for (const d of dividends) {
    const year = Number(d.date.slice(0, 4));
    out.set(year, (out.get(year) ?? 0) + d.amount);
  }
  return out;
}
