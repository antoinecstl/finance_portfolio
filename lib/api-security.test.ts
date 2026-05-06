import { describe, expect, it } from 'vitest';
import {
  enforceAuthenticatedJsonMutation,
  enforceAuthenticatedMutation,
} from './api-security';

const request = (headers: HeadersInit = {}) =>
  new Request('https://app.example.com/api/accounts', { method: 'POST', headers });

describe('api security guards', () => {
  it('accepts same-origin authenticated mutations', () => {
    const result = enforceAuthenticatedMutation(request({ origin: 'https://app.example.com' }));

    expect(result).toBeNull();
  });

  it('rejects cross-origin authenticated mutations', () => {
    const result = enforceAuthenticatedMutation(request({ origin: 'https://evil.example' }));

    expect(result?.status).toBe(403);
  });

  it('requires JSON content type for JSON mutations', () => {
    const result = enforceAuthenticatedJsonMutation(
      request({ origin: 'https://app.example.com', 'content-type': 'text/plain' })
    );

    expect(result?.status).toBe(415);
  });

  it('rejects oversized JSON payloads based on content-length', () => {
    const result = enforceAuthenticatedJsonMutation(
      request({
        origin: 'https://app.example.com',
        'content-type': 'application/json',
        'content-length': '1000001',
      })
    );

    expect(result?.status).toBe(413);
  });
});
