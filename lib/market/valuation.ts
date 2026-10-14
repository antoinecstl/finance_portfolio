// Valorisation historique d'une action (docs/specs/explorateur-marches-v2.md §4.3) :
// multiples chaque semaine à partir du cours et des comptes publiés, leurs
// statistiques, et des repères de valorisation. Fonctions pures.

import type { MarketDividend, MarketPoint } from './chart-data';
import type { StatementRow } from './fundamentals';

const DAY_S = 86_400;
/** Délai de publication des comptes annuels (clôture → publication). */
export const ANNUAL_PUBLICATION_LAG_DAYS = 75;
/** Délai de publication d'un trimestre. */
export const QUARTER_PUBLICATION_LAG_DAYS = 45;

export type MultipleKey = 'per' | 'priceToFcf' | 'priceToSales' | 'evToEbitda' | 'priceToBook' | 'dividendYield';

export const MULTIPLE_LABELS: Record<MultipleKey, string> = {
  per: 'PER',
  priceToFcf: 'Cours / FCF',
  priceToSales: 'Cours / CA',
  evToEbitda: 'VE / EBITDA',
  priceToBook: 'Cours / actif net',
  dividendYield: 'Rendement du dividende',
};

interface Snapshot {
  effective: number; // secondes Unix : date à partir de laquelle les comptes sont connus
  eps: number | null;
  salesPerShare: number | null;
  fcfPerShare: number | null;
  bookPerShare: number | null;
  ebitda: number | null;
  netDebt: number | null;
  shares: number | null;
}

const toSec = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);
const per = (a: number | null, shares: number | null) => (a !== null && shares !== null && shares > 0 ? a / shares : null);

function snapshotOf(row: StatementRow, lagDays: number): Snapshot {
  const shares = row.shares ?? row.dilutedShares;
  return {
    effective: toSec(row.date) + lagDays * DAY_S,
    eps: row.eps ?? per(row.netIncome, shares),
    salesPerShare: per(row.revenue, shares),
    fcfPerShare: per(row.freeCashFlow, shares),
    bookPerShare: per(row.equity, shares),
    ebitda: row.ebitda,
    netDebt: row.totalDebt !== null ? row.totalDebt - (row.cash ?? 0) : null,
    shares,
  };
}

/** Comptes connus à chaque date : exercices publiés, puis les 12 derniers mois. */
export function buildSnapshots(annual: readonly StatementRow[], ttm: StatementRow | null): Snapshot[] {
  const snapshots = annual.map((row) => snapshotOf(row, ANNUAL_PUBLICATION_LAG_DAYS));
  const lastAnnual = annual.at(-1);
  if (ttm && (!lastAnnual || ttm.date > lastAnnual.date)) snapshots.push(snapshotOf(ttm, QUARTER_PUBLICATION_LAG_DAYS));
  return snapshots.sort((a, b) => a.effective - b.effective);
}

const positive = (v: number | null): v is number => v !== null && v > 0;

function multiplesAt(price: number, s: Snapshot): Record<Exclude<MultipleKey, 'dividendYield'>, number | null> {
  const ev = s.shares !== null && s.shares > 0 ? price * s.shares + (s.netDebt ?? 0) : null;
  return {
    per: positive(s.eps) ? price / s.eps : null,
    priceToFcf: positive(s.fcfPerShare) ? price / s.fcfPerShare : null,
    priceToSales: positive(s.salesPerShare) ? price / s.salesPerShare : null,
    evToEbitda: positive(s.ebitda) && ev !== null && ev > 0 ? ev / s.ebitda : null,
    priceToBook: positive(s.bookPerShare) ? price / s.bookPerShare : null,
  };
}

export interface MultipleSeries {
  key: MultipleKey;
  label: string;
  points: Array<{ t: number; v: number }>;
  median: number;
  low: { v: number; t: number };
  high: { v: number; t: number };
  current: number;
  /** Part des semaines où le multiple était plus élevé qu'aujourd'hui. */
  higherShare: number;
  since: number;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(key: MultipleKey, points: Array<{ t: number; v: number }>): MultipleSeries | null {
  if (points.length < 26) return null; // moins de six mois d'historique : pas de statistique
  let low = points[0];
  let high = points[0];
  for (const p of points) {
    if (p.v < low.v) low = p;
    if (p.v > high.v) high = p;
  }
  const current = points[points.length - 1].v;
  return {
    key,
    label: MULTIPLE_LABELS[key],
    points,
    median: median(points.map((p) => p.v)),
    low,
    high,
    current,
    higherShare: points.filter((p) => p.v > current).length / points.length,
    since: points[0].t,
  };
}

/**
 * Multiples à chaque point de cours. `prices` en devise des comptes (cours
 * converti) ; `quotePrices` + `dividends` en devise de cotation pour le
 * rendement du dividende (12 mois glissants). `maxYears` borne la fenêtre.
 */
export function valuationHistory(
  prices: readonly MarketPoint[],
  snapshots: readonly Snapshot[],
  options: { dividends?: readonly MarketDividend[]; quotePrices?: readonly MarketPoint[]; maxYears?: number } = {}
): Partial<Record<MultipleKey, MultipleSeries>> {
  const { dividends = [], quotePrices = prices, maxYears = 10 } = options;
  if (prices.length === 0 || snapshots.length === 0) return {};
  const from = prices[prices.length - 1].t - maxYears * 365.25 * DAY_S;
  const series: Record<MultipleKey, Array<{ t: number; v: number }>> = {
    per: [], priceToFcf: [], priceToSales: [], evToEbitda: [], priceToBook: [], dividendYield: [],
  };

  let j = -1;
  for (const p of prices) {
    while (j + 1 < snapshots.length && snapshots[j + 1].effective <= p.t) j++;
    if (j < 0 || p.t < from || p.c <= 0) continue;
    const m = multiplesAt(p.c, snapshots[j]);
    for (const key of Object.keys(m) as Array<keyof typeof m>) {
      const v = m[key];
      if (v !== null && Number.isFinite(v)) series[key].push({ t: p.t, v });
    }
  }

  // Rendement du dividende : dividendes des 12 derniers mois / cours, en devise de cotation.
  if (dividends.length > 0) {
    const dates = dividends.map((d) => ({ t: toSec(d.date), amount: d.amount }));
    for (const p of quotePrices) {
      if (p.t < from || p.c <= 0) continue;
      const total = dates.filter((d) => d.t <= p.t && d.t > p.t - 365 * DAY_S).reduce((a, d) => a + d.amount, 0);
      if (total > 0) series.dividendYield.push({ t: p.t, v: total / p.c });
    }
  }

  const out: Partial<Record<MultipleKey, MultipleSeries>> = {};
  for (const key of Object.keys(series) as MultipleKey[]) {
    const summary = summarize(key, series[key]);
    if (summary) out[key] = summary;
  }
  return out;
}

export type ReferenceMethod = 'perMedian' | 'pfcfMedian' | 'psMedian' | 'dcf' | 'graham' | 'analysts';

export interface ValuationReference {
  method: ReferenceMethod;
  label: string;
  /** Valeur par action, en devise de cotation. */
  value: number;
  detail: string;
}

/**
 * Repères de valorisation : ce que vaudrait l'action si elle retrouvait son
 * multiple médian, selon un DCF par défaut, le nombre de Graham ou l'objectif
 * des analystes. Valeurs en devise des comptes, converties par `toQuote`.
 */
export function valuationReferences(input: {
  multiples: Partial<Record<MultipleKey, MultipleSeries>>;
  ttm: { eps: number | null; fcfPerShare: number | null; salesPerShare: number | null };
  dcfValue: number | null;
  grahamNumber: number | null;
  analystTarget: number | null;
  toQuote: (statementCurrencyValue: number) => number;
  formatMultiple: (v: number) => string;
}): ValuationReference[] {
  const { multiples, ttm, toQuote, formatMultiple } = input;
  const refs: ValuationReference[] = [];
  const years = (s: MultipleSeries) => Math.max(1, Math.round((s.points[s.points.length - 1].t - s.since) / (365.25 * DAY_S)));
  const fromMedian = (method: ReferenceMethod, key: MultipleKey, perShare: number | null, what: string) => {
    const s = multiples[key];
    if (!s || !positive(perShare)) return;
    refs.push({
      method,
      label: `${s.label} médian`,
      value: toQuote(s.median * perShare),
      detail: `${s.label} médian sur ${years(s)} ans (${formatMultiple(s.median)}) × ${what} des 12 derniers mois.`,
    });
  };
  fromMedian('perMedian', 'per', ttm.eps, 'bénéfice par action');
  fromMedian('pfcfMedian', 'priceToFcf', ttm.fcfPerShare, 'free cash flow par action');
  fromMedian('psMedian', 'priceToSales', ttm.salesPerShare, 'chiffre d’affaires par action');
  if (positive(input.dcfValue)) {
    refs.push({ method: 'dcf', label: 'DCF (hypothèses par défaut)', value: toQuote(input.dcfValue), detail: 'Flux de trésorerie futurs actualisés, avec les hypothèses par défaut du simulateur.' });
  }
  if (positive(input.grahamNumber)) {
    refs.push({ method: 'graham', label: 'Nombre de Graham', value: toQuote(input.grahamNumber), detail: '√(22,5 × BPA × actif net par action) : prix plafond d’un investisseur prudent selon Benjamin Graham.' });
  }
  if (positive(input.analystTarget)) {
    refs.push({ method: 'analysts', label: 'Objectif des analystes', value: input.analystTarget, detail: 'Moyenne des objectifs de cours publiés à 12 mois.' });
  }
  return refs;
}
