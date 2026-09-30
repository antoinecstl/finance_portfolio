import { describe, it, expect } from 'vitest';
import type { PortfolioHistoryPoint } from './portfolio-calculator';
import { buildAccountHistorySeries, OTHER_ACCOUNTS_KEY } from './account-history';

function point(date: string, accountValues?: Record<string, number>): PortfolioHistoryPoint {
  const total = Object.values(accountValues ?? {}).reduce((sum, v) => sum + v, 0);
  return { date, totalValue: total, stocksValue: 0, savingsValue: 0, accountValues, positions: [] };
}

describe('buildAccountHistorySeries', () => {
  const accounts = [
    { id: 'pea', name: 'PEA' },
    { id: 'livret', name: 'Livret A' },
    { id: 'empty', name: 'Vide' },
  ];

  it('builds one series per account, largest at the bottom', () => {
    const result = buildAccountHistorySeries(
      [point('2026-01-01', { pea: 100, livret: 500 }), point('2026-01-02', { pea: 900, livret: 500 })],
      accounts
    );

    expect(result?.series.map((s) => s.label)).toEqual(['PEA', 'Livret A']);
    expect(result?.series[0].color).toBe('var(--account-1)');
    expect(result?.series[1].color).toBe('var(--account-2)');
    expect(result?.rows[1]).toMatchObject({ date: '2026-01-02', total: 1400, acc_pea: 900, acc_livret: 500 });
  });

  it('fills missing values with zero', () => {
    const result = buildAccountHistorySeries(
      [point('2026-01-01', { livret: 500 }), point('2026-01-02', { pea: 10, livret: 500 })],
      accounts
    );
    expect(result?.rows[0].acc_pea).toBe(0);
  });

  it('returns null without per-account values', () => {
    expect(buildAccountHistorySeries([point('2026-01-01')], accounts)).toBeNull();
  });

  it('groups accounts beyond the palette', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, name: `Compte ${i}` }));
    const values = Object.fromEntries(many.map((a) => [a.id, 10]));
    const result = buildAccountHistorySeries([point('2026-01-01', values)], many);

    expect(result?.series).toHaveLength(8);
    const others = result?.series[result.series.length - 1];
    expect(others?.key).toBe(OTHER_ACCOUNTS_KEY);
    expect(others?.latestValue).toBe(30);
  });
});
