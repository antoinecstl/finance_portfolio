import { describe, expect, it } from 'vitest';
import type { MarketPoint } from './chart-data';
import type { StatementRow } from './fundamentals';
import { buildSnapshots, median, valuationHistory, valuationReferences } from './valuation';

const WEEK = 7 * 86_400;
const t = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);

const row = (date: string, values: Partial<StatementRow>): StatementRow => ({
  date, revenue: null, grossProfit: null, operatingIncome: null, ebitda: null, netIncome: null, eps: null, dilutedShares: null,
  operatingCashFlow: null, capitalExpenditure: null, freeCashFlow: null, dividendsPaid: null, totalDebt: null, cash: null,
  equity: null, totalAssets: null, shares: null, ...values,
});

function weekly(from: string, to: string, price: (i: number) => number): MarketPoint[] {
  const out: MarketPoint[] = [];
  for (let s = t(from), i = 0; s <= t(to); s += WEEK, i++) {
    const c = price(i);
    out.push({ t: s, o: c, h: c, l: c, c, v: 0 });
  }
  return out;
}

describe('valuation history', () => {
  const annual = [
    row('2019-12-31', { eps: 5, revenue: 1_000, shares: 100, freeCashFlow: 400, equity: 2_000, ebitda: 200, totalDebt: 300, cash: 100 }),
    row('2020-12-31', { eps: 10, revenue: 1_200, shares: 100, freeCashFlow: -50, equity: 2_500, ebitda: 250, totalDebt: 300, cash: 100 }),
  ];

  it('uses the accounts only once they are published', () => {
    const snapshots = buildSnapshots(annual, null);
    const prices = weekly('2020-01-06', '2021-12-27', () => 100);
    const history = valuationHistory(prices, snapshots);
    const perAt = (iso: string) => history.per?.points.find((p) => p.t >= t(iso))?.v;
    // Comptes 2019 publiés vers mi-mars 2020 : rien avant.
    expect(history.per?.points[0].t).toBeGreaterThanOrEqual(t('2020-03-15'));
    expect(perAt('2020-06-01')).toBeCloseTo(20, 10);
    expect(perAt('2021-06-01')).toBeCloseTo(10, 10);
    // FCF négatif en 2020 : pas de cours / FCF après la publication.
    expect(history.priceToFcf?.points.every((p) => p.t < t('2021-03-20'))).toBe(true);
    // VE / EBITDA = (100 × 100 + 200) / 250 en 2021.
    expect(history.evToEbitda?.current).toBeCloseTo(10_200 / 250, 10);
  });

  it('summarises median, extremes and rank of today’s multiple', () => {
    const snapshots = buildSnapshots([row('2015-12-31', { eps: 1, shares: 1 })], null);
    const prices = weekly('2016-04-04', '2018-04-02', (i) => 10 + (i % 10));
    const per = valuationHistory(prices, snapshots).per;
    expect(per?.low.v).toBe(10);
    expect(per?.high.v).toBe(19);
    expect(per?.median).toBeGreaterThanOrEqual(14);
    expect(per?.median).toBeLessThanOrEqual(15);
    expect(per?.current).toBe(prices[prices.length - 1].c);
    expect(per?.higherShare).toBeGreaterThan(0);
  });

  it('computes a trailing dividend yield in the quote currency', () => {
    const snapshots = buildSnapshots([row('2015-12-31', { eps: 1, shares: 1 })], null);
    const prices = weekly('2016-04-04', '2018-04-02', () => 50);
    const dividends = [2016, 2017, 2018].map((y) => ({ date: `${y}-05-10`, amount: 2 }));
    const yieldSeries = valuationHistory(prices, snapshots, { dividends }).dividendYield;
    expect(yieldSeries?.current).toBeCloseTo(0.04, 10);
  });

  it('adds 5- and 10-year windows only when the history is clearly longer', () => {
    const snapshots = buildSnapshots([row('2007-12-31', { eps: 1, shares: 1 })], null);
    // PER de 30 jusqu'en 2020, puis 10 : la médiane sur 5 ans ne voit que la seconde période.
    const long = weekly('2008-04-07', '2026-03-30', (i) => (i < 52 * 12 ? 30 : 10));
    const per = valuationHistory(long, snapshots, { maxYears: 30 }).per;
    expect(per?.since).toBe(long[0].t);
    expect(per?.median).toBe(30);
    expect(per?.windows['5A']?.median).toBe(10);
    expect(per?.windows['5A']?.since).toBeGreaterThanOrEqual(t('2021-03-29'));
    expect(per?.windows['10A']?.high.v).toBe(30);
    expect(per?.windows['10A']?.higherShare).toBeGreaterThan(0);

    const short = valuationHistory(weekly('2020-01-06', '2026-03-30', () => 10), snapshots, { maxYears: 30 }).per;
    expect(short?.windows['5A']).toBeDefined(); // 6 ans d'historique : la fenêtre de 5 ans a un sens
    expect(short?.windows['10A']).toBeUndefined();
    const shorter = valuationHistory(weekly('2022-04-04', '2026-03-30', () => 10), snapshots).per;
    expect(shorter?.windows).toEqual({});
  });

  it('needs six months of history before giving statistics', () => {
    const snapshots = buildSnapshots([row('2015-12-31', { eps: 1, shares: 1 })], null);
    expect(valuationHistory(weekly('2016-04-04', '2016-06-27', () => 10), snapshots).per).toBeUndefined();
  });
});

describe('references', () => {
  it('turns median multiples into prices and skips meaningless methods', () => {
    const snapshots = buildSnapshots([row('2015-12-31', { eps: 2, shares: 1, revenue: 10 })], null);
    const multiples = valuationHistory(weekly('2016-04-04', '2019-04-01', (i) => 20 + (i % 3)), snapshots);
    const refs = valuationReferences({
      multiples,
      ttm: { eps: 2.5, fcfPerShare: -1, salesPerShare: 12 },
      dcfValue: null,
      grahamNumber: 30,
      analystTarget: 40,
      toQuote: (v) => v * 2, // cotation dans une autre devise
      formatMultiple: (v) => v.toFixed(1),
    });
    expect(refs.map((r) => r.method)).toEqual(['perMedian', 'psMedian', 'graham', 'analysts']);
    expect(refs[0].value).toBeCloseTo(multiples.per!.median * 2.5 * 2, 10);
    expect(refs[3].value).toBe(40); // déjà en devise de cotation
  });

  it('computes medians', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
