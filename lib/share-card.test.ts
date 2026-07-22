import { describe, expect, it } from 'vitest';
import { createPositionShareData, DEFAULT_SHARE_CARD_SETTINGS, type ShareCardSettings } from './share-card';
import type { PositionMetrics } from './position-metrics';

const metric: PositionMetrics = {
  key: 'a:AIR.PA:EUR', symbol: 'AIR.PA', displayLabel: 'AIR.PA', name: 'Airbus', accountId: 'a', accountName: 'Mon PEA', accountType: 'PEA',
  currentValue: 1200, investedValue: 1000, gainValue: 200, gainPercent: 20, dayChange: -10, dayChangePercent: -0.8,
  nativeCurrentValue: 1200, nativeInvestedValue: 1000, nativeDayChange: -10, totalReturnValue: 225, totalReturnPercent: 22.5,
  weight: 40, quantity: 8, avgPrice: 125, currentPrice: 150, costCurrency: 'EUR', quoteCurrency: 'EUR', color: '#000', isCrypto: false,
  transactionStats: { buys: [], sells: [], dividends: [], totalBought: 8, totalSold: 0, totalBuyAmount: 1000, totalSellAmount: 0, totalDividends: 25, totalDividendsInBase: 25, allTransactions: [] },
};

describe('createPositionShareData', () => {
  it('masque par défaut tous les montants absolus et le compte', () => {
    const data = createPositionShareData(metric, DEFAULT_SHARE_CARD_SETTINGS, '2026-07-22');
    expect(data).toEqual({ symbol: 'AIR.PA', name: 'Airbus', valuationDate: '2026-07-22', currency: 'EUR', gainPercent: 22.5 });
    expect(JSON.stringify(data)).not.toContain('Mon PEA');
    expect(data).not.toHaveProperty('totalValue'); expect(data).not.toHaveProperty('gainAmount');
  });

  it('n’expose chaque valeur sensible que lorsque son option est activée', () => {
    const settings: ShareCardSettings = Object.fromEntries(Object.entries(DEFAULT_SHARE_CARD_SETTINGS).map(([key, value]) => [key, typeof value === 'boolean' ? true : value])) as unknown as ShareCardSettings;
    const data = createPositionShareData(metric, settings, '2026-07-22');
    expect(data).toMatchObject({ totalValue: 1200, investedAmount: 1000, gainAmount: 200, gainPercent: 22.5, quantity: 8, averagePrice: 125, currentPrice: 150, weight: 40, accountName: 'Mon PEA', dividends: 25 });
  });
});
