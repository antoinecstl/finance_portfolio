import { describe, expect, it } from 'vitest';
import { buildImportCashPreview } from './cash-preview';
import type { ProposedTransaction } from './types';
import type { Transaction } from '@/lib/types';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'DEPOSIT',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    description: partial.description ?? '',
    date: partial.date ?? '2026-01-01',
    created_at: partial.created_at ?? '2026-01-01T00:00:00.000Z',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: partial.target_amount ?? null,
    target_currency: partial.target_currency ?? null,
  };
}

function row(partial: Partial<ProposedTransaction>): ProposedTransaction {
  return {
    type: partial.type ?? 'DEPOSIT',
    amount: partial.amount ?? 0,
    fees: partial.fees ?? 0,
    description: partial.description ?? '',
    date: partial.date ?? '2026-01-01',
    stock_symbol: partial.stock_symbol ?? null,
    quantity: partial.quantity ?? null,
    price_per_unit: partial.price_per_unit ?? null,
    currency: partial.currency ?? null,
    target_amount: partial.target_amount ?? null,
    target_currency: partial.target_currency ?? null,
  };
}

describe('buildImportCashPreview', () => {
  it('shows projected cash by currency after a funded crypto import', () => {
    const preview = buildImportCashPreview(
      [tx({ amount: 1000, currency: 'EUR' })],
      [
        row({
          type: 'CONVERSION',
          amount: 1000,
          currency: 'EUR',
          target_amount: 1100,
          target_currency: 'USDC',
          date: '2026-02-01',
        }),
        row({
          type: 'BUY',
          amount: 400,
          currency: 'USDC',
          stock_symbol: 'SOL-USD',
          quantity: 4,
          price_per_unit: 100,
          date: '2026-02-01',
        }),
      ],
      'acc-1',
      'EUR'
    );

    expect(preview.firstIssue).toBeNull();
    expect(preview.buckets.find((bucket) => bucket.currency === 'USDC')?.after).toBe(700);
  });

  it('reports the first chronological cash shortage even when the final balance is positive', () => {
    const preview = buildImportCashPreview(
      [],
      [
        row({
          type: 'BUY',
          amount: 400,
          currency: 'USDC',
          stock_symbol: 'SOL-USD',
          quantity: 4,
          price_per_unit: 100,
          date: '2026-02-01',
        }),
        row({
          type: 'DEPOSIT',
          amount: 1000,
          currency: 'USDC',
          date: '2026-02-02',
        }),
      ],
      'acc-1',
      'EUR'
    );

    expect(preview.buckets.find((bucket) => bucket.currency === 'USDC')?.after).toBe(600);
    expect(preview.firstIssue).toMatchObject({
      currency: 'USDC',
      date: '2026-02-01',
      rowIndex: 0,
    });
  });

  it('includes imported fees in the projected cash change', () => {
    const preview = buildImportCashPreview(
      [tx({ amount: 101, currency: 'USDC' })],
      [
        row({
          type: 'BUY',
          amount: 100,
          fees: 1,
          currency: 'USDC',
          stock_symbol: 'BTC-USD',
          quantity: 0.001,
          price_per_unit: 100000,
        }),
      ],
      'acc-1',
      'USDC'
    );

    expect(preview.firstIssue).toBeNull();
    expect(preview.buckets.find((bucket) => bucket.currency === 'USDC')?.after).toBe(0);
  });
});
