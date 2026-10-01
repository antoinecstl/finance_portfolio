import { describe, expect, it } from 'vitest';
import { buildNiceYAxisScale, evenlySpacedTicks, tickCountForWidth } from './chart-axis';

describe('buildNiceYAxisScale', () => {
  it('wraps values in rounded grid boundaries', () => {
    expect(buildNiceYAxisScale([105_000, 112_000]).domain).toEqual([105_000, 112_500]);
    expect(buildNiceYAxisScale([105_000, 112_000]).ticks).toEqual([105_000, 107_500, 110_000, 112_500]);
  });

  it('keeps percentage axes centered around zero when requested', () => {
    const scale = buildNiceYAxisScale([-3.2, 8.4], { includeZero: true });
    expect(scale.domain[0]).toBeLessThanOrEqual(-3.2);
    expect(scale.domain[1]).toBeGreaterThanOrEqual(8.4);
    expect(scale.ticks).toContain(0);
  });
});

describe('evenlySpacedTicks', () => {
  it('keeps first and last values with even spacing', () => {
    const values = Array.from({ length: 31 }, (_, i) => i);
    expect(evenlySpacedTicks(values, 4)).toEqual([0, 10, 20, 30]);
    expect(evenlySpacedTicks(values, 7)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it('returns every value when there are few points', () => {
    expect(evenlySpacedTicks(['a', 'b'], 5)).toEqual(['a', 'b']);
  });
});

describe('tickCountForWidth', () => {
  it('adapts to the chart width within bounds', () => {
    expect(tickCountForWidth(300)).toBe(3);
    expect(tickCountForWidth(700)).toBe(7);
    expect(tickCountForWidth(5000)).toBe(9);
    expect(tickCountForWidth(0)).toBe(5);
  });
});
