import { describe, expect, it } from 'vitest';
import { parseCryptoDetails, parseEtfDetails, supplyMetrics } from './details';

const r = (raw: number) => ({ raw, fmt: String(raw) });
const wrap = (result: Record<string, unknown>) => ({ quoteSummary: { result: [result], error: null } });

describe('ETF details', () => {
  const json = wrap({
    fundProfile: { family: 'Amundi', categoryName: 'Global Large-Cap Blend Equity', legalType: 'Exchange Traded Fund', feesExpensesInvestment: { annualReportExpenseRatio: r(0.0038) } },
    summaryDetail: { totalAssets: r(5_600_000_000), yield: r(0) },
    defaultKeyStatistics: { fundInceptionDate: r(1_239_580_800) },
    topHoldings: {
      stockPosition: r(0.9951), cashPosition: r(0.0049), bondPosition: r(0),
      holdings: [
        { symbol: 'MSFT', holdingName: 'Microsoft Corp', holdingPercent: r(0.046) },
        { symbol: 'AAPL', holdingName: 'Apple Inc', holdingPercent: r(0.051) },
        { holdingName: 'Sans symbole', holdingPercent: r(0.01) },
      ],
      sectorWeightings: [{ technology: r(0.24) }, { realestate: r(0.023) }, { utilities: r(0) }],
      equityHoldings: { priceToEarnings: r(21.4), priceToBook: r(3.1) },
    },
    fundPerformance: { riskOverviewStatistics: { riskStatistics: [{ year: '5y', beta: r(1), sharpeRatio: r(0.71), stdDev: r(17.5) }] } },
  });

  it('reads profile, fees, holdings, sectors and allocation', () => {
    const etf = parseEtfDetails(json);
    expect(etf?.profile).toMatchObject({ family: 'Amundi', expenseRatio: 0.0038, totalAssets: 5_600_000_000, inceptionDate: '2009-04-13' });
    expect(etf?.holdings.map((h) => h.name)).toEqual(['Apple Inc', 'Microsoft Corp', 'Sans symbole']);
    expect(etf?.holdings[2].symbol).toBeNull();
    expect(etf?.sectors).toEqual([{ key: 'technology', label: 'Technologie', weight: 0.24 }, { key: 'realestate', label: 'Immobilier', weight: 0.023 }]);
    expect(etf?.allocation.map((a) => a.label)).toEqual(['Actions', 'Liquidités']);
    expect(etf?.portfolioMultiples.per).toBe(21.4);
    expect(etf?.risk).toEqual([{ period: '5y', beta: 1, sharpe: 0.71, volatility: 0.175 }]);
  });

  it('accepts fees published as a percentage', () => {
    // « 0,38 » publié en pourcentage = 0,38 % de frais par an.
    const etf = parseEtfDetails(wrap({ fundProfile: { categoryName: 'X', feesExpensesInvestment: { annualReportExpenseRatio: r(0.38) } } }));
    expect(etf?.profile.expenseRatio).toBeCloseTo(0.0038, 10);
  });

  it('returns null when nothing is published', () => {
    expect(parseEtfDetails(wrap({}))).toBeNull();
    expect(parseEtfDetails({ quoteSummary: { result: null } })).toBeNull();
  });
});

describe('crypto details', () => {
  it('reads supply, market data and description', () => {
    const crypto = parseCryptoDetails(wrap({
      summaryDetail: { marketCap: r(1.2e12), volume24Hr: r(3e10), circulatingSupply: r(19_800_000), maxSupply: r(21_000_000), startDate: r(1_230_940_800), algorithm: 'SHA256' },
      summaryProfile: { description: 'Bitcoin (BTC) is a cryptocurrency.' },
    }));
    expect(crypto).toMatchObject({ marketCap: 1.2e12, maxSupply: 21_000_000, startDate: '2009-01-03', algorithm: 'SHA256', description: 'Bitcoin (BTC) is a cryptocurrency.' });
    const supply = supplyMetrics(crypto!, 60_000);
    expect(supply.issuedShare).toBeCloseTo(19.8 / 21, 10);
    expect(supply.fullyDilutedValue).toBe(21_000_000 * 60_000);
    expect(supply.volumeToMarketCap).toBeCloseTo(0.025, 10);
  });

  it('leaves unknown supply empty (no maximum)', () => {
    const crypto = parseCryptoDetails(wrap({ summaryDetail: { marketCap: r(4e11), circulatingSupply: r(120_000_000) } }));
    expect(supplyMetrics(crypto!, 3_000)).toEqual({ issuedShare: null, fullyDilutedValue: null, volumeToMarketCap: null });
  });
});
