import { describe, expect, it } from 'vitest';
import type { PortfolioHistoryPoint } from './portfolio-calculator';
import type { Transaction } from './types';
import { buildPerformanceProjection } from './performance-projection';

const point = (date: string, value: number): PortfolioHistoryPoint => ({
  date, totalValue: value, stocksValue: value, savingsValue: 0, positions: [],
});

const deposit = (date: string, amount: number): Transaction => ({
  id: date, account_id: 'account', type: 'DEPOSIT', amount, currency: 'EUR', date, created_at: date, description: '',
});

describe('buildPerformanceProjection', () => {
  it('annualizes an observed history shorter than one year', () => {
    const result = buildPerformanceProjection(
      [point('2025-01-01', 1000), point('2025-07-02', 1100)],
      [],
      1
    );

    expect(result).not.toBeNull();
    expect(result?.isAnnualized).toBe(true);
    expect(result?.annualRate).toBeCloseTo(0.21, 1);
    expect(result?.points.at(-1)?.projected).toBeCloseTo(1331, -1);
  });

  it('does not interpret a deposit as investment performance', () => {
    const result = buildPerformanceProjection(
      [point('2025-01-01', 1000), point('2026-01-01', 1600)],
      [deposit('2025-06-01', 500)],
      1
    );

    expect(result?.annualRate).toBeCloseTo(0.1, 5);
    expect(result?.projectedValue).toBeCloseTo(1760, 5);
  });

  it('connects the projected curve to the latest actual point', () => {
    const result = buildPerformanceProjection(
      [point('2025-01-01', 100), point('2026-01-01', 120)],
      [],
      3
    );

    expect(result?.points.filter(item => item.actual !== null)).toHaveLength(2);
    expect(result?.points[1]).toEqual({ date: '2026-01-01', actual: 120, projected: 120 });
    expect(result?.points).toHaveLength(38);
  });
});
