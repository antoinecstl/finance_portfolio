import { describe, it, expect } from 'vitest';
import type { Account, StockQuote, Transaction } from '@/lib/types';
import { buildPublicPortfolio, openPositionSymbols } from './portfolio';

let _id = 0;
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? `tx-${++_id}`,
    account_id: partial.account_id ?? 'cto',
    type: partial.type ?? 'BUY',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    description: '',
    date: partial.date ?? '2026-01-02',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: null,
    target_currency: null,
    created_at: '2026-01-01T00:00:00Z',
    fee_transaction_id: null,
  };
}

function account(id: string, type: Account['type'], name = id): Account {
  return { id, name, type, currency: 'EUR', created_at: '2026-01-01', updated_at: '2026-01-01' };
}

function quote(symbol: string, price: number, previousClose: number, currency = 'EUR'): StockQuote {
  return {
    symbol, name: `${symbol} Inc`, price, previousClose, currency,
    change: price - previousClose, changePercent: 0, open: price, high: price, low: price, volume: 0,
  };
}

const accounts = [account('cto', 'CTO', 'Mon CTO'), account('livret', 'LIVRET_A', 'Livret A')];
const transactions = [
  tx({ type: 'DEPOSIT', amount: 2000 }),
  tx({ type: 'BUY', amount: 1000, stock_symbol: 'AAPL', quantity: 10, price_per_unit: 100 }),
  tx({ account_id: 'livret', type: 'DEPOSIT', amount: 500 }),
];

describe('buildPublicPortfolio', () => {
  it('values accounts, positions and totals', () => {
    const portfolio = buildPublicPortfolio({
      accounts,
      transactions,
      quotes: { AAPL: quote('AAPL', 120, 110) },
      today: '2026-09-30',
      asOf: '2026-09-30T10:00:00Z',
    });

    expect(portfolio.totals).toMatchObject({
      total_value: 2700,
      positions_value: 1200,
      investment_cash: 1000,
      savings_value: 500,
      cost_basis: 1000,
      unrealized_gain: 200,
      unrealized_gain_percent: 20,
      day_change: 100,
    });
    expect(portfolio.accounts.map((a) => [a.name, a.value, a.weight_percent])).toEqual([
      ['Mon CTO', 2200, 81.48],
      ['Livret A', 500, 18.52],
    ]);
    expect(portfolio.positions[0]).toMatchObject({
      account_name: 'Mon CTO',
      symbol: 'AAPL',
      name: 'AAPL Inc',
      quantity: 10,
      price: 120,
      price_is_live: true,
      value: 1200,
      weight_percent: 100,
    });
  });

  it('falls back to the average price without a quote', () => {
    const portfolio = buildPublicPortfolio({ accounts, transactions, quotes: {}, today: '2026-09-30' });
    expect(portfolio.positions[0]).toMatchObject({ price: null, price_is_live: false, value: 1000 });
    expect(portfolio.totals.unrealized_gain).toBe(0);
  });

  it('converts foreign quotes to EUR', () => {
    const portfolio = buildPublicPortfolio({
      accounts,
      transactions,
      quotes: { AAPL: quote('AAPL', 220, 220, 'USD') },
      fxRates: { USD: [{ date: '2026-09-29', open: 2, high: 2, low: 2, close: 2, volume: 0, adjustedClose: 2 }] },
      today: '2026-09-30',
    });
    expect(portfolio.positions[0].value).toBe(1100);
  });
});

describe('openPositionSymbols', () => {
  it('lists open positions of investment accounts only', () => {
    expect(openPositionSymbols(accounts, transactions, '2026-09-30')).toEqual(['AAPL']);
    expect(
      openPositionSymbols(accounts, [...transactions, tx({ type: 'SELL', stock_symbol: 'AAPL', quantity: 10, price_per_unit: 130, amount: 1300, date: '2026-03-01' })], '2026-09-30')
    ).toEqual([]);
  });
});
