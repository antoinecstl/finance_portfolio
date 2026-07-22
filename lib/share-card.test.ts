import { describe, expect, it } from 'vitest';
import {
  buildSanitizedShareCardData,
  DEFAULT_SHARE_CARD_SETTINGS,
  type PositionShareData,
} from './share-card';

const position: PositionShareData = {
  ticker: 'ACME',
  performancePercent: 12.34,
  accountName: 'Mon PEA secret',
  value: 9876.54,
  investedAmount: 7654.32,
  quantity: 42,
  averagePrice: 182.25,
  currency: 'EUR',
};

describe('buildSanitizedShareCardData', () => {
  it('only includes the ticker and percentage performance by default', () => {
    expect(buildSanitizedShareCardData(position, DEFAULT_SHARE_CARD_SETTINGS)).toEqual({
      currency: 'EUR',
      ticker: 'ACME',
      performancePercent: 12.34,
    });
  });

  it.each([
    ['accountName', 'showAccountName'],
    ['value', 'showValue'],
    ['investedAmount', 'showInvestedAmount'],
    ['quantity', 'showQuantity'],
    ['averagePrice', 'showAveragePrice'],
  ] as const)('omits %s when its option is disabled', (field, option) => {
    const settings = { ...DEFAULT_SHARE_CARD_SETTINGS, [option]: false };
    expect(buildSanitizedShareCardData(position, settings)).not.toHaveProperty(field);
  });

  it('only copies sensitive properties that were explicitly enabled', () => {
    const result = buildSanitizedShareCardData(position, {
      ...DEFAULT_SHARE_CARD_SETTINGS,
      showQuantity: true,
      showAveragePrice: true,
    });

    expect(result).toMatchObject({ quantity: 42, averagePrice: 182.25 });
    expect(result).not.toHaveProperty('accountName');
    expect(result).not.toHaveProperty('value');
    expect(result).not.toHaveProperty('investedAmount');
  });
});
