import { describe, expect, it } from 'vitest';
import { BENCHMARKS, DEFAULT_BENCHMARK, isPresetBenchmark } from './benchmarks';

describe('benchmarks', () => {
  it('uses the S&P 500 as the default reference', () => {
    expect(DEFAULT_BENCHMARK).toBe('^GSPC');
    expect(Object.keys(BENCHMARKS)[0]).toBe(DEFAULT_BENCHMARK);
  });

  it('offers global equities and the two main cryptocurrencies', () => {
    expect(BENCHMARKS.URTH.label).toContain('MSCI World');
    expect(BENCHMARKS['BTC-USD'].label).toBe('Bitcoin');
    expect(BENCHMARKS['ETH-USD'].label).toBe('Ethereum');
  });

  it('distinguishes presets from custom market-data symbols', () => {
    expect(isPresetBenchmark('^GSPC')).toBe(true);
    expect(isPresetBenchmark('AAPL')).toBe(false);
  });
});
