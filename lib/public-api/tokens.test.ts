import { describe, it, expect } from 'vitest';
import {
  extractBearerToken,
  generateApiToken,
  hashApiToken,
  isWellFormedApiToken,
  shouldTouchLastUsed,
  validateTokenRecord,
} from './tokens';

describe('api tokens', () => {
  it('generates unique well-formed tokens with their hash and prefix', () => {
    const a = generateApiToken();
    const b = generateApiToken();
    expect(isWellFormedApiToken(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashApiToken(a.token));
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token.startsWith(a.tokenPrefix)).toBe(true);
    expect(a.tokenPrefix).toHaveLength(10);
  });

  it('extracts bearer tokens and rejects malformed headers', () => {
    const { token } = generateApiToken();
    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
    expect(extractBearerToken(`bearer ${token}`)).toBe(token);
    expect(extractBearerToken(token)).toBeNull();
    expect(extractBearerToken('Bearer fih_short')).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it('validates revocation and expiry', () => {
    const base = { id: 't1', user_id: 'u1', scopes: ['read'], expires_at: null, revoked_at: null, last_used_at: null };
    const now = new Date('2026-09-30T12:00:00Z');
    expect(validateTokenRecord(base, now)).toEqual({ ok: true, userId: 'u1', tokenId: 't1', scopes: ['read'] });
    expect(validateTokenRecord(null, now)).toEqual({ ok: false, reason: 'not_found' });
    expect(validateTokenRecord({ ...base, revoked_at: '2026-09-01T00:00:00Z' }, now)).toEqual({ ok: false, reason: 'revoked' });
    expect(validateTokenRecord({ ...base, expires_at: '2026-09-30T11:59:59Z' }, now)).toEqual({ ok: false, reason: 'expired' });
    expect(validateTokenRecord({ ...base, expires_at: '2026-10-30T00:00:00Z' }, now).ok).toBe(true);
  });

  it('throttles last_used_at writes', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    expect(shouldTouchLastUsed(null, now)).toBe(true);
    expect(shouldTouchLastUsed('2026-09-30T11:58:00Z', now)).toBe(false);
    expect(shouldTouchLastUsed('2026-09-30T11:50:00Z', now)).toBe(true);
  });
});
