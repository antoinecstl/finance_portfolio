import { describe, expect, it } from 'vitest';
import {
  buildStatements,
  cagr,
  computeRatios,
  dcfValuePerShare,
  defaultDcfGrowth,
  fundamentalsSeriesTypes,
  majorCurrency,
  parseQuoteSummary,
  parseTimeseriesResponse,
} from './fundamentals';

// Réponse type de l'endpoint de séries temporelles (forme réelle, valeurs inventées).
type Pt = [string, number];
const serie = (type: string, points: Pt[], currency = 'EUR') => ({
  meta: { symbol: ['DEMO.PA'], type: [type] },
  timestamp: points.map(([d]) => Date.parse(d) / 1000),
  [type]: points.map(([asOfDate, raw]) => ({
    asOfDate, periodType: type.startsWith('quarterly') ? '3M' : type.startsWith('trailing') ? 'TTM' : '12M',
    currencyCode: currency, reportedValue: { raw, fmt: String(raw) },
  })),
});
const Y = ['2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31', '2025-12-31'];
const years = (values: number[]): Pt[] => values.map((v, i) => [Y[i], v]);

const timeseries = {
  timeseries: {
    result: [
      serie('annualTotalRevenue', years([100, 110, 121, 133.1, 146.41]).map(([d, v]) => [d, v * 1e9])),
      serie('annualNetIncomeCommonStockholders', years([10, 11, 12, 13, 14.641]).map(([d, v]) => [d, v * 1e9])),
      serie('annualDilutedEPS', years([1, 1.1, 1.21, 1.331, 1.4641])),
      serie('annualFreeCashFlow', years([8, 9, 10, 11, 12]).map(([d, v]) => [d, v * 1e9])),
      serie('annualStockholdersEquity', years([80, 85, 90, 95, 100]).map(([d, v]) => [d, v * 1e9])),
      serie('annualOrdinarySharesNumber', years([10, 10, 10, 10, 10]).map(([d, v]) => [d, v * 1e9])),
      serie('trailingTotalRevenue', [['2026-06-30', 150e9]]),
      serie('trailingNetIncome', [['2026-06-30', 15e9]]), // libellé de repli
      serie('trailingDilutedEPS', [['2026-06-30', 1.5]]),
      serie('trailingEBITDA', [['2026-06-30', 25e9]]),
      serie('trailingOperatingCashFlow', [['2026-06-30', 18e9]]),
      serie('trailingCapitalExpenditure', [['2026-06-30', -6e9]]),
      serie('trailingCashDividendsPaid', [['2026-06-30', -6e9]]),
      serie('quarterlyTotalDebt', [['2026-03-31', 40e9], ['2026-06-30', 30e9]]),
      serie('quarterlyCashAndCashEquivalents', [['2026-06-30', 10e9]]),
      serie('quarterlyStockholdersEquity', [['2026-06-30', 100e9]]),
      serie('quarterlyOrdinarySharesNumber', [['2026-06-30', 10e9]]),
      serie('trailingForwardPeRatio', [['2026-06-30', 18]]),
      serie('trailingPegRatio', [['2026-06-30', 1.7]]),
      { meta: { symbol: ['DEMO.PA'], type: ['annualEBITDA'] } }, // série vide
      { meta: { symbol: ['DEMO.PA'], type: ['annualGrossProfit'] }, annualGrossProfit: [null, { asOfDate: '2025-12-31' }] },
    ],
    error: null,
  },
};

describe('series types', () => {
  it('asks for annual, trailing, quarterly and fallback series', () => {
    const types = fundamentalsSeriesTypes();
    expect(types).toContain('annualFreeCashFlow');
    expect(types).toContain('trailingDilutedEPS');
    expect(types).toContain('quarterlyTotalDebt');
    expect(types).toContain('trailingNetIncome');
    expect(types).toContain('trailingPegRatio');
    expect(types).not.toContain('quarterlyTotalRevenue');
  });
});

describe('parseTimeseriesResponse / buildStatements', () => {
  const series = parseTimeseriesResponse(timeseries);

  it('reads every non-empty series and skips null points', () => {
    expect(series.annualTotalRevenue).toHaveLength(5);
    expect(series.annualEBITDA).toBeUndefined();
    expect(series.annualGrossProfit).toBeUndefined();
    expect(series.quarterlyTotalDebt.at(-1)).toEqual({ date: '2026-06-30', value: 30e9, currency: 'EUR' });
    expect(parseTimeseriesResponse({ timeseries: { result: null } })).toEqual({});
    expect(parseTimeseriesResponse('nope')).toEqual({});
  });

  it('builds yearly columns and a trailing-twelve-months column', () => {
    const s = buildStatements(series);
    expect(s.currency).toBe('EUR');
    expect(s.annual.map((r) => r.date)).toEqual(Y);
    expect(s.ttm).toMatchObject({ date: '2026-06-30', revenue: 150e9, netIncome: 15e9, eps: 1.5, totalDebt: 30e9, cash: 10e9 });
    // FCF absent sur 12 mois : flux d'exploitation + capex.
    expect(s.ttm?.freeCashFlow).toBe(12e9);
    expect(s.provider).toEqual({ forwardPe: 18, peg: 1.7 });
  });

  it('falls back to the last fiscal year when there is no trailing data', () => {
    const s = buildStatements({ annualTotalRevenue: [{ date: '2025-12-31', value: 5, currency: 'USD' }] });
    expect(s.ttm).toMatchObject({ date: '2025-12-31', revenue: 5 });
    expect(s.currency).toBe('USD');
  });
});

describe('computeRatios', () => {
  const statements = buildStatements(parseTimeseriesResponse(timeseries));
  const r = computeRatios(statements, 30);

  it('computes valuation multiples at the current price', () => {
    expect(r.marketCap).toBe(300e9);
    expect(r.netDebt).toBe(20e9);
    expect(r.enterpriseValue).toBe(320e9);
    expect(r.per).toBeCloseTo(20, 10);
    expect(r.earningsYield).toBeCloseTo(0.05, 10);
    expect(r.priceToBook).toBeCloseTo(3, 10);
    expect(r.priceToSales).toBeCloseTo(2, 10);
    expect(r.evToEbitda).toBeCloseTo(12.8, 10);
    expect(r.priceToFcf).toBeCloseTo(25, 10);
    expect(r.fcfYield).toBeCloseTo(0.04, 10);
    expect(r.forwardPer).toBe(18);
    expect(r.forwardPeg).toBe(1.7);
  });

  it('derives the PEG from historical EPS growth', () => {
    expect(r.epsCagr).toBeCloseTo(0.1, 6); // 1 → 1,4641 en 4 ans
    expect(r.peg).toBeCloseTo(20 / 10, 4);
    expect(r.revenueCagr).toBeCloseTo(0.1, 6);
    expect(r.revenueGrowth).toBeCloseTo(0.1, 10);
  });

  it('computes margins, returns, leverage and payout', () => {
    expect(r.netMargin).toBeCloseTo(0.1, 10);
    expect(r.fcfMargin).toBeCloseTo(0.08, 10);
    expect(r.roe).toBeCloseTo(0.15, 10);
    expect(r.debtToEquity).toBeCloseTo(0.3, 10);
    expect(r.netDebtToEbitda).toBeCloseTo(0.8, 10);
    expect(r.payoutRatio).toBeCloseTo(0.4, 10);
    expect(r.fcfPayoutRatio).toBeCloseTo(0.5, 10);
    expect(r.fcfPerShare).toBeCloseTo(1.2, 10);
    expect(r.bookValuePerShare).toBeCloseTo(10, 10);
    expect(r.grahamNumber).toBeCloseTo(Math.sqrt(22.5 * 1.5 * 10), 10);
  });

  it('leaves meaningless ratios empty (losses, negative equity, unknown price)', () => {
    const losing = buildStatements(parseTimeseriesResponse(timeseries));
    losing.ttm = { ...losing.ttm!, eps: -0.5, netIncome: -5e9, equity: -1e9 };
    const lr = computeRatios(losing, 30);
    expect(lr.per).toBeNull();
    expect(lr.peg).toBeNull();
    expect(lr.priceToBook).toBeNull();
    expect(lr.roe).toBeNull();
    expect(lr.grahamNumber).toBeNull();
    expect(computeRatios(statements, 0).marketCap).toBeNull();
  });
});

describe('growth and valuation helpers', () => {
  it('computes a compound annual growth rate only between positive values', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 10);
    expect(cagr(-1, 121, 2)).toBeNull();
    expect(cagr(100, 121, 0)).toBeNull();
  });

  it('values a share by discounting its free cash flow', () => {
    // Sans croissance : rente perpétuelle FCF / taux.
    expect(dcfValuePerShare({ fcfPerShare: 1, growth: 0, discountRate: 0.1, terminalGrowth: 0 })).toBeCloseTo(10, 6);
    const base = dcfValuePerShare({ fcfPerShare: 1, growth: 0.05, discountRate: 0.09, terminalGrowth: 0.02 })!;
    expect(base).toBeGreaterThan(15);
    expect(dcfValuePerShare({ fcfPerShare: 1, growth: 0.1, discountRate: 0.09, terminalGrowth: 0.02 })!).toBeGreaterThan(base);
    expect(dcfValuePerShare({ fcfPerShare: -1, growth: 0.05, discountRate: 0.09, terminalGrowth: 0.02 })).toBeNull();
    expect(dcfValuePerShare({ fcfPerShare: 1, growth: 0.05, discountRate: 0.02, terminalGrowth: 0.03 })).toBeNull();
  });

  it('proposes a bounded default growth', () => {
    expect(defaultDcfGrowth({ fcfCagr: 0.3, revenueCagr: null })).toBe(0.12);
    expect(defaultDcfGrowth({ fcfCagr: -0.1, revenueCagr: null })).toBe(0);
    expect(defaultDcfGrowth({ fcfCagr: null, revenueCagr: 0.061 })).toBe(0.06);
  });

  it('handles quotes in pence or cents', () => {
    expect(majorCurrency('GBp')).toEqual({ currency: 'GBP', divisor: 100 });
    expect(majorCurrency('eur')).toEqual({ currency: 'EUR', divisor: 1 });
  });
});

describe('parseQuoteSummary', () => {
  it('reads profile, analyst consensus and market statistics', () => {
    const json = {
      quoteSummary: {
        result: [{
          assetProfile: { sector: 'Industrials', sectorDisp: 'Industrials', industry: 'Specialty Industrial Machinery', country: 'France', website: 'https://www.se.com', fullTimeEmployees: 150000, longBusinessSummary: 'Energy management.' },
          summaryDetail: { beta: { raw: 1.1, fmt: '1.10' }, forwardPE: { raw: 22.4 }, exDividendDate: { raw: Date.parse('2026-05-18T00:00:00Z') / 1000 } },
          defaultKeyStatistics: { forwardEps: { raw: 10.8 }, pegRatio: { raw: 2.1 }, floatShares: { raw: 5.6e8 }, heldPercentInsiders: { raw: 0.03 }, heldPercentInstitutions: { raw: 0.6 } },
          financialData: { targetMeanPrice: { raw: 270 }, targetHighPrice: { raw: 310 }, targetLowPrice: { raw: 200 }, recommendationKey: 'buy', recommendationMean: { raw: 2.1 }, numberOfAnalystOpinions: { raw: 22 }, financialCurrency: 'EUR' },
          calendarEvents: { earnings: { earningsDate: [{ raw: Date.parse('2026-07-31T00:00:00Z') / 1000 }] } },
          earningsTrend: { trend: [{ period: '0y', growth: { raw: 0.05 } }, { period: '+1y', growth: { raw: 0.11 } }] },
        }],
        error: null,
      },
    };
    const s = parseQuoteSummary(json)!;
    expect(s.profile).toMatchObject({ sector: 'Industrials', country: 'France', employees: 150000, website: 'https://www.se.com/' });
    expect(s.analysts).toMatchObject({ targetMean: 270, targetHigh: 310, targetLow: 200, recommendation: 'buy', count: 22 });
    expect(s.stats).toMatchObject({ beta: 1.1, forwardEps: 10.8, forwardPe: 22.4, peg: 2.1, earningsGrowthNextYear: 0.11, nextEarningsDate: '2026-07-31' });
    expect(s.stats.exDividendDate).toBe('2026-05-18');
  });

  it('rejects unsafe links and empty answers', () => {
    const s = parseQuoteSummary({ quoteSummary: { result: [{ assetProfile: { website: 'javascript:alert(1)' } }] } })!;
    expect(s.profile.website).toBeNull();
    expect(s.analysts.targetMean).toBeNull();
    expect(parseQuoteSummary({ quoteSummary: { result: null, error: { code: 'Not Found' } } })).toBeNull();
    expect(parseQuoteSummary(undefined)).toBeNull();
  });
});
