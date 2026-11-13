import { describe, expect, it } from 'vitest';
import { beatCount, netMargin, parseEarningsSummary, quarterlyFinancials, quarterOfPeriod, surpriseOf } from './earnings';
import type { RecentPeriods } from './quarters';

const raw = (v: number) => ({ raw: v, fmt: String(v) });
const ts = (iso: string) => ({ raw: Date.parse(`${iso}T00:00:00Z`) / 1000, fmt: iso });

// Réponse fictive du module « résumé » : exercice décalé (clos fin janvier).
const RESULT = {
  earningsHistory: {
    history: [
      { epsActual: raw(0.81), epsEstimate: raw(0.75), quarter: ts('2025-07-27'), currency: 'USD', period: '-2q' },
      { epsActual: raw(0.68), epsEstimate: raw(0.73), quarter: ts('2025-04-27'), currency: 'USD', period: '-3q' },
      { epsActual: raw(1.05), epsEstimate: raw(1.0), quarter: ts('2025-10-26'), currency: 'USD', period: '-1q' },
      { epsActual: raw(0.89), epsEstimate: raw(0.85), quarter: ts('2025-01-26'), currency: 'USD', period: '-4q' },
    ],
  },
  earningsTrend: {
    trend: [
      {
        period: '0q', endDate: '2026-01-31',
        earningsEstimate: { avg: raw(1.2), low: raw(1.1), high: raw(1.3), yearAgoEps: raw(0.89), numberOfAnalysts: raw(40), growth: raw(0.348), earningsCurrency: 'USD' },
        revenueEstimate: { avg: raw(54e9), low: raw(52e9), high: raw(56e9), yearAgoRevenue: raw(39.3e9), numberOfAnalysts: raw(38), growth: raw(0.374) },
        epsTrend: { current: raw(1.2), '30daysAgo': raw(1.18), '90daysAgo': raw(1.1) },
        epsRevisions: { upLast30days: raw(12), downLast30days: raw(1) },
      },
      { period: '+1y', endDate: '2027-01-31', earningsEstimate: { avg: raw(6.1) }, revenueEstimate: {} },
      { period: '+5y', growth: raw(0.3) },
      { period: '+1q', endDate: '2026-04-30', earningsEstimate: {}, revenueEstimate: {} },
    ],
  },
  calendarEvents: { earnings: { earningsDate: [ts('2026-02-26'), ts('2026-02-25')], isEarningsDateEstimate: true } },
  earnings: {
    financialCurrency: 'USD',
    earningsChart: { quarterly: [] },
    financialsChart: {
      quarterly: [
        { date: '1Q2025', revenue: raw(44e9), earnings: raw(18.8e9) },
        { date: '2Q2025', revenue: raw(46.7e9), earnings: raw(26.4e9) },
      ],
    },
  },
};

describe('quarterOfPeriod', () => {
  it('lit le trimestre au milieu de la période', () => {
    expect(quarterOfPeriod('2025-03-31').label).toBe('T1 2025');
    expect(quarterOfPeriod('2025-12-31').label).toBe('T4 2025');
    // Exercice décalé : trimestre clos fin octobre = août-octobre, surtout le T3.
    expect(quarterOfPeriod('2025-10-26').label).toBe('T3 2025');
    expect(quarterOfPeriod('2026-01-31')).toEqual({ year: 2025, quarter: 4, label: 'T4 2025' });
  });
});

describe('parseEarningsSummary', () => {
  const summary = parseEarningsSummary(RESULT)!;

  it('trie les trimestres publiés et calcule l’écart au consensus', () => {
    expect(summary.history.map((h) => h.label)).toEqual(['T4 2024', 'T1 2025', 'T2 2025', 'T3 2025']);
    expect(summary.history[3].surprise).toBeCloseTo(0.05);
    expect(summary.history[1].surprise).toBeCloseTo(-0.0685, 3);
    expect(summary.currency).toBe('USD');
  });

  it('garde les prévisions renseignées, dans l’ordre trimestre puis exercice', () => {
    expect(summary.forward.map((f) => f.key)).toEqual(['0q', '+1y']);
    const current = summary.forward[0];
    expect(current.endDate).toBe('2026-01-31');
    expect(current.eps).toMatchObject({ avg: 1.2, low: 1.1, high: 1.3, yearAgo: 0.89, analysts: 40 });
    expect(current.revenue.yearAgo).toBe(39.3e9);
    expect(current.epsTrend).toEqual({ current: 1.2, days30: 1.18, days90: 1.1 });
    expect(current.revisions).toEqual({ up30: 12, down30: 1 });
  });

  it('retient le premier jour de la plage de publication annoncée', () => {
    expect(summary.nextDate).toBe('2026-02-25');
    expect(summary.nextDateEstimated).toBe(true);
  });

  it('lit le CA et le résultat trimestriels du fournisseur en secours', () => {
    expect(summary.quarterlyFinancials).toEqual([
      { date: null, label: 'T1 2025', revenue: 44e9, netIncome: 18.8e9 },
      { date: null, label: 'T2 2025', revenue: 46.7e9, netIncome: 26.4e9 },
    ]);
  });

  it('renvoie null sans aucune donnée de résultats (ETF, indice)', () => {
    expect(parseEarningsSummary({ assetProfile: {} })).toBeNull();
    expect(parseEarningsSummary({ earningsHistory: { history: [] }, earningsTrend: { trend: [] } })).toBeNull();
  });
});

describe('quarterlyFinancials', () => {
  const point = (date: string, value: number) => ({ date, label: '', year: 0, index: 0, value, yoy: null });

  it('préfère les trimestres validés, CA et résultat alignés par date', () => {
    const periods: RecentPeriods = {
      revenue: { kind: 'quarter', points: [point('2025-03-31', 100), point('2025-06-30', 110), point('2025-09-30', 120)] },
      netIncome: { kind: 'quarter', points: [point('2025-06-30', 11), point('2025-09-30', 15)] },
    };
    expect(quarterlyFinancials(periods, [{ date: null, label: 'T1 2025', revenue: 1, netIncome: 1 }])).toEqual([
      { date: '2025-03-31', label: 'T1 2025', revenue: 100, netIncome: null },
      { date: '2025-06-30', label: 'T2 2025', revenue: 110, netIncome: 11 },
      { date: '2025-09-30', label: 'T3 2025', revenue: 120, netIncome: 15 },
    ]);
  });

  it('ignore des semestres et retombe sur le secours', () => {
    const halves: RecentPeriods = { revenue: { kind: 'half', points: [point('2025-06-30', 1), point('2025-12-31', 2)] } };
    const fallback = [{ date: null, label: 'T1 2025', revenue: 1, netIncome: 1 }];
    expect(quarterlyFinancials(halves, fallback)).toBe(fallback);
    expect(quarterlyFinancials(undefined)).toEqual([]);
  });
});

describe('helpers', () => {
  it('surpriseOf, netMargin, beatCount', () => {
    expect(surpriseOf(1.1, 1)).toBeCloseTo(0.1);
    expect(surpriseOf(-0.5, -1)).toBeCloseTo(0.5); // perte moins forte qu'attendu
    expect(surpriseOf(1, 0)).toBeNull();
    expect(netMargin({ revenue: 200, netIncome: 50 })).toBe(0.25);
    expect(netMargin({ revenue: 0, netIncome: 5 })).toBeNull();
    expect(beatCount([
      { date: 'a', label: '', actual: 1, estimate: 0.9, surprise: 0.1 },
      { date: 'b', label: '', actual: 1, estimate: 1.1, surprise: -0.09 },
      { date: 'c', label: '', actual: null, estimate: 1, surprise: null },
    ])).toEqual({ beats: 1, total: 2 });
  });
});
