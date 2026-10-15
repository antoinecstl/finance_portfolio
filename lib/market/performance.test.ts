import { describe, expect, it } from 'vitest';
import type { MarketPoint } from './chart-data';
import {
  annualReturns,
  buildPerformanceReport,
  drawdownStats,
  hasTotalReturn,
  monthEndCloses,
  monthlyReturns,
  returnsCorrelation,
  trendLinearity,
  yearMonthIn,
} from './performance';
import { assetClassOf, resolveTab, tabsFor } from './asset-class';

const DAY = 86_400;
const t = (iso: string) => Math.floor(Date.parse(`${iso}T16:00:00Z`) / 1000);
const pt = (iso: string, c: number, ac?: number): MarketPoint => ({ t: t(iso), o: c, h: c, l: c, c, v: 1, ...(ac !== undefined ? { ac } : {}) });

// Séries quotidiennes en jours ouvrés.
function daily(from: string, to: string, price: (yearsElapsed: number, i: number) => number, dividendYield = 0): MarketPoint[] {
  const out: MarketPoint[] = [];
  const start = t(from);
  let total = 1;
  let i = 0;
  for (let s = start; s <= t(to); s += DAY) {
    const wd = new Date(s * 1000).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const c = price((s - start) / (365.25 * DAY), i++);
    total *= 1 + dividendYield / 252;
    out.push({ t: s, o: c, h: c * 1.001, l: c, c, v: 1, ac: c * total });
  }
  return out;
}

describe('asset classes', () => {
  it('maps instrument types and their tabs', () => {
    expect(assetClassOf('EQUITY')).toBe('equity');
    expect(assetClassOf('MUTUALFUND')).toBe('etf');
    expect(assetClassOf('CRYPTOCURRENCY')).toBe('crypto');
    expect(assetClassOf('FUTURE')).toBe('commodity');
    expect(assetClassOf(undefined)).toBe('other');
    expect(tabsFor('crypto')).toEqual(['apercu', 'performance', 'marche']);
    // Un onglet d'action demandé sur une crypto retombe sur l'aperçu.
    expect(resolveTab('crypto', 'finances')).toBe('apercu');
    expect(resolveTab('equity', 'finances')).toBe('finances');
  });
});

describe('calendar', () => {
  it('reads months in the exchange time zone', () => {
    // 1er janvier 2024 à 00:00 à Tokyo = 31 décembre 2023 en UTC.
    const tokyoNewYear = Date.parse('2023-12-31T15:00:00Z') / 1000;
    expect(yearMonthIn(tokyoNewYear, 'Asia/Tokyo')).toEqual({ year: 2024, month: 1 });
    expect(yearMonthIn(tokyoNewYear, 'Europe/Paris')).toEqual({ year: 2023, month: 12 });
  });

  it('keeps the last close of each month', () => {
    const months = monthEndCloses([pt('2024-01-02', 10), pt('2024-01-31', 11), pt('2024-02-15', 12)], 'UTC');
    expect(months.map((m) => [m.year, m.month, m.point.c])).toEqual([[2024, 1, 11], [2024, 2, 12]]);
  });
});

describe('annual returns', () => {
  const points = [pt('2021-03-01', 100, 100), pt('2021-12-31', 110, 112), pt('2022-12-30', 99, 103), pt('2023-12-29', 120, 128), pt('2024-06-28', 132, 142)];

  it('chains year-end closes, first and current years flagged partial', () => {
    const rows = annualReturns(points, 'UTC', new Date('2024-07-01T00:00:00Z'));
    expect(rows.map((r) => r.year)).toEqual([2021, 2022, 2023, 2024]);
    expect(rows[0]).toMatchObject({ partial: true });
    expect(rows[1].price).toBeCloseTo(99 / 110 - 1, 10);
    expect(rows[1].total).toBeCloseTo(103 / 112 - 1, 10);
    expect(rows[1].partial).toBe(false);
    expect(rows[3].partial).toBe(true);
  });

  it('detects whether adjusted closes add dividends', () => {
    expect(hasTotalReturn(points)).toBe(true);
    expect(hasTotalReturn(points.map((p) => ({ ...p, ac: p.c })))).toBe(false);
    expect(hasTotalReturn(points.map((p) => ({ ...p, ac: undefined })))).toBe(false);
  });
});

describe('monthly returns', () => {
  it('builds a year × month grid without inventing missing months', () => {
    const points = [pt('2023-11-30', 100), pt('2023-12-29', 110), pt('2024-01-31', 99), pt('2024-03-28', 120)];
    const grid = monthlyReturns(points, 'UTC');
    expect(grid.years.map((y) => y.year)).toEqual([2024, 2023]);
    expect(grid.years[0].months[0]).toBeCloseTo(-0.1, 10);
    expect(grid.years[0].months[1]).toBeNull();
    expect(grid.years[0].months[2]).toBeNull(); // février absent : pas de variation de mars
    expect(grid.years[1].months[11]).toBeCloseTo(0.1, 10);
  });
});

describe('drawdowns', () => {
  it('finds the worst fall, its recovery and the longest time under water', () => {
    const points = [pt('2020-01-01', 100), pt('2020-02-01', 120), pt('2020-03-01', 60), pt('2020-06-01', 90), pt('2020-09-01', 125), pt('2020-10-01', 110)];
    const stats = drawdownStats(points);
    expect(stats?.value).toBeCloseTo(-0.5, 10);
    expect(stats?.peakDate).toBe('2020-02-01');
    expect(stats?.troughDate).toBe('2020-03-01');
    expect(stats?.recoveryDate).toBe('2020-09-01');
    expect(stats?.longestUnderwaterDays).toBe(213);
  });
});

describe('trend linearity', () => {
  it('is 1 for a steady exponential growth and low for a round trip', () => {
    expect(trendLinearity(daily('2016-01-04', '2026-01-02', (y) => 100 * Math.pow(1.1, y)))).toBeCloseTo(1, 6);
    const roundTrip = trendLinearity(daily('2016-01-04', '2026-01-02', (y) => 100 * (1 + 0.8 * Math.sin((y / 10) * Math.PI))));
    expect(roundTrip).toBeLessThan(0.05);
  });
});

describe('correlation', () => {
  it('is 1 for identical moves and -1 for opposite ones', () => {
    const a = daily('2024-01-01', '2024-12-31', (_y, i) => 100 + 5 * Math.sin(i));
    const b = a.map((p) => ({ ...p, c: p.c * 2 }));
    expect(returnsCorrelation(a, b)).toBeCloseTo(1, 6);
    const c = a.map((p) => ({ ...p, c: 400 - p.c }));
    expect(returnsCorrelation(a, c)).toBeLessThan(-0.9);
  });
});

describe('full report', () => {
  it('measures growth with and without reinvested dividends', () => {
    const d = daily('2016-10-13', '2026-10-13', (y) => 100 * Math.pow(1.05, y), 0.03);
    const report = buildPerformanceReport(d, [], { timeZone: 'UTC', price: d.at(-1)?.c ?? null, periodsPerYear: 252, now: new Date('2026-10-14T00:00:00Z') });
    const tenYears = report.stats.growth.find((g) => g.key === '10A');
    expect(tenYears?.price).toBeCloseTo(0.05, 3);
    expect(tenYears?.total).toBeGreaterThan(0.075);
    expect(report.totalReturnAvailable).toBe(true);
    expect(report.stats.maxDrawdown?.value).toBe(0);
    expect(report.stats.positiveYears).toEqual({ count: 9, of: 9 });
    expect(report.stats.allTimeHigh?.distance).toBeLessThanOrEqual(0);
    // Séance en cours au-dessus de tous les plus hauts clos : le cours devient le plus haut historique.
    const live = buildPerformanceReport(d, [], { timeZone: 'UTC', price: 1_000, periodsPerYear: 252, now: new Date('2026-10-14T00:00:00Z') });
    expect(live.stats.allTimeHigh).toEqual({ value: 1_000, date: '2026-10-14', distance: 0 });
    expect(report.drawdown.length).toBeLessThanOrEqual(522);
    expect(report.monthly.years[0].year).toBe(2026);
  });
});
