import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from './types';
import type { HistoricalQuote } from './stock-api';
import {
  calculateAccountValuesAtDate,
  calculateAccountYearToDateStats,
  calculatePortfolioYearToDateStats,
  getYearStartReferenceDate,
} from './account-stats';

let _id = 0;
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? `tx-${++_id}`,
    account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'DEPOSIT',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    description: '',
    date: partial.date ?? '2025-01-01',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: null,
    target_currency: null,
    created_at: '2025-01-01T00:00:00Z',
    fee_transaction_id: null,
  };
}

function acc(partial: Partial<Account>): Account {
  return {
    id: partial.id ?? 'acc-1',
    name: partial.name ?? 'Test',
    type: partial.type ?? 'CTO',
    currency: partial.currency ?? 'EUR',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  };
}

function quote(date: string, close: number, currency = 'EUR'): HistoricalQuote {
  return { date, open: close, high: close, low: close, close, volume: 0, adjustedClose: close, currency };
}

describe('getYearStartReferenceDate', () => {
  it('returns December 31st of the previous year', () => {
    expect(getYearStartReferenceDate(2026)).toBe('2025-12-31');
  });
});

describe('calculateAccountValuesAtDate', () => {
  it('values stock accounts with the last close on or before the date, plus cash', () => {
    const transactions = [
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 1000, date: '2025-03-01' }),
      tx({ account_id: 'cto', type: 'BUY', amount: 500, stock_symbol: 'AAA', quantity: 10, price_per_unit: 50, date: '2025-03-02' }),
      // Après la date de référence : ignoré.
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 9999, date: '2026-01-05' }),
      tx({ account_id: 'livret', type: 'DEPOSIT', amount: 200, date: '2025-06-01' }),
      tx({ account_id: 'livret', type: 'INTEREST', amount: 5, date: '2025-12-31' }),
    ];
    const accounts = [acc({ id: 'cto', type: 'CTO' }), acc({ id: 'livret', type: 'LIVRET_A' }), acc({ id: 'new', type: 'PEA' })];
    const quotes = { AAA: [quote('2025-12-29', 60), quote('2025-12-30', 70)] };

    expect(calculateAccountValuesAtDate(transactions, accounts, quotes, '2025-12-31')).toEqual({
      cto: 500 + 10 * 70,
      livret: 205,
      new: 0,
    });
  });
});

describe('calculateAccountYearToDateStats', () => {
  it('splits the change between net flows and performance', () => {
    const transactions = [
      tx({ type: 'DEPOSIT', amount: 1000, date: '2025-02-01' }),
      tx({ type: 'DEPOSIT', amount: 500, date: '2026-01-01' }),
      tx({ type: 'WITHDRAWAL', amount: 100, date: '2026-03-01' }),
      tx({ type: 'DIVIDEND', amount: 20, date: '2026-04-01' }),
      tx({ type: 'INTEREST', amount: 10, date: '2026-05-01' }),
      tx({ type: 'FEE', amount: 3, date: '2026-05-02' }),
      // Autre compte : ignoré.
      tx({ account_id: 'other', type: 'DEPOSIT', amount: 50_000, date: '2026-02-01' }),
    ];

    const stats = calculateAccountYearToDateStats({
      accountId: 'acc-1',
      transactions,
      startValue: 1000,
      currentValue: 1600,
      today: '2026-09-30',
    });

    expect(stats.year).toBe(2026);
    expect(stats.change).toBe(600);
    expect(stats.changePercent).toBeCloseTo(60);
    expect(stats.deposits).toBe(500);
    expect(stats.withdrawals).toBe(100);
    expect(stats.netFlows).toBe(400);
    expect(stats.income).toBe(30);
    expect(stats.fees).toBe(3);
    expect(stats.performance).toBe(200);
    expect(stats.performancePercent).toBeGreaterThan(0);
    expect(stats.performancePercent).toBeLessThan(20);
  });

  it('handles accounts opened during the year', () => {
    const stats = calculateAccountYearToDateStats({
      accountId: 'acc-1',
      transactions: [tx({ type: 'DEPOSIT', amount: 1000, date: '2026-06-01' })],
      startValue: 0,
      currentValue: 1100,
      today: '2026-09-30',
    });

    expect(stats.changePercent).toBeNull();
    expect(stats.change).toBe(1100);
    expect(stats.netFlows).toBe(1000);
    expect(stats.performance).toBe(100);
    // Modified Dietz : le capital n'a été investi que 121 jours sur 272.
    expect(stats.performancePercent).toBeCloseTo((100 / (1000 * 121 / 272)) * 100, 5);
  });

  it('converts foreign-currency flows to EUR', () => {
    const stats = calculateAccountYearToDateStats({
      accountId: 'acc-1',
      transactions: [tx({ type: 'DEPOSIT', amount: 200, currency: 'USD', date: '2026-02-01' })],
      startValue: 0,
      currentValue: 100,
      today: '2026-09-30',
      fxRates: { USD: [quote('2026-01-30', 2)] },
    });

    expect(stats.deposits).toBe(100);
    expect(stats.performance).toBe(0);
  });
});

describe('calculatePortfolioYearToDateStats', () => {
  it('consolidates several accounts and ignores the others', () => {
    const stats = calculatePortfolioYearToDateStats({
      accountIds: ['acc-1', 'acc-2'],
      transactions: [
        tx({ type: 'DEPOSIT', amount: 500, date: '2026-01-01' }),
        tx({ account_id: 'acc-2', type: 'DEPOSIT', amount: 300, date: '2026-01-01' }),
        tx({ account_id: 'acc-2', type: 'INTEREST', amount: 12, date: '2026-06-30' }),
        tx({ account_id: 'other', type: 'DEPOSIT', amount: 50_000, date: '2026-02-01' }),
      ],
      startValue: 2000,
      currentValue: 3000,
      today: '2026-09-30',
    });

    expect(stats.netFlows).toBe(800);
    expect(stats.income).toBe(12);
    expect(stats.performance).toBe(200);
    expect(stats.performancePercent).toBeCloseTo((200 / 2800) * 100, 5);
  });
});
