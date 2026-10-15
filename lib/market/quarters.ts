// Derniers trimestres (ou semestres) publiés et leur variation sur un an
// (docs/specs/explorateur-marches-v2.md §4.2). Chaque poste est lu à part :
// une société peut publier son chiffre d'affaires chaque trimestre et ses
// résultats chaque semestre. Fonctions pures.
//
// Garde-fous : le fournisseur reconstitue parfois des trimestres pour des
// sociétés qui ne publient que des semestres (ex. LVMH : +28 % sur un trimestre
// d'une année en baisse). Une période n'est montrée que si la société publie un
// BPA au même rythme, et si les trimestres se recoupent avec l'exercice annuel
// et les 12 mois glissants publiés.

import { itemSeries, type SeriesMap, type SeriesPoint, type StatementItem } from './fundamentals';

export type PeriodKind = 'quarter' | 'half';
export type QuarterMetric = 'revenue' | 'operatingIncome' | 'netIncome' | 'eps' | 'freeCashFlow';

export const QUARTER_METRICS: Array<{ key: QuarterMetric; label: string; perShare?: boolean }> = [
  { key: 'revenue', label: 'Chiffre d’affaires' },
  { key: 'operatingIncome', label: 'Résultat opérationnel' },
  { key: 'netIncome', label: 'Résultat net' },
  { key: 'eps', label: 'BPA', perShare: true },
  { key: 'freeCashFlow', label: 'Free cash flow' },
];

export interface PeriodPoint {
  date: string; // fin de période
  /** « T1 2026 », « S1 2026 » (trimestre ou semestre civil de la date de fin). */
  label: string;
  year: number;
  /** 1 à 4 (trimestre) ou 1 à 2 (semestre). */
  index: number;
  value: number;
  /** Variation par rapport à la même période un an plus tôt ; null si la base est nulle ou négative. */
  yoy: number | null;
}

export interface MetricPeriods {
  kind: PeriodKind;
  points: PeriodPoint[];
}

export type RecentPeriods = Partial<Record<QuarterMetric, MetricPeriods>>;

const DAY_MS = 86_400_000;
const NOMINAL_DAYS: Record<PeriodKind, number> = { quarter: 91, half: 182 };
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY_MS;

function kindOf(points: SeriesPoint[]): PeriodKind | null {
  const gaps = points.slice(1).map((p, i) => daysBetween(points[i].date, p.date)).sort((a, b) => a - b);
  if (gaps.length === 0) return null;
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median >= 75 && median <= 110) return 'quarter';
  if (median >= 160 && median <= 200) return 'half';
  return null;
}

/** Garde la dernière suite régulière de périodes (un trou ou un changement de rythme coupe la suite). */
function lastRegularRun(points: SeriesPoint[], kind: PeriodKind): SeriesPoint[] {
  let start = points.length - 1;
  while (start > 0 && Math.abs(daysBetween(points[start - 1].date, points[start].date) - NOMINAL_DAYS[kind]) <= 25) start--;
  return points.slice(start);
}

function labelOf(date: string, kind: PeriodKind): Pick<PeriodPoint, 'label' | 'year' | 'index'> {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const index = kind === 'quarter' ? Math.floor((month - 1) / 3) + 1 : month <= 6 ? 1 : 2;
  return { label: `${kind === 'quarter' ? 'T' : 'S'}${index} ${year}`, year, index };
}

/** Free cash flow trimestriel : publié, sinon flux d'exploitation + investissements (négatifs). */
function freeCashFlowPoints(series: SeriesMap): SeriesPoint[] {
  const published = itemSeries(series, 'quarterly', 'freeCashFlow') ?? [];
  if (published.length > 0) return published;
  const capex = new Map((itemSeries(series, 'quarterly', 'capitalExpenditure') ?? []).map((p) => [p.date, p.value]));
  return (itemSeries(series, 'quarterly', 'operatingCashFlow') ?? [])
    .filter((p) => capex.has(p.date))
    .map((p) => ({ ...p, value: p.value + (capex.get(p.date) as number) }));
}

/** Écart relatif toléré entre la somme des périodes et le total publié. */
export const RECONCILE_TOLERANCE = 0.03;

const close = (a: number, b: number) => Math.abs(a - b) <= RECONCILE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b), 1);

/**
 * Les périodes se recoupent-elles avec les totaux publiés ? Pour chaque exercice
 * annuel (ou 12 mois glissants) dont toutes les périodes sont présentes, leur
 * somme doit retrouver le total à 3 % près. Le BPA n'est pas additif à
 * nombre d'actions variable : il n'est pas contrôlé ainsi.
 */
function reconciles(run: SeriesPoint[], kind: PeriodKind, totals: SeriesPoint[]): boolean {
  const perYear = kind === 'quarter' ? 4 : 2;
  for (const total of totals) {
    const end = run.findIndex((p) => Math.abs(daysBetween(p.date, total.date)) <= 20);
    if (end < perYear - 1) continue;
    const window = run.slice(end - perYear + 1, end + 1);
    if (daysBetween(window[0].date, total.date) > 365 - NOMINAL_DAYS[kind] + 30) continue; // périodes non consécutives
    if (!close(window.reduce((a, p) => a + p.value, 0), total.value)) return false;
  }
  return true;
}

/** Totaux publiés d'un poste : exercices annuels et 12 mois glissants. */
function totalsOf(series: SeriesMap, key: StatementItem): SeriesPoint[] {
  return [...(itemSeries(series, 'annual', key) ?? []), ...(itemSeries(series, 'trailing', key) ?? [])];
}

/** Derniers trimestres ou semestres de chaque poste (8 au plus), avec la variation sur un an. */
export function buildRecentPeriods(series: SeriesMap, max = 8): RecentPeriods {
  const out: RecentPeriods = {};
  // Rythme de publication des résultats : sans BPA au même rythme, les périodes
  // du fournisseur sont des reconstitutions, pas des comptes publiés.
  const epsPoints = (itemSeries(series, 'quarterly', 'eps') ?? []).filter((p) => Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
  const epsKind = kindOf(epsPoints);
  if (!epsKind) return out;
  const epsDates = new Set(epsPoints.map((p) => p.date));
  for (const { key } of QUARTER_METRICS) {
    const raw = (key === 'freeCashFlow' ? freeCashFlowPoints(series) : itemSeries(series, 'quarterly', key) ?? [])
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
    const kind = kindOf(raw);
    if (!kind || kind !== epsKind) continue;
    // Seules les périodes pour lesquelles un BPA est publié.
    const run = lastRegularRun(raw.filter((p) => epsDates.has(p.date)), kind);
    if (run.length < 2) continue;
    if (key !== 'eps' && !reconciles(run, kind, key === 'freeCashFlow' ? totalsOf(series, 'freeCashFlow') : totalsOf(series, key))) continue;
    const points = run.map((p) => {
      const previous = run.find((q) => Math.abs(daysBetween(q.date, p.date) - 365) <= 25);
      return {
        date: p.date,
        ...labelOf(p.date, kind),
        value: p.value,
        yoy: previous && previous.value > 0 ? (p.value - previous.value) / previous.value : null,
      };
    });
    out[key] = { kind, points: points.slice(-max) };
  }
  return out;
}

/**
 * Cumul de l'année en cours (année de la dernière période) comparé aux mêmes
 * périodes de l'année précédente. Null si une période de comparaison manque.
 */
export function yearToDate(periods: MetricPeriods): { year: number; through: number; value: number; previous: number; change: number | null } | null {
  const last = periods.points.at(-1);
  if (!last) return null;
  const current = periods.points.filter((p) => p.year === last.year);
  const previous = current.map((p) => periods.points.find((q) => q.year === last.year - 1 && q.index === p.index));
  if (previous.some((p) => !p)) return null;
  const value = current.reduce((a, p) => a + p.value, 0);
  const before = (previous as PeriodPoint[]).reduce((a, p) => a + p.value, 0);
  return { year: last.year, through: last.index, value, previous: before, change: before > 0 ? value / before - 1 : null };
}
