import { describe, expect, it } from 'vitest';
import { formatInvalidAccountSequenceMessage } from './sequence-errors';

describe('formatInvalidAccountSequenceMessage', () => {
  it('formats currency-specific cash sequence errors', () => {
    expect(
      formatInvalidAccountSequenceMessage(
        'INVALID_ACCOUNT_SEQUENCE: cash_negative_USDC at 2026-02-01'
      )
    ).toContain('Solde USDC insuffisant au 2026-02-01');
  });

  it('formats legacy cash sequence errors', () => {
    expect(
      formatInvalidAccountSequenceMessage(
        'INVALID_ACCOUNT_SEQUENCE: cash_negative at 2026-02-01'
      )
    ).toContain('Solde cash insuffisant au 2026-02-01');
  });

  it('formats share sequence errors', () => {
    expect(
      formatInvalidAccountSequenceMessage(
        'INVALID_ACCOUNT_SEQUENCE: shares_negative BTC-USD at 2026-02-01'
      )
    ).toContain('Position BTC-USD insuffisante au 2026-02-01');
  });

  it('formats currency-specific share sequence errors', () => {
    expect(
      formatInvalidAccountSequenceMessage(
        'INVALID_ACCOUNT_SEQUENCE: shares_negative AAPL:USD at 2026-02-01'
      )
    ).toContain('Position AAPL (USD) insuffisante au 2026-02-01');
  });
});
