import { describe, it, expect } from 'vitest';
import type { Transaction, Account } from './types';
import type { HistoricalQuote } from './stock-api';
import {
  calculatePositionsAtDate,
  calculateAllPositionsAtDate,
  aggregatePositionsBySymbol,
  calculateAccountCashAtDate,
  calculateAccountCashFromTransactions,
  calculateAccountTotalValue,
  calculateModifiedDietzPerformance,
  calculatePortfolioHistory,
  calculatePortfolioPerformance,
  getFirstTransactionDate,
  getUniqueSymbolsFromTransactions,
} from './portfolio-calculator';

// Helpers de fabrication — gardent les tests lisibles.
let _id = 0;
const nextId = () => `tx-${++_id}`;

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? nextId(),
    account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'BUY',
    amount: partial.amount ?? 0,
    description: partial.description ?? '',
    date: partial.date ?? '2025-01-01',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    created_at: partial.created_at ?? '2025-01-01T00:00:00Z',
    fee_transaction_id: partial.fee_transaction_id ?? null,
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

describe('calculatePositionsAtDate', () => {
  it('returns empty map when no transactions', () => {
    expect(calculatePositionsAtDate([], '2025-01-01').size).toBe(0);
  });

  it('creates a position from a single BUY', () => {
    const positions = calculatePositionsAtDate(
      [tx({ type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01' })],
      '2025-01-02'
    );
    const aapl = positions.get('AAPL')!;
    expect(aapl.quantity).toBe(10);
    expect(aapl.averagePrice).toBe(100);
    expect(aapl.totalInvested).toBe(1000);
  });

  it('computes weighted average price across multiple BUYs', () => {
    const positions = calculatePositionsAtDate(
      [
        tx({ type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01' }),
        tx({ type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 150, date: '2025-02-01' }),
      ],
      '2025-03-01'
    );
    const aapl = positions.get('AAPL')!;
    expect(aapl.quantity).toBe(20);
    expect(aapl.averagePrice).toBe(125); // (1000 + 1500) / 20
    expect(aapl.totalInvested).toBe(2500);
  });

  it('keeps average price unchanged on SELL (réduction de l\'exposition sans modification du PRU)', () => {
    const positions = calculatePositionsAtDate(
      [
        tx({ type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01' }),
        tx({ type: 'SELL', stock_symbol: 'AAPL', quantity: 4, price_per_unit: 200, date: '2025-02-01' }),
      ],
      '2025-03-01'
    );
    const aapl = positions.get('AAPL')!;
    expect(aapl.quantity).toBe(6);
    expect(aapl.averagePrice).toBe(100);
    expect(aapl.totalInvested).toBe(600);
  });

  it('deletes a position when fully sold', () => {
    const positions = calculatePositionsAtDate(
      [
        tx({ type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01' }),
        tx({ type: 'SELL', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 200, date: '2025-02-01' }),
      ],
      '2025-03-01'
    );
    expect(positions.has('AAPL')).toBe(false);
  });

  it('ignores transactions after asOfDate', () => {
    const positions = calculatePositionsAtDate(
      [
        tx({ type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01' }),
        tx({ type: 'SELL', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 200, date: '2025-06-01' }),
      ],
      '2025-03-01'
    );
    const aapl = positions.get('AAPL')!;
    expect(aapl.quantity).toBe(10); // SELL de juin ignoré
  });

  it('filters by accountId when provided', () => {
    const positions = calculatePositionsAtDate(
      [
        tx({ account_id: 'a1', type: 'BUY', stock_symbol: 'AAPL', quantity: 5, price_per_unit: 100, date: '2025-01-01' }),
        tx({ account_id: 'a2', type: 'BUY', stock_symbol: 'AAPL', quantity: 3, price_per_unit: 100, date: '2025-01-01' }),
      ],
      '2025-03-01',
      'a1'
    );
    expect(positions.get('AAPL')!.quantity).toBe(5);
  });

  it('uppercases symbols for uniform keying', () => {
    const positions = calculatePositionsAtDate(
      [tx({ type: 'BUY', stock_symbol: 'aapl', quantity: 1, price_per_unit: 10, date: '2025-01-01' })],
      '2025-01-02'
    );
    expect(positions.has('AAPL')).toBe(true);
  });
});

describe('calculateAllPositionsAtDate (keyed by account:symbol)', () => {
  it('keeps positions on the same symbol separate per account', () => {
    const result = calculateAllPositionsAtDate(
      [
        tx({ account_id: 'a1', type: 'BUY', stock_symbol: 'AAPL', quantity: 5, price_per_unit: 100, date: '2025-01-01' }),
        tx({ account_id: 'a2', type: 'BUY', stock_symbol: 'AAPL', quantity: 3, price_per_unit: 200, date: '2025-01-01' }),
      ],
      '2025-06-01'
    );
    expect(result.get('a1:AAPL')!.quantity).toBe(5);
    expect(result.get('a2:AAPL')!.quantity).toBe(3);
  });
});

describe('aggregatePositionsBySymbol', () => {
  it('merges positions across accounts with weighted average price', () => {
    const byAccount = calculateAllPositionsAtDate(
      [
        tx({ account_id: 'a1', type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01' }),
        tx({ account_id: 'a2', type: 'BUY', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 200, date: '2025-01-01' }),
      ],
      '2025-06-01'
    );
    const agg = aggregatePositionsBySymbol(byAccount);
    const aapl = agg.get('AAPL')!;
    expect(aapl.quantity).toBe(20);
    expect(aapl.averagePrice).toBe(150); // (1000 + 2000) / 20
    expect(aapl.totalInvested).toBe(3000);
  });
});

describe('cash calculations', () => {
  it('adds DEPOSIT, DIVIDEND, INTEREST, SELL; subtracts WITHDRAWAL, BUY, FEE', () => {
    const txs = [
      tx({ type: 'DEPOSIT', amount: 1000, date: '2025-01-01' }),
      tx({ type: 'DIVIDEND', amount: 50, date: '2025-02-01' }),
      tx({ type: 'INTEREST', amount: 10, date: '2025-02-15' }),
      tx({ type: 'BUY', amount: 500, date: '2025-03-01' }),
      tx({ type: 'FEE', amount: 5, date: '2025-03-01' }),
      tx({ type: 'SELL', amount: 300, date: '2025-04-01' }),
      tx({ type: 'WITHDRAWAL', amount: 100, date: '2025-05-01' }),
    ];
    expect(calculateAccountCashFromTransactions(txs, 'acc-1')).toBe(1000 + 50 + 10 - 500 - 5 + 300 - 100);
  });

  it('calculateAccountCashAtDate ignores future transactions', () => {
    const txs = [
      tx({ type: 'DEPOSIT', amount: 1000, date: '2025-01-01' }),
      tx({ type: 'WITHDRAWAL', amount: 200, date: '2025-06-01' }),
    ];
    expect(calculateAccountCashAtDate(txs, 'acc-1', '2025-03-01')).toBe(1000);
    expect(calculateAccountCashAtDate(txs, 'acc-1', '2025-12-31')).toBe(800);
  });

  it('filters cash by account_id', () => {
    const txs = [
      tx({ account_id: 'a1', type: 'DEPOSIT', amount: 1000, date: '2025-01-01' }),
      tx({ account_id: 'a2', type: 'DEPOSIT', amount: 500, date: '2025-01-01' }),
    ];
    expect(calculateAccountCashFromTransactions(txs, 'a1')).toBe(1000);
    expect(calculateAccountCashFromTransactions(txs, 'a2')).toBe(500);
  });
});

describe('calculateAccountTotalValue', () => {
  it('combines cash and stocks at current quotes', () => {
    const txs = [
      tx({ type: 'DEPOSIT', amount: 10000, date: '2025-01-01' }),
      tx({ type: 'BUY', amount: 5000, stock_symbol: 'AAPL', quantity: 50, price_per_unit: 100, date: '2025-02-01' }),
    ];
    const positions = [{ symbol: 'AAPL', quantity: 50, average_price: 100 }];
    const quotes = { AAPL: { price: 120 } };
    const v = calculateAccountTotalValue(txs, 'acc-1', positions, quotes);
    expect(v.cash).toBe(5000); // 10000 - 5000
    expect(v.stocksValue).toBe(6000); // 50 * 120
    expect(v.totalValue).toBe(11000);
  });

  it('falls back to average price when quote is missing', () => {
    const positions = [{ symbol: 'X', quantity: 10, average_price: 42 }];
    const v = calculateAccountTotalValue([], 'acc-1', positions, {});
    expect(v.stocksValue).toBe(420);
  });
});

describe('calculatePortfolioHistory', () => {
  it('returns a full-cash-savings-only history for non-stock accounts', () => {
    const txs = [
      tx({ account_id: 'livret', type: 'DEPOSIT', amount: 1000, date: '2025-01-01' }),
      tx({ account_id: 'livret', type: 'INTEREST', amount: 5, date: '2025-01-05' }),
    ];
    const accounts = [acc({ id: 'livret', type: 'LIVRET_A' })];
    const history = calculatePortfolioHistory(txs, accounts, {}, '2025-01-01', '2025-01-05', 'daily');
    expect(history.length).toBe(5);
    expect(history[0].savingsValue).toBe(1000);
    expect(history[4].savingsValue).toBe(1005);
    expect(history[0].totalValue).toBe(1000);
    expect(history[4].totalValue).toBe(1005);
  });

  it('uses historical quotes when available', () => {
    const txs = [
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 10000, date: '2025-01-01' }),
      tx({
        account_id: 'cto', type: 'BUY', amount: 1000,
        stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100, date: '2025-01-01',
      }),
    ];
    const accounts = [acc({ id: 'cto', type: 'CTO' })];
    const historical: Record<string, HistoricalQuote[]> = {
      AAPL: [
        { date: '2025-01-01', open: 100, high: 100, low: 100, close: 100, volume: 0, adjustedClose: 100 },
        { date: '2025-01-02', open: 110, high: 110, low: 110, close: 110, volume: 0, adjustedClose: 110 },
      ],
    };
    const history = calculatePortfolioHistory(txs, accounts, historical, '2025-01-01', '2025-01-02', 'daily');
    // Le cash vaut 10000 - 1000 = 9000 les deux jours
    // Jour 1 : stocks = 10 * 100 = 1000. Total = 10000
    // Jour 2 : stocks = 10 * 110 = 1100. Total = 10100
    expect(history[0].totalValue).toBe(10000);
    expect(history[1].totalValue).toBe(10100);
  });
});

describe('calculatePortfolioPerformance (Modified Dietz)', () => {
  it('returns zeroed result for empty history', () => {
    const p = calculatePortfolioPerformance([], [], []);
    expect(p.currentValue).toBe(0);
    expect(p.absoluteGain).toBe(0);
    expect(p.yearlyPerformance).toEqual([]);
  });

  it('computes absolute gain when portfolio appreciates without flows', () => {
    const accounts = [acc({ id: 'cto', type: 'CTO' })];
    const txs = [
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 10000, date: '2025-01-01' }),
    ];
    // Simuler un historique manuel : valeur passe de 10000 à 11000
    const history = [
      { date: '2025-01-01', totalValue: 10000, stocksValue: 10000, savingsValue: 0, positions: [] },
      { date: '2025-12-31', totalValue: 11000, stocksValue: 11000, savingsValue: 0, positions: [] },
    ];
    const p = calculatePortfolioPerformance(txs, history, accounts);
    expect(p.currentValue).toBe(11000);
    expect(p.totalDeposits).toBe(10000);
    expect(p.absoluteGain).toBe(1000);
    expect(p.absoluteGainPercent).toBeCloseTo(10, 5);
  });

  it('requires history scoped to the selected account for account-level performance', () => {
    const accounts = [
      acc({ id: 'pea', type: 'PEA', name: 'PEA' }),
      acc({ id: 'cto', type: 'CTO', name: 'CTO' }),
    ];
    const peaTransactions = [
      tx({ account_id: 'pea', type: 'DEPOSIT', amount: 1000, date: '2025-01-01' }),
    ];
    const allTransactions = [
      ...peaTransactions,
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 2000, date: '2025-01-01' }),
    ];
    const peaHistory = [
      { date: '2025-01-01', totalValue: 1000, stocksValue: 1000, savingsValue: 0, positions: [] },
      { date: '2025-12-31', totalValue: 1100, stocksValue: 1100, savingsValue: 0, positions: [] },
    ];
    const globalHistory = [
      { date: '2025-01-01', totalValue: 3000, stocksValue: 3000, savingsValue: 0, positions: [] },
      { date: '2025-12-31', totalValue: 3100, stocksValue: 3100, savingsValue: 0, positions: [] },
    ];

    const scoped = calculatePortfolioPerformance(peaTransactions, peaHistory, [accounts[0]]);
    const misScoped = calculatePortfolioPerformance(peaTransactions, globalHistory, [accounts[0]]);

    expect(scoped.yearlyPerformance[0].gainLossPercent).toBeCloseTo(10, 5);
    expect(misScoped.yearlyPerformance[0].gainLossPercent).not.toBeCloseTo(
      scoped.yearlyPerformance[0].gainLossPercent,
      5
    );
    expect(allTransactions).toHaveLength(2);
  });

  it('matches annual YTD performance with the shared Modified Dietz period calculation', () => {
    const accounts = [acc({ id: 'cto', type: 'CTO' })];
    const txs = [
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 1000, date: '2024-01-01' }),
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 500, date: '2025-07-01' }),
    ];
    const history = [
      { date: '2024-12-31', totalValue: 1000, stocksValue: 1000, savingsValue: 0, positions: [] },
      { date: '2025-01-01', totalValue: 1000, stocksValue: 1000, savingsValue: 0, positions: [] },
      { date: '2025-07-01', totalValue: 1650, stocksValue: 1650, savingsValue: 0, positions: [] },
      { date: '2025-12-31', totalValue: 1800, stocksValue: 1800, savingsValue: 0, positions: [] },
    ];

    const annual = calculatePortfolioPerformance(txs, history, accounts)
      .yearlyPerformance
      .find((p) => p.year === 2025)!;
    const ytd = calculateModifiedDietzPerformance(history, txs, '2025-01-01', '2025-12-31');

    expect(ytd.gainLossPercent).toBeCloseTo(annual.gainLossPercent, 5);
    expect(ytd.gainLoss).toBeCloseTo(annual.gainLoss, 5);
  });

  it('aggregates dividends in totalDividends but does not double-count in gain', () => {
    const accounts = [acc({ id: 'cto', type: 'CTO' })];
    const txs = [
      tx({ account_id: 'cto', type: 'DEPOSIT', amount: 10000, date: '2025-01-01' }),
      tx({ account_id: 'cto', type: 'DIVIDEND', amount: 200, date: '2025-06-01' }),
    ];
    const history = [
      { date: '2025-01-01', totalValue: 10000, stocksValue: 10000, savingsValue: 0, positions: [] },
      { date: '2025-12-31', totalValue: 10200, stocksValue: 10200, savingsValue: 0, positions: [] },
    ];
    const p = calculatePortfolioPerformance(txs, history, accounts);
    expect(p.totalDividends).toBe(200);
    expect(p.absoluteGain).toBe(200); // 10200 - 10000 (dépôts), dividendes déjà dans endValue
  });
});

describe('helpers', () => {
  it('getFirstTransactionDate returns the earliest date', () => {
    const date = getFirstTransactionDate([
      tx({ date: '2025-03-01' }),
      tx({ date: '2025-01-15' }),
      tx({ date: '2025-02-20' }),
    ]);
    expect(date).toBe('2025-01-15');
  });

  it('getFirstTransactionDate returns null on empty', () => {
    expect(getFirstTransactionDate([])).toBeNull();
  });

  it('getUniqueSymbolsFromTransactions deduplicates case-insensitive', () => {
    const symbols = getUniqueSymbolsFromTransactions([
      tx({ stock_symbol: 'aapl' }),
      tx({ stock_symbol: 'AAPL' }),
      tx({ stock_symbol: 'MSFT' }),
      tx({ stock_symbol: undefined }),
    ]);
    expect(new Set(symbols)).toEqual(new Set(['AAPL', 'MSFT']));
  });
});
