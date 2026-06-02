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
      expect(result.reason).toContain('Solde EUR insuffisant au 01/01/2026');
    }
  });

  it('formats pending withdrawal failures without leaking implementation ids', () => {
    const result = simulateAccountSequence([
      tx({
        id: '__pending_tx__',
        type: 'WITHDRAWAL',
        amount: 11111111111111111,
        currency: 'EUR',
        date: '2026-05-07',
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Solde EUR insuffisant au 07/05/2026');
      expect(result.reason).toContain('retrait');
      expect(result.reason).not.toContain('__pending');
      expect(result.reason).not.toContain('WITHDRAWAL');
    }
  });

  it('formats share failures without raw negative balances', () => {
    const result = simulateAccountSequence([
      tx({
        id: '__pending_tx__',
        type: 'SELL',
        amount: 100,
        stock_symbol: 'AAPL',
        quantity: 2,
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('Position AAPL (EUR) insuffisante');
      expect(result.reason).toContain('vente de 2,0000 titres');
      expect(result.reason).not.toContain('__pending');
      expect(result.reason).not.toContain('descendrait');
    }
  });

  it('rejects a sell in USD when only an EUR position exists for the same symbol', () => {
    const result = simulateAccountSequence([
      tx({ id: 'deposit-eur', type: 'DEPOSIT', amount: 1000, currency: 'EUR', date: '2026-01-01' }),
      tx({
        id: 'buy-eur',
        type: 'BUY',
        amount: 1000,
        currency: 'EUR',
        stock_symbol: 'AAPL',
        quantity: 10,
        price_per_unit: 100,
        date: '2026-01-02',
      }),
      tx({ id: 'deposit-usd', type: 'DEPOSIT', amount: 600, currency: 'USD', date: '2026-01-03' }),
      tx({
        id: 'sell-usd',
        type: 'SELL',
        amount: 120,
        currency: 'USD',
        stock_symbol: 'AAPL',
        quantity: 1,
        price_per_unit: 120,
        date: '2026-01-04',
      }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('shares_negative');
      expect(result.reason).toContain('Position AAPL (USD) insuffisante');
    }
  });

  it('accepts a sell in EUR when the EUR position exists for the same symbol', () => {
    const result = simulateAccountSequence([
      tx({ id: 'deposit-eur', type: 'DEPOSIT', amount: 1000, currency: 'EUR', date: '2026-01-01' }),
      tx({
        id: 'buy-eur',
        type: 'BUY',
        amount: 1000,
        currency: 'EUR',
        stock_symbol: 'AAPL',
        quantity: 10,
        price_per_unit: 100,
        date: '2026-01-02',
      }),
      tx({
        id: 'sell-eur',
        type: 'SELL',
        amount: 500,
        currency: 'EUR',
        stock_symbol: 'AAPL',
        quantity: 5,
        price_per_unit: 100,
        date: '2026-01-03',
      }),
    ]);

    expect(result).toEqual({ ok: true });
  });
});
