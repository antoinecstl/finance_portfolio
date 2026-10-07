// Indicateurs de l'explorateur de marchés. Définitions : spec §6
// (docs/specs/explorateur-marches.md). Fonctions pures, temps en secondes Unix.

import type { MarketDividend, MarketPoint } from './chart-data';

export type PerformanceKey = '1S' | '1M' | '3M' | '6M' | 'YTD' | '1A' | '3A' | '5A';
export const PERFORMANCE_KEYS: readonly PerformanceKey[] = ['1S', '1M', '3M', '6M', 'YTD', '1A', '3A', '5A'];

const DAY = 86_400;
const TOLERANCE = 7 * DAY;

const toSec = (date: Date) => Math.floor(date.getTime() / 1000);

function monthsAgo(now: Date, months: number): number {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return toSec(d);
}

export function performanceStart(key: PerformanceKey, now: Date): number {
  switch (key) {
    case '1S': return toSec(now) - 7 * DAY;
    case '1M': return monthsAgo(now, 1);
    case '3M': return monthsAgo(now, 3);
    case '6M': return monthsAgo(now, 6);
    case 'YTD': return Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000) - 1; // dernière clôture de l'année précédente
    case '1A': return monthsAgo(now, 12);
    case '3A': return monthsAgo(now, 36);
    case '5A': return monthsAgo(now, 60);
  }
}

// Dernière clôture au plus tard à `t`. Si l'historique commence après `t`, on
// accepte le premier point s'il tombe dans les 7 jours suivants (week-end,
// jour férié) ; au-delà, l'historique est trop court.
export function closeAtOrBefore(points: readonly MarketPoint[], t: number): number | null {
  if (points.length === 0) return null;
  if (points[0].t > t) return points[0].t - t <= TOLERANCE ? points[0].c : null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].c;
}

export function performanceByPeriod(
  points: readonly MarketPoint[],
  price: number,
  now: Date = new Date()
): Record<PerformanceKey, number | null> {
  const out = {} as Record<PerformanceKey, number | null>;
  for (const key of PERFORMANCE_KEYS) {
    const ref = closeAtOrBefore(points, performanceStart(key, now));
    out[key] = ref && ref > 0 && Number.isFinite(price) ? price / ref - 1 : null;
  }
  return out;
}

const lastYear = (points: readonly MarketPoint[], now: Date) => {
  const from = monthsAgo(now, 12);
  return points.filter((p) => p.t >= from && p.c > 0);
};

// Écart-type des rendements logarithmiques quotidiens × √(séances par an).
export function annualizedVolatility(
  points: readonly MarketPoint[],
  now: Date = new Date(),
  periodsPerYear = 252
): number | null {
  const window = lastYear(points, now);
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) returns.push(Math.log(window[i].c / window[i - 1].c));
  if (returns.length < 20) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

// Plus forte baisse d'un plus haut vers un plus bas ultérieur (valeur ≤ 0).
export function maxDrawdown(points: readonly MarketPoint[], now: Date = new Date()): number | null {
  const window = lastYear(points, now);
  if (window.length < 2) return null;
  let peak = window[0].c;
  let worst = 0;
  for (const p of window) {
    if (p.c > peak) peak = p.c;
    worst = Math.min(worst, p.c / peak - 1);
  }
  return worst;
}

export function averageVolume(points: readonly MarketPoint[], now: Date = new Date(), months = 3): number | null {
  const from = monthsAgo(now, months);
  const volumes = points.filter((p) => p.t >= from && p.v > 0).map((p) => p.v);
  if (volumes.length === 0) return null;
  return volumes.reduce((a, b) => a + b, 0) / volumes.length;
}

export function dividendsByYear(
  dividends: readonly MarketDividend[],
  now: Date = new Date(),
  years = 5
): Array<{ year: number; total: number; count: number }> {
  const current = now.getUTCFullYear();
  const rows: Array<{ year: number; total: number; count: number }> = [];
  for (let year = current - years + 1; year <= current; year++) {
    const inYear = dividends.filter((d) => Number(d.date.slice(0, 4)) === year);
    rows.push({ year, total: inYear.reduce((a, d) => a + d.amount, 0), count: inYear.length });
  }
  return rows;
}

export function trailingDividendYield(
  dividends: readonly MarketDividend[],
  price: number,
  now: Date = new Date()
): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const from = new Date(now.getTime() - 365 * DAY * 1000).toISOString().slice(0, 10);
  const total = dividends.filter((d) => d.date > from).reduce((a, d) => a + d.amount, 0);
  return total > 0 ? total / price : null;
}

// Moyenne mobile simple ; null tant que la fenêtre n'est pas remplie.
export function simpleMovingAverage(values: readonly number[], window: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (window < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

// Aligne une série sur une chronologie de référence : pour chaque instant, la
// dernière clôture connue au plus tard à cet instant (+ tolérance pour les
// places qui datent leurs barres hebdo/mensuelles différemment).
export function alignToTimeline(
  timeline: readonly number[],
  series: readonly MarketPoint[],
  toleranceSec = 0
): Array<number | null> {
  const out: Array<number | null> = [];
  let j = -1;
  for (const t of timeline) {
    while (j + 1 < series.length && series[j + 1].t <= t + toleranceSec) j++;
    out.push(j >= 0 ? series[j].c : null);
  }
  return out;
}

// Variation depuis la première valeur non nulle (base 0 %).
export function toRelativeChange(values: ReadonlyArray<number | null>): Array<number | null> {
  const base = values.find((v): v is number => v !== null && v > 0);
  if (base === undefined) return values.map(() => null);
  return values.map((v) => (v === null ? null : v / base - 1));
}

// Position du cours dans la fourchette 52 semaines (0 = plus bas, 1 = plus haut).
export function rangePosition(price: number, low: number | null, high: number | null): number | null {
  if (low === null || high === null || !Number.isFinite(price) || high <= low) return null;
  return Math.min(1, Math.max(0, (price - low) / (high - low)));
}
