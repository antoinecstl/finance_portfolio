import { describe, it, expect } from 'vitest';
import {
  extractBearerToken,
  generateApiToken,
  hashApiToken,
  isWellFormedApiToken,
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
});
