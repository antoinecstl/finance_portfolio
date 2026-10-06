import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_ACCOUNT_TYPES,
  buildFirstTransactions,
  defaultAccountName,
  resolveOnboardingStep,
} from './onboarding';
import { createTransactionSchema } from './schemas';
import { simulateAccountSequence } from './transaction-validation';
import type { Transaction } from './types';

const ACCOUNT_ID = '10000000-0000-4000-8000-000000000001';
const pea = { id: ACCOUNT_ID, type: 'PEA' as const, currency: 'EUR', supports_positions: null };
const livret = { ...pea, type: 'LIVRET_A' as const };
const crypto = { ...pea, type: 'CRYPTO' as const };

describe('resolveOnboardingStep', () => {
  it('resumes where the user stopped', () => {
    expect(resolveOnboardingStep({ profileSaved: false, accountCount: 0, transactionCount: 0 })).toBe('profile');
    expect(resolveOnboardingStep({ profileSaved: true, accountCount: 0, transactionCount: 0 })).toBe('account');
    expect(resolveOnboardingStep({ profileSaved: true, accountCount: 1, transactionCount: 0 })).toBe('transaction');
    expect(resolveOnboardingStep({ profileSaved: true, accountCount: 2, transactionCount: 3 })).toBe('import');
  });
});

describe('defaultAccountName', () => {
  it('suggests a name for every proposed account type', () => {
    for (const option of ONBOARDING_ACCOUNT_TYPES) {
      expect(defaultAccountName(option.type)).toBe(option.defaultName);
    }
    expect(defaultAccountName('PEA')).toBe('Mon PEA');
  });
});

describe('buildFirstTransactions', () => {
  it('builds a single deposit in the account currency', () => {
    const result = buildFirstTransactions(livret, { kind: 'deposit', amount: 1500.004, date: '2026-10-06' });
    expect(result).toEqual({
      ok: true,
      payloads: [{
        account_id: ACCOUNT_ID, type: 'DEPOSIT', amount: 1500, fees: 0,
        description: 'Versement initial', date: '2026-10-06', currency: 'EUR',
      }],
    });
  });

  it('funds a first purchase with a deposit of the same amount on the same day', () => {
    const result = buildFirstTransactions(pea, { kind: 'buy', symbol: 'cw8.pa', quantity: 3, price: 512.37, date: '2026-10-01' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [deposit, buy] = result.payloads;
    expect(deposit).toMatchObject({ type: 'DEPOSIT', amount: 1537.11, currency: 'EUR', date: '2026-10-01' });
    expect(buy).toMatchObject({ type: 'BUY', amount: 1537.11, stock_symbol: 'CW8.PA', quantity: 3, price_per_unit: 512.37 });
  });

  it('produces payloads the API accepts and a valid account sequence', () => {
    const result = buildFirstTransactions(pea, { kind: 'buy', symbol: 'SU.PA', quantity: 7, price: 241.9, date: '2026-10-01' });
    if (!result.ok) throw new Error(result.error);
    for (const payload of result.payloads) {
      expect(createTransactionSchema.safeParse(payload).success).toBe(true);
    }
    const txs: Transaction[] = result.payloads.map((p, i) => ({
      ...p, id: String(i), created_at: '2026-10-01T10:00:00Z', time: null,
    }));
    expect(simulateAccountSequence(txs).ok).toBe(true);
  });

  it('keeps the quote currency for a security listed in another currency', () => {
    const result = buildFirstTransactions(
      { ...pea, type: 'CTO' },
      { kind: 'buy', symbol: 'AAPL', quantity: 2, price: 230, date: '2026-10-01', currency: 'usd' }
    );
    expect(result.ok && result.payloads.map((p) => p.currency)).toEqual(['USD', 'USD']);
  });

  it('rejects invalid input with a French message', () => {
    expect(buildFirstTransactions(livret, { kind: 'deposit', amount: 0, date: '2026-10-06' }))
      .toEqual({ ok: false, error: 'Le montant doit être supérieur à 0.' });
    expect(buildFirstTransactions(livret, { kind: 'deposit', amount: 10, date: '06/10/2026' }))
      .toEqual({ ok: false, error: 'Indiquez une date valide.' });
    expect(buildFirstTransactions(livret, { kind: 'buy', symbol: 'CW8.PA', quantity: 1, price: 500, date: '2026-10-06' }).ok)
      .toBe(false);
    expect(buildFirstTransactions(pea, { kind: 'buy', symbol: 'BTC-USD', quantity: 1, price: 500, date: '2026-10-06' }).ok)
      .toBe(false);
    expect(buildFirstTransactions(crypto, { kind: 'buy', symbol: 'BTC-USD', quantity: 0.01, price: 60000, date: '2026-10-06' }).ok)
      .toBe(true);
    expect(buildFirstTransactions(pea, { kind: 'buy', symbol: '', quantity: 1, price: 500, date: '2026-10-06' }))
      .toEqual({ ok: false, error: 'Choisissez un titre dans la liste.' });
  });
});
