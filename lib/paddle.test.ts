import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { verifyPaddleSignature } from './paddle';

describe('verifyPaddleSignature', () => {
  const secret = 'test-webhook-secret';
  const body = '{"event_id":"evt_1"}';

  afterEach(() => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    vi.useRealTimers();
  });

  it('accepts a valid, recent signature', () => {
    process.env.PADDLE_WEBHOOK_SECRET = secret;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    const ts = String(Math.floor(Date.now() / 1000));
    const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');

    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`)).toBe(true);
  });

  it.each([
    ['non-numeric timestamp', 'not-a-time', 'a'.repeat(64)],
    ['short timestamp', '123', 'a'.repeat(64)],
    ['malformed digest', '1790251200', 'not-hex'],
  ])('rejects a %s', (_label, ts, h1) => {
    process.env.PADDLE_WEBHOOK_SECRET = secret;
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`)).toBe(false);
  });
});
