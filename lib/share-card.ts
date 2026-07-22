export interface PositionShareData {
  ticker: string;
  performancePercent: number;
  accountName: string;
  value: number;
  investedAmount: number;
  quantity: number;
  averagePrice: number;
  currency: string;
}

export interface ShareCardSettings {
  showTicker: boolean;
  showPerformancePercent: boolean;
  showAccountName: boolean;
  showValue: boolean;
  showInvestedAmount: boolean;
  showQuantity: boolean;
  showAveragePrice: boolean;
}

export const DEFAULT_SHARE_CARD_SETTINGS: Readonly<ShareCardSettings> = Object.freeze({
  showTicker: true,
  showPerformancePercent: true,
  showAccountName: false,
  showValue: false,
  showInvestedAmount: false,
  showQuantity: false,
  showAveragePrice: false,
});

export type SanitizedPositionShareData = Partial<PositionShareData> &
  Pick<PositionShareData, 'currency'>;

/**
 * Builds the sole object that may be handed to a share-card renderer.
 * Disabled fields are deliberately absent rather than merely hidden with CSS.
 */
export function buildSanitizedShareCardData(
  data: PositionShareData,
  settings: ShareCardSettings,
): SanitizedPositionShareData {
  return {
    currency: data.currency,
    ...(settings.showTicker ? { ticker: data.ticker } : {}),
    ...(settings.showPerformancePercent ? { performancePercent: data.performancePercent } : {}),
    ...(settings.showAccountName ? { accountName: data.accountName } : {}),
    ...(settings.showValue ? { value: data.value } : {}),
    ...(settings.showInvestedAmount ? { investedAmount: data.investedAmount } : {}),
    ...(settings.showQuantity ? { quantity: data.quantity } : {}),
    ...(settings.showAveragePrice ? { averagePrice: data.averagePrice } : {}),
  };
}

export function hasSensitiveShareCardData(settings: ShareCardSettings): boolean {
  return settings.showAccountName || settings.showValue || settings.showInvestedAmount
    || settings.showQuantity || settings.showAveragePrice;
}
