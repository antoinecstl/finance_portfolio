import { describe, expect, it } from 'vitest';
import {
  formatPdfCurrency,
  formatPdfCurrencyBreakdown,
  formatPdfNumber,
  toPdfText,
} from './pdf-format';

describe('toPdfText', () => {
  it('replaces unicode spacing and glyphs that render badly in jsPDF core fonts', () => {
    expect(toPdfText('1\u202f234,50\u00a0\u20ac')).toBe('1 234,50 EUR');
    expect(toPdfText('fi-hub \u2014 page 1 \u2192 2')).toBe('fi-hub - page 1 -> 2');
  });
});

describe('formatPdfNumber', () => {
  it('formats French numbers with regular spaces only', () => {
    const formatted = formatPdfNumber(1234567.89);

    expect(formatted).toBe('1 234 567,89');
    expect(formatted).not.toContain('\u202f');
    expect(formatted).not.toContain('\u00a0');
  });
});

describe('formatPdfCurrency', () => {
  it('uses currency codes instead of PDF-fragile symbols', () => {
    expect(formatPdfCurrency(1234.5, 'EUR')).toBe('1 234,50 EUR');
  });

  it('keeps small crypto amounts readable', () => {
    expect(formatPdfCurrency(0.000003, 'SOL')).toBe('0,00000300 SOL');
  });
});

describe('formatPdfCurrencyBreakdown', () => {
  it('formats multi-currency buckets without non-breaking spaces', () => {
    const formatted = formatPdfCurrencyBreakdown({ EUR: 1234.5, USDC: 4000 });

    expect(formatted).toBe('1 234,50 EUR + 4 000,00 USDC');
    expect(formatted).not.toContain('\u202f');
    expect(formatted).not.toContain('\u00a0');
  });
});
