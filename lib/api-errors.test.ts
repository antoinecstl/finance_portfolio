import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './api-errors';

describe('getApiErrorMessage', () => {
  it('uses explicit API messages first', () => {
    expect(getApiErrorMessage({ error: 'internal_error', message: 'Message métier' }, 'Fallback')).toBe('Message métier');
    expect(getApiErrorMessage({ reason: 'Raison précise' }, 'Fallback')).toBe('Raison précise');
  });

  it('uses the first validation issue before generic error codes', () => {
    expect(
      getApiErrorMessage(
        { error: 'invalid_payload', issues: [{ path: 'name', message: 'Nom requis' }] },
        'Fallback'
      )
    ).toBe('Nom requis');
  });

  it('maps technical error codes to user-facing messages', () => {
    expect(getApiErrorMessage({ error: 'internal_error' }, 'Fallback')).toContain('erreur serveur');
    expect(getApiErrorMessage({ error: 'asset_account_mismatch' }, 'Fallback')).toContain('compatible');
  });

  it('falls back to status and caller fallback when needed', () => {
    expect(getApiErrorMessage({}, 'Fallback', 401)).toContain('session');
    expect(getApiErrorMessage({}, 'Fallback')).toBe('Fallback');
  });
});
