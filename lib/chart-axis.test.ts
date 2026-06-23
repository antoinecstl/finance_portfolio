import { describe, expect, it } from 'vitest';
import { buildNiceYAxisScale } from './chart-axis';

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
