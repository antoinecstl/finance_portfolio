import { describe, expect, it } from 'vitest';
import type { Transaction } from './types';
import { findDuplicateTransaction } from './transaction-duplicates';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? 'tx-1',
    account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'DEPOSIT',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    fee_transaction_id: partial.fee_transaction_id ?? null,
    description: partial.description ?? '',
    date: partial.date ?? '2025-01-01',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: partial.target_amount ?? null,
    target_currency: partial.target_currency ?? null,
    created_at: partial.created_at ?? '2025-01-01T00:00:00Z',
  };
}

describe('findDuplicateTransaction', () => {
  it('does not match same amount/date/type in another source currency', () => {
    const existing = [
      tx({ id: 'usd-deposit', type: 'DEPOSIT', amount: 100, currency: 'USD' }),
    ];

    const duplicate = findDuplicateTransaction(
      { type: 'DEPOSIT', date: '2025-01-01', amount: 100, currency: 'EUR' },
      existing,
      { accountId: 'acc-1' }
    );

    expect(duplicate).toBeNull();
  });

  it('matches same amount/date/type with the same source currency', () => {
    const existing = [
      tx({ id: 'eur-deposit', type: 'DEPOSIT', amount: 100, currency: 'EUR' }),
    ];

    const duplicate = findDuplicateTransaction(
      { type: 'DEPOSIT', date: '2025-01-01', amount: 100, currency: 'EUR' },
      existing,
      { accountId: 'acc-1' }
    );

    expect(duplicate?.id).toBe('eur-deposit');
  });

  it('requires conversion target amount and currency to match', () => {
    const existing = [
      tx({
        id: 'conversion',
        type: 'CONVERSION',
        amount: 100,
        currency: 'EUR',
        target_amount: 110,
        target_currency: 'USD',
      }),
    ];

    const differentTargetCurrency = findDuplicateTransaction(
      {
        type: 'CONVERSION',
        date: '2025-01-01',
        amount: 100,
        currency: 'EUR',
        target_amount: 110,
        target_currency: 'USDC',
      },
      existing,
      { accountId: 'acc-1' }
    );
    const differentTargetAmount = findDuplicateTransaction(
      {
        type: 'CONVERSION',
        date: '2025-01-01',
        amount: 100,
        currency: 'EUR',
        target_amount: 111,
        target_currency: 'USD',
      },
      existing,
      { accountId: 'acc-1' }
    );

    expect(differentTargetCurrency).toBeNull();
    expect(differentTargetAmount).toBeNull();
  });
});
