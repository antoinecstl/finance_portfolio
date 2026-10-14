// Onglet Performance de l'explorateur de marchés (docs/specs/explorateur-marches-v2.md §4.1).
// Fonctions pures, calculées par Fi-Hub à partir de l'historique de cours :
// valable pour tout actif (action, ETF, crypto, indice, devise…).

import type { MarketPoint } from './chart-data';

const DAY_S = 86_400;
const YEAR_S = 365.25 * DAY_S;

/** Année et mois (1-12) d'un instant, dans le fuseau de la place de cotation. */
export function yearMonthIn(t: number, timeZone: string): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric' }).formatToParts(new Date(t * 1000));
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(year) && Number.isFinite(month)) return { year, month };
  } catch {
    // Fuseau inconnu : UTC.
  }
  const d = new Date(t * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

const isoDate = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

/** Rendement total disponible : clôtures ajustées présentes et différentes du cours (dividendes). */
export function hasTotalReturn(points: readonly MarketPoint[]): boolean {
  const withAdjusted = points.filter((p) => p.ac !== undefined);
  if (withAdjusted.length < points.length * 0.9 || withAdjusted.length < 2) return false;
  const first = withAdjusted[0];
  const last = withAdjusted[withAdjusted.length - 1];
  const priceGrowth = last.c / first.c;
  const totalGrowth = (last.ac as number) / (first.ac as number);
  return Math.abs(totalGrowth / priceGrowth - 1) > 0.001;
}

const valueOf = (p: MarketPoint, total: boolean) => (total ? p.ac ?? p.c : p.c);

/** Dernière clôture de chaque mois (clé `année*12 + mois-1`), dans l'ordre. */
export function monthEndCloses(points: readonly MarketPoint[], timeZone: string): Array<{ key: number; year: number; month: number; point: MarketPoint }> {
  const byMonth = new Map<number, { key: number; year: number; month: number; point: MarketPoint }>();
  for (const point of points) {
    const { year, month } = yearMonthIn(point.t, timeZone);
    const key = year * 12 + (month - 1);
    const current = byMonth.get(key);
    if (!current || point.t >= current.point.t) byMonth.set(key, { key, year, month, point });
  }
  return [...byMonth.values()].sort((a, b) => a.key - b.key);
}

export interface AnnualReturn {
  year: number;
  price: number | null;
  total: number | null;
  /** Année incomplète : première année de cotation ou année en cours. */
  partial: boolean;
}

/**
 * Performance par année civile : dernière clôture de l'année / dernière clôture
 * de l'année précédente − 1. La première année part de la première cotation.
 */
export function annualReturns(points: readonly MarketPoint[], timeZone: string, now: Date = new Date()): AnnualReturn[] {
  const months = monthEndCloses(points, timeZone);
  if (months.length < 2) return [];
  const withTotal = hasTotalReturn(points);
  const yearEnd = new Map<number, MarketPoint>();
  for (const m of months) yearEnd.set(m.year, m.point);
  const years = [...yearEnd.keys()].sort((a, b) => a - b);
  const firstPoint = months[0].point;
  const currentYear = yearMonthIn(Math.floor(now.getTime() / 1000), timeZone).year;
  const out: AnnualReturn[] = [];
  years.forEach((year, i) => {
    const end = yearEnd.get(year) as MarketPoint;
    const start = i === 0 ? firstPoint : (yearEnd.get(years[i - 1]) as MarketPoint);
    if (start === end) return;
    const perf = (total: boolean) => {
      const a = valueOf(start, total);
      const b = valueOf(end, total);
      return a > 0 ? b / a - 1 : null;
    };
    out.push({
      year,
      price: perf(false),
      total: withTotal ? perf(true) : null,
      partial: i === 0 || year >= currentYear,
    });
  });
  return out;
}

export interface MonthlyReturns {
  years: Array<{ year: number; months: Array<number | null>; total: number | null }>;
  /** Moyenne de chaque mois sur les années affichées. */
  average: Array<number | null>;
  /** Part des années où le mois a été positif. */
  positiveShare: Array<number | null>;
}

/** Variations mensuelles des `maxYears` dernières années (les plus récentes d'abord). */
export function monthlyReturns(points: readonly MarketPoint[], timeZone: string, maxYears = 10): MonthlyReturns {
  const months = monthEndCloses(points, timeZone);
  const byYear = new Map<number, Array<number | null>>();
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1];
    const cur = months[i];
    if (cur.key !== prev.key + 1 || prev.point.c <= 0) continue; // mois manquant : pas de variation inventée
    const row = byYear.get(cur.year) ?? new Array(12).fill(null);
    row[cur.month - 1] = cur.point.c / prev.point.c - 1;
    byYear.set(cur.year, row);
  }
  const annual = new Map(annualReturns(points, timeZone).map((a) => [a.year, a.price]));
  const years = [...byYear.keys()].sort((a, b) => b - a).slice(0, maxYears)
    .map((year) => ({ year, months: byYear.get(year) as Array<number | null>, total: annual.get(year) ?? null }));
  const average: Array<number | null> = [];
  const positiveShare: Array<number | null> = [];
  for (let m = 0; m < 12; m++) {
    const values = years.map((y) => y.months[m]).filter((v): v is number => v !== null);
    average.push(values.length >= 2 ? values.reduce((a, b) => a + b, 0) / values.length : null);
    positiveShare.push(values.length >= 2 ? values.filter((v) => v > 0).length / values.length : null);
  }
  return { years, average, positiveShare };
}

export interface DrawdownStats {
  /** Plus forte baisse depuis un plus haut (≤ 0). */
  value: number;
  peakDate: string;
  troughDate: string;
  /** Date du retour au plus haut précédent, null si pas encore rattrapé. */
  recoveryDate: string | null;
  /** Plus longue période passée sous un ancien plus haut, en jours. */
  longestUnderwaterDays: number;
}

/** Courbe « sous l'eau » : écart de chaque clôture au plus haut atteint jusque-là. */
export function drawdownSeries(points: readonly MarketPoint[]): Array<{ t: number; dd: number }> {
  let peak = 0;
  return points.filter((p) => p.c > 0).map((p) => {
    peak = Math.max(peak, p.c);
    return { t: p.t, dd: p.c / peak - 1 };
  });
}

export function drawdownStats(points: readonly MarketPoint[]): DrawdownStats | null {
  const valid = points.filter((p) => p.c > 0);
  if (valid.length < 2) return null;
  let peak = valid[0];
  let worst = { value: 0, peak: valid[0], trough: valid[0] };
  let underwaterSince: MarketPoint | null = null;
  let longest = 0;
  for (const p of valid) {
    if (p.c >= peak.c) {
      if (underwaterSince) longest = Math.max(longest, (p.t - underwaterSince.t) / DAY_S);
      underwaterSince = null;
      peak = p;
      continue;
    }
    if (!underwaterSince) underwaterSince = peak;
    const dd = p.c / peak.c - 1;
    if (dd < worst.value) worst = { value: dd, peak, trough: p };
  }
  if (underwaterSince) longest = Math.max(longest, (valid[valid.length - 1].t - underwaterSince.t) / DAY_S);
  const recovery = valid.find((p) => p.t > worst.trough.t && p.c >= worst.peak.c) ?? null;
  return {
    value: worst.value,
    peakDate: isoDate(worst.peak.t),
    troughDate: isoDate(worst.trough.t),
    recoveryDate: worst.value < 0 ? (recovery ? isoDate(recovery.t) : null) : null,
    longestUnderwaterDays: Math.round(longest),
  };
}

/** Échantillonne une série longue pour l'affichage (garde le premier, le dernier et le minimum). */
export function downsample<T extends { t: number }>(series: readonly T[], maxPoints: number, keep?: (p: T) => number): T[] {
  if (series.length <= maxPoints) return [...series];
  const step = series.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(series[Math.floor(i * step)]);
  if (keep) {
    const extreme = series.reduce((a, b) => (keep(b) < keep(a) ? b : a));
    if (!out.includes(extreme)) out.push(extreme);
  }
  const last = series[series.length - 1];
  if (out[out.length - 1] !== last && !out.includes(last)) out.push(last);
  return out.sort((a, b) => a.t - b.t);
}

/** Croissance annuelle moyenne entre deux points (null sous 0,9 an d'écart). */
export function growthRate(first: MarketPoint | undefined, last: MarketPoint | undefined, total: boolean): number | null {
  if (!first || !last) return null;
  const years = (last.t - first.t) / YEAR_S;
  const a = valueOf(first, total);
  const b = valueOf(last, total);
  if (years < 0.9 || a <= 0 || b <= 0) return null;
  return Math.pow(b / a, 1 / years) - 1;
}

/** Premier point au plus tôt `years` ans avant le dernier (tolérance 10 jours). */
export function pointYearsBefore(points: readonly MarketPoint[], years: number): MarketPoint | undefined {
  if (points.length === 0) return undefined;
  const target = points[points.length - 1].t - years * YEAR_S;
  if (points[0].t > target + 10 * DAY_S) return undefined;
  let candidate = points[0];
  for (const p of points) {
    if (p.t > target) break;
    candidate = p;
  }
  return candidate;
}

/**
 * Régularité de la tendance : coefficient de détermination (R²) de la droite
 * des moindres carrés sur le logarithme du cours. 1 = progression parfaitement
 * régulière, 0 = aucune tendance.
 */
export function trendLinearity(points: readonly MarketPoint[]): number | null {
  const valid = points.filter((p) => p.c > 0);
  if (valid.length < 30) return null;
  const xs = valid.map((p) => p.t / YEAR_S);
  const ys = valid.map((p) => Math.log(p.c));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return (sxy * sxy) / (sxx * syy);
}

/** Volatilité annualisée des rendements logarithmiques sur les `years` dernières années. */
export function volatilityOver(points: readonly MarketPoint[], years: number, periodsPerYear: number): number | null {
  if (points.length < 2) return null;
  const from = points[points.length - 1].t - years * YEAR_S;
  const window = points.filter((p) => p.t >= from && p.c > 0);
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) returns.push(Math.log(window[i].c / window[i - 1].c));
  if (returns.length < 60) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * periodsPerYear);
}

/** Plus haut historique : le plus haut des barres quotidiennes et mensuelles. */
export function allTimeHigh(daily: readonly MarketPoint[], monthly: readonly MarketPoint[]): { value: number; date: string } | null {
  let best: MarketPoint | null = null;
  for (const p of [...monthly, ...daily]) {
    const h = Math.max(p.h, p.c);
    if (h > 0 && (!best || h > Math.max(best.h, best.c))) best = p;
  }
  return best ? { value: Math.max(best.h, best.c), date: isoDate(best.t) } : null;
}

/** Corrélation de Pearson des variations quotidiennes, sur les dates communes. */
export function returnsCorrelation(a: readonly MarketPoint[], b: readonly MarketPoint[], minCommon = 60): number | null {
  const day = (t: number) => isoDate(t);
  const closesB = new Map(b.map((p) => [day(p.t), p.c]));
  const pairs: Array<[number, number]> = [];
  let prev: { a: number; b: number } | null = null;
  for (const p of a) {
    const cb = closesB.get(day(p.t));
    if (cb === undefined || cb <= 0 || p.c <= 0) continue;
    if (prev) pairs.push([Math.log(p.c / prev.a), Math.log(cb / prev.b)]);
    prev = { a: p.c, b: cb };
  }
  if (pairs.length < minCommon) return null;
  const n = pairs.length;
  const ma = pairs.reduce((s, [x]) => s + x, 0) / n;
  const mb = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (const [x, y] of pairs) {
    cov += (x - ma) * (y - mb);
    va += (x - ma) ** 2;
    vb += (y - mb) ** 2;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}

export interface PerformanceStats {
  growth: Array<{ key: '5A' | '10A' | 'MAX'; price: number | null; total: number | null; since: string | null }>;
  linearity: number | null;
  volatility3y: number | null;
  maxDrawdown: DrawdownStats | null;
  allTimeHigh: { value: number; date: string; distance: number | null } | null;
  bestYear: { year: number; value: number } | null;
  worstYear: { year: number; value: number } | null;
  positiveYears: { count: number; of: number } | null;
}

export interface PerformanceReport {
  stats: PerformanceStats;
  annualReturns: AnnualReturn[];
  monthly: MonthlyReturns;
  drawdown: Array<{ t: number; dd: number }>;
  totalReturnAvailable: boolean;
}

/**
 * Rapport complet : `daily` = 10 ans de clôtures quotidiennes, `monthly` =
 * clôtures mensuelles depuis l'origine (années anciennes et plus haut historique).
 */
export function buildPerformanceReport(
  daily: readonly MarketPoint[],
  monthly: readonly MarketPoint[],
  options: { timeZone: string; price: number | null; periodsPerYear: number; now?: Date }
): PerformanceReport {
  const { timeZone, periodsPerYear, now = new Date() } = options;
  const long = monthly.length >= 2 ? monthly : daily;
  const annual = annualReturns(long, timeZone, now);
  // Les années couvertes par l'historique quotidien sont recalculées dessus (clôtures exactes).
  const dailyAnnual = new Map(annualReturns(daily, timeZone, now).map((a) => [a.year, a]));
  const firstDailyYear = daily.length > 0 ? yearMonthIn(daily[0].t, timeZone).year : Infinity;
  const merged = annual.map((a) => (a.year > firstDailyYear && dailyAnnual.has(a.year) ? (dailyAnnual.get(a.year) as AnnualReturn) : a));
  const totalReturnAvailable = hasTotalReturn(daily.length >= 2 ? daily : long);

  const lastDaily = daily[daily.length - 1];
  const origin = long[0];
  const latest = lastDaily ?? long[long.length - 1];
  const growthRow = (key: PerformanceStats['growth'][number]['key'], first: MarketPoint | undefined, last: MarketPoint | undefined) => ({
    key,
    price: growthRate(first, last, false),
    total: totalReturnAvailable && first?.ac !== undefined ? growthRate(first, last, true) : null,
    since: first ? isoDate(first.t) : null,
  });
  const growth: PerformanceStats['growth'] = [
    growthRow('5A', pointYearsBefore(daily, 5), lastDaily),
    growthRow('10A', pointYearsBefore(daily, 10), lastDaily),
    growthRow('MAX', origin, latest),
  ];

  const complete = merged.filter((a) => !a.partial && a.price !== null) as Array<AnnualReturn & { price: number }>;
  const best = complete.reduce<AnnualReturn & { price: number } | null>((acc, a) => (!acc || a.price > acc.price ? a : acc), null);
  const worst = complete.reduce<AnnualReturn & { price: number } | null>((acc, a) => (!acc || a.price < acc.price ? a : acc), null);
  const ath = allTimeHigh(daily, monthly);
  const price = options.price ?? latest?.c ?? null;

  return {
    stats: {
      growth,
      linearity: trendLinearity(daily),
      volatility3y: volatilityOver(daily, 3, periodsPerYear),
      maxDrawdown: drawdownStats(daily),
      allTimeHigh: ath ? { ...ath, distance: price !== null && ath.value > 0 ? price / ath.value - 1 : null } : null,
      bestYear: best ? { year: best.year, value: best.price } : null,
      worstYear: worst ? { year: worst.year, value: worst.price } : null,
      positiveYears: complete.length >= 3 ? { count: complete.filter((a) => a.price > 0).length, of: complete.length } : null,
    },
    annualReturns: merged.slice(-30),
    monthly: monthlyReturns(daily.length > 260 ? daily : long, timeZone),
    drawdown: downsample(drawdownSeries(daily), 520, (p) => p.dd),
    totalReturnAvailable,
  };
}
