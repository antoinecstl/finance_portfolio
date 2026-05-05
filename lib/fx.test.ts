import { describe, it, expect } from 'vitest';
import {
  BASE_CURRENCY,
  convertToBase,
  fxYahooSymbol,
  normalizeToFiat,
  uniqueForeignFiats,
} from './fx';
import type { HistoricalQuote } from './stock-api';

const usdSeries: HistoricalQuote[] = [
  { date: '2025-01-01', open: 1.10, high: 1.10, low: 1.10, close: 1.10, volume: 0, adjustedClose: 1.10 },
  { date: '2025-02-01', open: 1.05, high: 1.05, low: 1.05, close: 1.05, volume: 0, adjustedClose: 1.05 },
];

describe('normalizeToFiat', () => {
  it('maps USDC and USDT to USD', () => {
    expect(normalizeToFiat('USDC')).toBe('USD');
    expect(normalizeToFiat('USDT')).toBe('USD');
    expect(normalizeToFiat('busd')).toBe('USD');
  });

  it('maps EURC to EUR', () => {
    expect(normalizeToFiat('EURC')).toBe('EUR');
  });

  it('passes through plain fiat codes unchanged', () => {
    expect(normalizeToFiat('GBP')).toBe('GBP');
    expect(normalizeToFiat('USD')).toBe('USD');
  });

  it('defaults to EUR for nullish input', () => {
    expect(normalizeToFiat(null)).toBe(BASE_CURRENCY);
    expect(normalizeToFiat(undefined)).toBe(BASE_CURRENCY);
  });
});

describe('fxYahooSymbol', () => {
  it('builds EUR{X}=X for non-base fiats', () => {
    expect(fxYahooSymbol('USD')).toBe('EURUSD=X');
    expect(fxYahooSymbol('GBP')).toBe('EURGBP=X');
  });

  it('returns null for the base currency', () => {
    expect(fxYahooSymbol('EUR')).toBeNull();
  });

  it('normalizes stablecoins before building the symbol', () => {
    expect(fxYahooSymbol('USDC')).toBe('EURUSD=X');
  });
});

describe('uniqueForeignFiats', () => {
  it('lists non-EUR fiats from currency and target_currency', () => {
    const fiats = uniqueForeignFiats([
      { currency: 'EUR' },
      { currency: 'USDC' },
      { currency: 'USD' },
      { currency: 'EUR', target_currency: 'GBP' },
    ]);
    expect(new Set(fiats)).toEqual(new Set(['USD', 'GBP']));
  });

  it('returns an empty array for pure EUR portfolios', () => {
    expect(uniqueForeignFiats([{ currency: 'EUR' }])).toEqual([]);
  });
});

describe('convertToBase', () => {
  it('returns the amount unchanged when already in base', () => {
    expect(convertToBase(123, 'EUR', '2025-01-01', { USD: usdSeries })).toBe(123);
  });

  it('divides by the closest EURUSD=X close', () => {
    // 110 USD au 2025-01-01 (close 1.10) → 100 EUR.
    expect(convertToBase(110, 'USD', '2025-01-01', { USD: usdSeries })).toBeCloseTo(100, 6);
    // 105 USD au 2025-02-01 (close 1.05) → 100 EUR.
    expect(convertToBase(105, 'USD', '2025-02-01', { USD: usdSeries })).toBeCloseTo(100, 6);
  });

  it('treats stablecoins like their fiat equivalent', () => {
    expect(convertToBase(110, 'USDC', '2025-01-01', { USD: usdSeries })).toBeCloseTo(100, 6);
    expect(convertToBase(110, 'USDT', '2025-01-01', { USD: usdSeries })).toBeCloseTo(100, 6);
  });

  it('falls back to identity when no rate is available', () => {
    expect(convertToBase(110, 'USD', '2025-01-01', {})).toBe(110);
    expect(convertToBase(110, 'XYZ', '2025-01-01', { USD: usdSeries })).toBe(110);
  });

  it('returns 0 for zero or non-finite inputs', () => {
    expect(convertToBase(0, 'USD', '2025-01-01', { USD: usdSeries })).toBe(0);
    expect(convertToBase(NaN, 'USD', '2025-01-01', { USD: usdSeries })).toBe(0);
  });
});
