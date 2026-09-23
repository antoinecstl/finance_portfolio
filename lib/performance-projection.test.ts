import { describe, expect, it } from 'vitest';
import type { PortfolioHistoryPoint } from './portfolio-calculator';
import type { Transaction } from './types';
import { balanceProjectionTimeline, buildPerformanceProjection } from './performance-projection';

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
    expect(result?.points[1]).toMatchObject({ date: '2026-01-01', actual: 120, projected: 120, pessimistic: 120, optimistic: 120 });
    expect(result?.points).toHaveLength(38);
  });

  it('builds an ordered range of pessimistic, average and optimistic scenarios', () => {
    const result = buildPerformanceProjection(
      [point('2024-01-01', 100), point('2024-07-01', 130), point('2025-01-01', 110)],
      [],
      10
    );

    expect(result?.pessimisticAnnualRate).toBeLessThan(result?.annualRate ?? 0);
    expect(result?.optimisticAnnualRate).toBeGreaterThan(result?.annualRate ?? 0);
    expect(result?.pessimisticValue).toBeLessThan(result?.projectedValue ?? 0);
    expect(result?.optimisticValue).toBeGreaterThan(result?.projectedValue ?? 0);
  });

  it('limits the displayed and analyzed history to the selected lookback', () => {
    const result = buildPerformanceProjection(
      [point('2020-01-01', 50), point('2024-01-01', 100), point('2025-01-01', 120), point('2026-01-01', 150)],
      [],
      3,
      {},
      1
    );

    expect(result?.points[0].date).toBe('2025-01-01');
    expect(result?.observedDays).toBe(365);
  });

  it('reserves at least half of the chart timeline for the projection', () => {
    const historical = Array.from({ length: 100 }, (_, index) => ({
      date: `2025-01-${String((index % 28) + 1).padStart(2, '0')}`,
      actual: 100 + index,
      projected: null,
      pessimistic: null,
      optimistic: null,
      range: null,
    }));
    const future = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-${String(index + 1).padStart(2, '0')}-01`,
      actual: null,
      projected: 200 + index,
      pessimistic: 190 + index,
      optimistic: 210 + index,
      range: [190 + index, 210 + index] as [number, number],
    }));

    const balanced = balanceProjectionTimeline([...historical, ...future]);
    expect(balanced.filter(item => item.actual !== null)).toHaveLength(12);
    expect(balanced.filter(item => item.actual === null)).toHaveLength(12);
    expect(balanced[0]).toBe(historical[0]);
    expect(balanced[11]).toBe(historical[99]);
  });
});
