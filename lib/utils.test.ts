import { describe, it, expect } from 'vitest';
import {
  isCryptoSymbol,
  getCryptoBaseSymbol,
  getCryptoQuoteCurrency,
  accountTypeAllowsAsset,
  canChangeAccountType,
  defaultSupportsPositions,
  formatCurrency,
  formatCurrencyBreakdown,
} from './utils';

describe('isCryptoSymbol', () => {
  it.each(['BTC-USD', 'eth-usd', 'SOL-USDT', 'SOL-USDC', 'XRP-EUR', 'ADA-GBP', 'ETH-BTC'])(
    'detects crypto pair %s',
    (sym) => expect(isCryptoSymbol(sym)).toBe(true)
  );

  it.each(['MC.PA', 'AAPL', 'BRK-B', 'CW8.PA', '', null, undefined])(
    'rejects non-crypto %s',
    (sym) => expect(isCryptoSymbol(sym)).toBe(false)
  );
});

describe('crypto pair helpers', () => {
  it('extracts the base symbol from supported crypto pairs', () => {
    expect(getCryptoBaseSymbol('BTC-USD')).toBe('BTC');
    expect(getCryptoBaseSymbol('eth-eur')).toBe('ETH');
    expect(getCryptoBaseSymbol('SOL-USDC')).toBe('SOL');
  });

  it('extracts the quote currency from supported crypto pairs', () => {
    expect(getCryptoQuoteCurrency('BTC-USD')).toBe('USD');
    expect(getCryptoQuoteCurrency('ETH-EUR')).toBe('EUR');
    expect(getCryptoQuoteCurrency('SOL-USDC')).toBe('USDC');
    expect(getCryptoQuoteCurrency('AAPL')).toBeNull();
  });

  it('leaves non-crypto symbols untouched when extracting the base', () => {
    expect(getCryptoBaseSymbol('BRK-B')).toBe('BRK-B');
    expect(getCryptoBaseSymbol('MC.PA')).toBe('MC.PA');
  });
});

describe('accountTypeAllowsAsset', () => {
  it('CRYPTO accounts only accept crypto symbols', () => {
    expect(accountTypeAllowsAsset('CRYPTO', 'BTC-USD')).toBe(true);
    expect(accountTypeAllowsAsset('CRYPTO', 'AAPL')).toBe(false);
    expect(accountTypeAllowsAsset('CRYPTO', 'MC.PA')).toBe(false);
  });

  it('non-CRYPTO accounts reject crypto symbols', () => {
    expect(accountTypeAllowsAsset('PEA', 'BTC-USD')).toBe(false);
    expect(accountTypeAllowsAsset('PEA', 'MC.PA')).toBe(true);
    expect(accountTypeAllowsAsset('CTO', 'AAPL')).toBe(true);
    expect(accountTypeAllowsAsset('CTO', 'ETH-USD')).toBe(false);
    expect(accountTypeAllowsAsset('AUTRE', 'BTC-USD')).toBe(false);
    expect(accountTypeAllowsAsset('AUTRE', 'AAPL')).toBe(true);
  });

  it('cash transactions without symbol are always allowed', () => {
    expect(accountTypeAllowsAsset('PEA', null)).toBe(true);
    expect(accountTypeAllowsAsset('CRYPTO', undefined)).toBe(true);
    expect(accountTypeAllowsAsset('LIVRET_A', '')).toBe(true);
  });
});

describe('defaultSupportsPositions', () => {
  it('CRYPTO is position-capable by default', () => {
    expect(defaultSupportsPositions('CRYPTO')).toBe(true);
  });
  it('keeps existing defaults intact', () => {
    expect(defaultSupportsPositions('PEA')).toBe(true);
    expect(defaultSupportsPositions('CTO')).toBe(true);
    expect(defaultSupportsPositions('ASSURANCE_VIE')).toBe(true);
    expect(defaultSupportsPositions('LIVRET_A')).toBe(false);
    expect(defaultSupportsPositions('LDDS')).toBe(false);
    expect(defaultSupportsPositions('PEL')).toBe(false);
    expect(defaultSupportsPositions('AUTRE')).toBe(false);
  });
});

describe('canChangeAccountType', () => {
  it('allows non-crypto account type changes', () => {
    expect(canChangeAccountType('PEA', 'CTO')).toBe(true);
    expect(canChangeAccountType('LIVRET_A', 'AUTRE')).toBe(true);
  });

  it('keeps CRYPTO isolated from regular account types', () => {
    expect(canChangeAccountType('CRYPTO', 'CRYPTO')).toBe(true);
    expect(canChangeAccountType('CRYPTO', 'CTO')).toBe(false);
    expect(canChangeAccountType('PEA', 'CRYPTO')).toBe(false);
  });
});

describe('formatCurrency', () => {
  it('formats stablecoin-like 4-letter currencies without throwing', () => {
    expect(formatCurrency(1234.5, 'USDC')).toContain('USDC');
  });

  it('keeps small crypto fees readable', () => {
    expect(formatCurrency(0.000003, 'SOL')).toContain('0,00000300');
  });
});

describe('formatCurrencyBreakdown', () => {
  it('keeps non-account currency cash buckets visible', () => {
    expect(formatCurrencyBreakdown({ EUR: 0, USDC: 4000 })).toContain('USDC');
  });
});
