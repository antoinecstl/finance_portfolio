import type { PositionMetrics } from './position-metrics';

export type ShareCardFormat = 'square' | 'portrait' | 'story';
export type ShareCardTheme = 'light' | 'dark';

export interface ShareCardSettings {
  format: ShareCardFormat; theme: ShareCardTheme;
  showTotalValue: boolean; showInvestedAmount: boolean; showGainAmount: boolean;
  showGainPercent: boolean; showQuantity: boolean; showAveragePrice: boolean;
  showCurrentPrice: boolean; showWeight: boolean; showAccountName: boolean;
  showDividends: boolean;
}

export interface PositionShareData {
  symbol: string; name: string; valuationDate: string; currency: string;
  totalValue?: number; investedAmount?: number; gainAmount?: number; gainPercent?: number;
  quantity?: number; averagePrice?: number; currentPrice?: number; weight?: number;
  accountName?: string; dividends?: number;
}

export const SHARE_CARD_DIMENSIONS: Record<ShareCardFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 },
};

export const DEFAULT_SHARE_CARD_SETTINGS: ShareCardSettings = {
  format: 'square', theme: 'light', showTotalValue: false, showInvestedAmount: false,
  showGainAmount: false, showGainPercent: true, showQuantity: false, showAveragePrice: false,
  showCurrentPrice: false, showWeight: false, showAccountName: false, showDividends: false,
};

export function createPositionShareData(metric: PositionMetrics, settings: ShareCardSettings, valuationDate: string): PositionShareData {
  return { symbol: metric.symbol, name: metric.name, valuationDate, currency: metric.quoteCurrency,
    ...(settings.showTotalValue && { totalValue: metric.nativeCurrentValue }),
    ...(settings.showInvestedAmount && { investedAmount: metric.nativeInvestedValue }),
    ...(settings.showGainAmount && { gainAmount: metric.gainValue }),
    ...(settings.showGainPercent && { gainPercent: metric.totalReturnPercent }),
    ...(settings.showQuantity && { quantity: metric.quantity }), ...(settings.showAveragePrice && { averagePrice: metric.avgPrice }),
    ...(settings.showCurrentPrice && { currentPrice: metric.currentPrice }), ...(settings.showWeight && { weight: metric.weight }),
    ...(settings.showAccountName && { accountName: metric.accountName }),
    ...(settings.showDividends && { dividends: metric.transactionStats.totalDividendsInBase }), };
}
