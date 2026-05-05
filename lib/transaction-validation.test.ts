import { describe, expect, it } from 'vitest';
import { simulateAccountSequence } from './transaction-validation';
import type { Transaction } from './types';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'tx',
    account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'DEPOSIT',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    description: partial.description ?? '',
    date: partial.date ?? '2026-01-01',
    created_at: partial.created_at ?? '2026-01-01T00:00:00Z',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: partial.target_amount ?? null,
    target_currency: partial.target_currency ?? null,
    fee_transaction_id: partial.fee_transaction_id ?? null,
  };
}

describe('simulateAccountSequence', () => {
  it('allows a same-day conversion added after the buy it funds', () => {
    const result = simulateAccountSequence([
      tx({
        id: 'deposit',
        type: 'DEPOSIT',
        amount: 1000,
        currency: 'EUR',
        created_at: '2026-01-01T08:00:00Z',
      }),
      tx({
        id: 'buy',
        type: 'BUY',
        amount: 500,
        currency: 'USDC',
        stock_symbol: 'SOL-USD',
        quantity: 10,
        price_per_unit: 50,
        created_at: '2026-01-01T09:00:00Z',
      }),
      tx({
        id: 'conversion-added-later',
        type: 'CONVERSION',
        amount: 500,
        currency: 'EUR',
        target_amount: 540,
        target_currency: 'USDC',
        created_at: '2026-01-01T12:00:00Z',
      }),
    ]);

    expect(result).toEqual({ ok: true });
  });

  it('still rejects a conversion when the source currency is not funded', () => {
    const result = simulateAccountSequence([
      tx({
        id: 'conversion',
        type: 'CONVERSION',
        amount: 500,
        currency: 'EUR',
        target_amount: 540,
        target_currency: 'USDC',
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('cash_negative');
    }
  });
});
