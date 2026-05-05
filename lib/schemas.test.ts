import { describe, expect, it } from 'vitest';
import { createTransactionSchema } from './schemas';

const base = {
  account_id: '00000000-0000-4000-8000-000000000001',
  amount: 100,
  date: '2025-01-01',
};

describe('createTransactionSchema conversion fields', () => {
  it('does not inject target_currency on regular transactions', () => {
    const parsed = createTransactionSchema.safeParse({
      ...base,
      type: 'DEPOSIT',
      currency: 'EUR',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.target_currency).toBeUndefined();
    }
  });

  it('accepts a valid currency conversion', () => {
    const parsed = createTransactionSchema.safeParse({
      ...base,
      type: 'CONVERSION',
      currency: 'EUR',
      target_amount: 108,
      target_currency: 'USDC',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects a conversion without target currency data', () => {
    const parsed = createTransactionSchema.safeParse({
      ...base,
      type: 'CONVERSION',
      currency: 'EUR',
    });

    expect(parsed.success).toBe(false);
  });
});
