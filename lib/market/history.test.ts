import { describe, expect, it } from 'vitest';
import { isSecEligible, parseCompanyFacts, parseCompanyTickers } from './sources/sec';
import { availableMetrics, buildHistory, dividendsPerYear, indexTo100, mergeAnnualRows, metricGrowth } from './history';
import type { StatementRow } from './fundamentals';

// Faits au format `companyfacts` (docs EDGAR) : chaque 10-K reprend les exercices précédents.
const annual = (fy: number, end: string, val: number, filed: string, form = '10-K') => ({
  start: new Date(Date.parse(end) - 364 * 86_400_000).toISOString().slice(0, 10),
  end, val, accn: `0000-${filed}`, fy, fp: 'FY', form, filed,
});
const instant = (end: string, val: number, filed: string, form = '10-K') => ({ end, val, accn: `0000-${filed}`, fy: Number(filed.slice(0, 4)), fp: 'FY', form, filed });

const facts = {
  cik: 1234,
  entityName: 'Exemple Corp',
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: { units: { shares: [instant('2018-02-15', 1_000, '2018-02-20'), instant('2019-02-14', 980, '2019-02-20')] } },
    },
    'us-gaap': {
      // Concept abandonné en 2018 : le CA de 2017 n'existe que sous l'ancien nom.
      SalesRevenueNet: { units: { USD: [annual(2017, '2016-12-31', 900, '2017-02-20'), annual(2017, '2017-12-31', 1_000, '2018-02-20')] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            annual(2018, '2018-12-31', 1_200, '2019-02-20'),
            // Trimestre (10-Q) et quatrième trimestre isolé : ignorés.
            { start: '2018-07-01', end: '2018-09-30', val: 300, form: '10-Q', fp: 'Q3', fy: 2018, filed: '2018-10-30' },
            { start: '2018-10-01', end: '2018-12-31', val: 330, form: '10-K', fp: 'FY', fy: 2018, filed: '2019-02-20' },
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            annual(2017, '2016-12-31', 90, '2017-02-20'),
            annual(2017, '2017-12-31', 100, '2018-02-20'),
            // Retraitement de 2017 publié avec les comptes 2018 : il l'emporte.
            annual(2018, '2017-12-31', 95, '2019-02-20'),
            annual(2018, '2018-12-31', 130, '2019-02-20'),
          ],
        },
      },
      EarningsPerShareDiluted: { units: { 'USD/shares': [annual(2018, '2018-12-31', 1.3, '2019-02-20')] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [annual(2018, '2018-12-31', 200, '2019-02-20')] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [annual(2018, '2018-12-31', 50, '2019-02-20')] } },
      PaymentsOfDividends: { units: { USD: [annual(2018, '2018-12-31', 40, '2019-02-20')] } },
      OperatingIncomeLoss: { units: { USD: [annual(2018, '2018-12-31', 180, '2019-02-20')] } },
      DepreciationDepletionAndAmortization: { units: { USD: [annual(2018, '2018-12-31', 20, '2019-02-20')] } },
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [instant('2017-12-31', 70, '2018-02-20'), instant('2018-12-31', 80, '2019-02-20')] } },
      LongTermDebt: { units: { USD: [instant('2018-12-31', 300, '2019-02-20')] } },
      ShortTermBorrowings: { units: { USD: [instant('2018-12-31', 25, '2019-02-20')] } },
      StockholdersEquity: { units: { USD: [instant('2018-12-31', 650, '2019-02-20')] } },
      // Montant en devise étrangère : ignoré.
      Assets: { units: { EUR: [instant('2018-12-31', 999, '2019-02-20')] } },
    },
  },
};

describe('SEC companyfacts', () => {
  it('selects US companies quoted in USD', () => {
    expect(isSecEligible('AAPL', 'USD')).toBe(true);
    expect(isSecEligible('BRK-B', 'USD')).toBe(true);
    expect(isSecEligible('MC.PA', 'EUR')).toBe(false);
    expect(isSecEligible('SAP', 'EUR')).toBe(false);
  });

  it('maps tickers to 10-digit CIKs', () => {
    expect(parseCompanyTickers({ 0: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' }, 1: { cik_str: 1067983, ticker: 'BRK.B' } }))
      .toEqual({ AAPL: '0000320193', 'BRK-B': '0001067983' });
  });

  it('builds one row per fiscal year, concept by concept', () => {
    const { name, rows } = parseCompanyFacts(facts);
    expect(name).toBe('Exemple Corp');
    expect(rows.map((r) => r.date)).toEqual(['2016-12-31', '2017-12-31', '2018-12-31']);
    const [, y2017, y2018] = rows;
    expect(y2017.revenue).toBe(1_000); // ancien concept
    expect(y2017.netIncome).toBe(95); // retraitement le plus récent
    expect(y2017.shares).toBe(1_000); // page de garde du 10-K, datée après la clôture
    expect(y2018).toMatchObject({
      revenue: 1_200,
      netIncome: 130,
      eps: 1.3,
      operatingCashFlow: 200,
      capitalExpenditure: -50,
      freeCashFlow: 150,
      dividendsPaid: -40,
      ebitda: 200,
      cash: 80,
      totalDebt: 325,
      equity: 650,
      totalAssets: null,
      shares: 980,
    });
  });

  it('ignores facts whose period cannot be read', () => {
    const broken = { facts: { 'us-gaap': { NetIncomeLoss: { units: { USD: [{ start: 'n/a', end: '2018-12-31', val: 1, form: '10-K', filed: '2019-02-20' }] } } } } };
    expect(parseCompanyFacts(broken).rows).toEqual([]);
  });

  it('returns nothing without US GAAP facts', () => {
    expect(parseCompanyFacts({ facts: { 'ifrs-full': {} } }).rows).toEqual([]);
    expect(parseCompanyFacts(null).rows).toEqual([]);
  });
});

const row = (date: string, values: Partial<StatementRow>): StatementRow => ({
  date, revenue: null, grossProfit: null, operatingIncome: null, ebitda: null, netIncome: null, eps: null, dilutedShares: null,
  operatingCashFlow: null, capitalExpenditure: null, freeCashFlow: null, dividendsPaid: null, totalDebt: null, cash: null,
  equity: null, totalAssets: null, shares: null, ...values,
});

describe('merging sources', () => {
  it('prefers official values, fills gaps and adds missing years', () => {
    const official = [row('2017-12-31', { revenue: 1_000 }), row('2018-12-31', { revenue: 1_200, totalAssets: null })];
    const provider = [row('2018-12-30', { revenue: 1_190, totalAssets: 2_000 }), row('2019-12-31', { revenue: 1_400 })];
    const merged = mergeAnnualRows(official, provider);
    expect(merged.rows.map((r) => [r.date, r.revenue, r.totalAssets])).toEqual([
      ['2017-12-31', 1_000, null],
      ['2018-12-31', 1_200, 2_000],
      ['2019-12-31', 1_400, null],
    ]);
    expect(merged.divergences).toEqual([]);
  });

  it('reports diverging revenue between sources', () => {
    const merged = mergeAnnualRows([row('2018-12-31', { revenue: 1_000 })], [row('2018-12-31', { revenue: 1_200 })]);
    expect(merged.divergences).toEqual([{ date: '2018-12-31', official: 1_000, provider: 1_200 }]);
    expect(merged.rows[0].revenue).toBe(1_000);
  });
});

describe('history', () => {
  const rows = [
    row('2016-12-31', { revenue: 100, netIncome: 10, grossProfit: 40, freeCashFlow: 8, shares: 10, totalDebt: 30, cash: 10, ebitda: 20, equity: 50, dividendsPaid: -4 }),
    row('2017-12-31', { revenue: 110, netIncome: 12, shares: 10 }),
    row('2018-12-31', { revenue: 121, netIncome: -5, shares: 9 }),
  ];

  it('derives margins, leverage, payout and per-share figures', () => {
    const history = buildHistory(rows, dividendsPerYear([{ date: '2016-05-10', amount: 0.25 }, { date: '2016-11-10', amount: 0.15 }]));
    expect(history[0].values).toMatchObject({ grossMargin: 0.4, netMargin: 0.1, netDebt: 20, netDebtToEbitda: 1, roe: 0.2, payoutRatio: 0.4, fcfPerShare: 0.8 });
    expect(history[0].values.dividendPerShare).toBeCloseTo(0.4, 10);
    expect(history[2].values.netMargin).toBeCloseTo(-5 / 121, 10);
    expect(availableMetrics(history).map((m) => m.key)).toContain('revenue');
    expect(availableMetrics(history).map((m) => m.key)).not.toContain('grossMargin');
  });

  it('measures growth over positive years only', () => {
    const history = buildHistory(rows);
    expect(metricGrowth(history, 'revenue')?.rate).toBeCloseTo(0.1, 10);
    expect(metricGrowth(history, 'netIncome')).toBeNull();
  });

  it('indexes a series to 100 from its first positive value', () => {
    expect(indexTo100([null, -2, 50, 75, null, 100])).toEqual([null, null, 100, 150, null, 200]);
  });
});
