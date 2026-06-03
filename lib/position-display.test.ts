import { describe, expect, it } from 'vitest';
import type { StockPosition, StockQuote, Transaction } from './types';
import {
  buildPositionDisplayGroups,
  positionDisplayKey,
  transactionMatchesPositionDisplayGroup,
} from './position-display';

function position(partial: Partial<StockPosition>): StockPosition {
  return {
    id: partial.id ?? `${partial.account_id ?? 'acc-1'}-${partial.symbol ?? 'AAPL'}`,
    account_id: partial.account_id ?? 'acc-1',
    symbol: partial.symbol ?? 'AAPL',
    name: partial.name ?? partial.symbol ?? 'AAPL',
    quantity: partial.quantity ?? 1,
    average_price: partial.average_price ?? 100,
    currency: partial.currency ?? 'EUR',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

function quote(partial: Partial<StockQuote>): StockQuote {
  return {
    symbol: partial.symbol ?? 'AAPL',
    name: partial.name ?? partial.symbol ?? 'AAPL',
    price: partial.price ?? 100,
    change: partial.change ?? 0,
    changePercent: partial.changePercent ?? 0,
    previousClose: partial.previousClose ?? partial.price ?? 100,
    open: partial.open ?? partial.price ?? 100,
    high: partial.high ?? partial.price ?? 100,
    low: partial.low ?? partial.price ?? 100,
    volume: partial.volume ?? 0,
    currency: partial.currency ?? 'EUR',
  };
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'tx-1',
    account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'BUY',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    description: partial.description ?? '',
    date: partial.date ?? '2026-01-01',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: partial.target_amount ?? null,
    target_currency: partial.target_currency ?? null,
    created_at: partial.created_at ?? '2026-01-01T00:00:00Z',
    fee_transaction_id: partial.fee_transaction_id ?? null,
  };
}

describe('buildPositionDisplayGroups', () => {
  it('consolidates crypto positions by account and base pair', () => {
    const groups = buildPositionDisplayGroups(
      [
        position({ symbol: 'BTC-USD', quantity: 0.1, average_price: 50000, currency: 'USD' }),
        position({ symbol: 'BTC-EUR', quantity: 0.2, average_price: 45000, currency: 'EUR' }),
      ],
      {
        'BTC-USD': quote({ symbol: 'BTC-USD', price: 60000, change: 1000, currency: 'USD' }),
        'BTC-EUR': quote({ symbol: 'BTC-EUR', price: 55000, change: 500, currency: 'EUR' }),
      },
      {},
      '2026-01-10'
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].symbol).toBe('BTC');
    expect(groups[0].key).toBe('acc-1:crypto:BTC');
    expect(groups[0].quantity).toBeCloseTo(0.3);
    expect(groups[0].investedValue).toBeCloseTo(14000);
    expect(groups[0].currentValue).toBeCloseTo(17000);
    expect(groups[0].avgPrice).toBeCloseTo(14000 / 0.3);
    expect(groups[0].currentPrice).toBeCloseTo(17000 / 0.3);
    expect(groups[0].costCurrency).toBe('EUR');
    expect(groups[0].quoteCurrency).toBe('EUR');
    expect(groups[0].sourceSymbols).toEqual(['BTC-EUR', 'BTC-USD']);
    expect(groups[0].sourceCurrencies).toEqual(['EUR', 'USD']);
  });

  it('keeps non-crypto positions separated by transaction currency', () => {
    const groups = buildPositionDisplayGroups(
      [
        position({ symbol: 'AAPL', currency: 'EUR', quantity: 1 }),
        position({ symbol: 'AAPL', currency: 'USD', quantity: 2 }),
      ],
      {},
      {},
      '2026-01-10'
    );

    expect(groups.map((group) => group.key).sort()).toEqual([
      'acc-1:AAPL:EUR',
      'acc-1:AAPL:USD',
    ]);
  });
});

describe('positionDisplayKey', () => {
  it('keys crypto by account and base pair', () => {
    expect(positionDisplayKey(position({ symbol: 'BTC-USD', currency: 'USD' }))).toBe('acc-1:crypto:BTC');
    expect(positionDisplayKey(position({ symbol: 'BTC-EUR', currency: 'EUR' }))).toBe('acc-1:crypto:BTC');
  });
});

describe('transactionMatchesPositionDisplayGroup', () => {
  it('matches any quote/currency for the same crypto base in the same account', () => {
    const [group] = buildPositionDisplayGroups(
      [position({ symbol: 'BTC-USD', currency: 'USD' })],
      {},
      {},
      '2026-01-10'
    );

    expect(transactionMatchesPositionDisplayGroup(tx({ stock_symbol: 'BTC-EUR', currency: 'EUR' }), group)).toBe(true);
    expect(transactionMatchesPositionDisplayGroup(tx({ stock_symbol: 'BTC-USD', currency: 'USD' }), group)).toBe(true);
    expect(transactionMatchesPositionDisplayGroup(tx({ stock_symbol: 'ETH-USD', currency: 'USD' }), group)).toBe(false);
    expect(transactionMatchesPositionDisplayGroup(tx({ account_id: 'acc-2', stock_symbol: 'BTC-USD', currency: 'USD' }), group)).toBe(false);
  });

  it('requires exact currency for non-crypto display groups', () => {
    const [group] = buildPositionDisplayGroups(
      [position({ symbol: 'AAPL', currency: 'USD' })],
      {},
      {},
      '2026-01-10'
    );

    expect(transactionMatchesPositionDisplayGroup(tx({ stock_symbol: 'AAPL', currency: 'USD' }), group)).toBe(true);
    expect(transactionMatchesPositionDisplayGroup(tx({ stock_symbol: 'AAPL', currency: 'EUR' }), group)).toBe(false);
  });
});
