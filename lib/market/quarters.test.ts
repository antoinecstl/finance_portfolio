import { describe, expect, it } from 'vitest';
import type { SeriesMap } from './fundamentals';
import { buildRecentPeriods, yearToDate } from './quarters';

const pts = (rows: Array<[string, number]>) => rows.map(([date, value]) => ({ date, value, currency: 'EUR' }));

describe('recent periods', () => {
  const series: SeriesMap = {
    // Chiffre d'affaires trimestriel sur 7 trimestres.
    quarterlyTotalRevenue: pts([
      ['2025-03-31', 100], ['2025-06-30', 110], ['2025-09-30', 105], ['2025-12-31', 120],
      ['2026-03-31', 104], ['2026-06-30', 99], ['2026-09-30', 112],
    ]),
    // Résultats publiés par semestre seulement.
    quarterlyNetIncomeCommonStockholders: pts([['2024-12-31', -5], ['2025-06-30', 20], ['2025-12-31', 22], ['2026-06-30', 25]]),
    // Pas de FCF publié : flux d'exploitation + investissements.
    quarterlyOperatingCashFlow: pts([['2026-03-31', 30], ['2026-06-30', 35]]),
    quarterlyCapitalExpenditure: pts([['2026-03-31', -10], ['2026-06-30', -12]]),
  };
  const periods = buildRecentPeriods(series);

  it('labels quarters and compares each with the same quarter a year earlier', () => {
    const revenue = periods.revenue!;
    expect(revenue.kind).toBe('quarter');
    expect(revenue.points.map((p) => p.label)).toEqual(['T1 2025', 'T2 2025', 'T3 2025', 'T4 2025', 'T1 2026', 'T2 2026', 'T3 2026']);
    expect(revenue.points[4].yoy).toBeCloseTo(0.04, 10);
    expect(revenue.points[5].yoy).toBeCloseTo(-0.1, 10);
    expect(revenue.points[0].yoy).toBeNull();
  });

  it('detects half-year reporting per item and skips negative bases', () => {
    const net = periods.netIncome!;
    expect(net.kind).toBe('half');
    expect(net.points.map((p) => p.label)).toEqual(['S2 2024', 'S1 2025', 'S2 2025', 'S1 2026']);
    expect(net.points[2].yoy).toBeNull(); // base négative (S2 2024)
    expect(net.points[3].yoy).toBeCloseTo(0.25, 10);
  });

  it('derives the free cash flow and drops irregular series', () => {
    expect(periods.freeCashFlow?.points.map((p) => p.value)).toEqual([20, 23]);
    const irregular = buildRecentPeriods({ quarterlyDilutedEPS: pts([['2025-12-31', 1], ['2026-09-30', 2]]) });
    expect(irregular.eps).toBeUndefined();
    // Un trou coupe la suite : seuls les trimestres réguliers récents restent.
    const gap = buildRecentPeriods({ quarterlyDilutedEPS: pts([['2024-03-31', 1], ['2025-03-31', 1], ['2025-06-30', 1], ['2025-09-30', 1]]) });
    expect(gap.eps?.points.map((p) => p.label)).toEqual(['T1 2025', 'T2 2025', 'T3 2025']);
  });

  it('sums the current year against the same periods a year earlier', () => {
    const ytd = yearToDate(periods.revenue!);
    expect(ytd).toMatchObject({ year: 2026, through: 3, value: 315, previous: 315 });
    expect(ytd?.change).toBeCloseTo(0, 10);
    expect(yearToDate({ kind: 'quarter', points: periods.revenue!.points.slice(4) })).toBeNull();
  });
});
