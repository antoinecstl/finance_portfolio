// Derniers trimestres (ou semestres) publiés et leur variation sur un an
// (docs/specs/explorateur-marches-v2.md §4.2). Chaque poste est lu à part :
// une société peut publier son chiffre d'affaires chaque trimestre et ses
// résultats chaque semestre. Fonctions pures.

import { itemSeries, type SeriesMap, type SeriesPoint } from './fundamentals';

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

/** Derniers trimestres ou semestres de chaque poste (8 au plus), avec la variation sur un an. */
export function buildRecentPeriods(series: SeriesMap, max = 8): RecentPeriods {
  const out: RecentPeriods = {};
  for (const { key } of QUARTER_METRICS) {
    const raw = (key === 'freeCashFlow' ? freeCashFlowPoints(series) : itemSeries(series, 'quarterly', key) ?? [])
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
    const kind = kindOf(raw);
    if (!kind) continue;
    const run = lastRegularRun(raw, kind);
    if (run.length < 2) continue;
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
