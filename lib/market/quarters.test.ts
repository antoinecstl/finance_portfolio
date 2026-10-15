import { describe, expect, it } from 'vitest';
import type { SeriesMap } from './fundamentals';
import { buildRecentPeriods, yearToDate } from './quarters';

const pts = (rows: Array<[string, number]>) => rows.map(([date, value]) => ({ date, value, currency: 'EUR' }));
const QUARTERS = ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'];

describe('recent periods', () => {
  // Société qui publie des comptes trimestriels complets.
  const quarterly: SeriesMap = {
    quarterlyTotalRevenue: pts([[QUARTERS[0], 100], [QUARTERS[1], 110], [QUARTERS[2], 105], [QUARTERS[3], 120], [QUARTERS[4], 104], [QUARTERS[5], 99], [QUARTERS[6], 112]]),
    quarterlyDilutedEPS: pts(QUARTERS.map((d) => [d, 1])),
    annualTotalRevenue: pts([['2025-12-31', 435]]),
    // Pas de FCF publié : flux d'exploitation + investissements.
    quarterlyOperatingCashFlow: pts([[QUARTERS[4], 30], [QUARTERS[5], 35]]),
    quarterlyCapitalExpenditure: pts([[QUARTERS[4], -10], [QUARTERS[5], -12]]),
  };
  const periods = buildRecentPeriods(quarterly);

  it('labels quarters and compares each with the same quarter a year earlier', () => {
    const revenue = periods.revenue!;
    expect(revenue.kind).toBe('quarter');
    expect(revenue.points.map((p) => p.label)).toEqual(['T1 2025', 'T2 2025', 'T3 2025', 'T4 2025', 'T1 2026', 'T2 2026', 'T3 2026']);
    expect(revenue.points[4].yoy).toBeCloseTo(0.04, 10);
    expect(revenue.points[5].yoy).toBeCloseTo(-0.1, 10);
    expect(revenue.points[0].yoy).toBeNull();
    expect(periods.freeCashFlow?.points.map((p) => p.value)).toEqual([20, 23]);
  });

  it('drops a metric whose quarters do not add up to the published year', () => {
    const wrong = buildRecentPeriods({ ...quarterly, annualTotalRevenue: pts([['2025-12-31', 500]]) });
    expect(wrong.revenue).toBeUndefined();
    expect(wrong.eps).toBeDefined();
  });

  it('shows nothing when no earnings are published at that pace (reconstructed quarters)', () => {
    // Cas LVMH : chiffre d'affaires « trimestriel » sans BPA trimestriel.
    const reconstructed = buildRecentPeriods({
      quarterlyTotalRevenue: pts([['2025-06-30', 16.2], ['2025-09-30', 18], ['2025-12-31', 26.4], ['2026-03-31', 12.6], ['2026-06-30', 20.5]]),
      quarterlyNetIncomeCommonStockholders: pts([['2025-06-30', 2], ['2025-09-30', 2.3], ['2025-12-31', 3.4], ['2026-03-31', 1.6], ['2026-06-30', 2.7]]),
    });
    expect(reconstructed).toEqual({});
  });

  it('keeps half-years for a half-year reporter and ignores reconstructed quarters', () => {
    const halves = buildRecentPeriods({
      quarterlyDilutedEPS: pts([['2024-12-31', -0.1], ['2025-06-30', 0.4], ['2025-12-31', 0.44], ['2026-06-30', 0.5]]),
      quarterlyNetIncomeCommonStockholders: pts([['2024-12-31', -5], ['2025-06-30', 20], ['2025-12-31', 22], ['2026-06-30', 25]]),
      annualNetIncomeCommonStockholders: pts([['2025-12-31', 42]]),
      quarterlyTotalRevenue: pts(QUARTERS.map((d) => [d, 100])),
    });
    expect(halves.revenue).toBeUndefined();
    const net = halves.netIncome!;
    expect(net.kind).toBe('half');
    expect(net.points.map((p) => p.label)).toEqual(['S2 2024', 'S1 2025', 'S2 2025', 'S1 2026']);
    expect(net.points[2].yoy).toBeNull(); // base négative (S2 2024)
    expect(net.points[3].yoy).toBeCloseTo(0.25, 10);
  });

  it('drops irregular series and keeps the latest regular run', () => {
    const irregular = buildRecentPeriods({ quarterlyDilutedEPS: pts([['2025-12-31', 1], ['2026-09-30', 2]]) });
    expect(irregular.eps).toBeUndefined();
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
