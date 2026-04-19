import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { createHmac, timingSafeEqual } from 'node:crypto';

let _client: Paddle | null = null;

export function getPaddleClient(): Paddle {
  if (_client) return _client;
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error('PADDLE_API_KEY manquant');
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
    ? Environment.production
    : Environment.sandbox;
  _client = new Paddle(apiKey, { environment: env });
  return _client;
}

/**
 * Verifie la signature d'un webhook Paddle.
 * Format du header `Paddle-Signature`: `ts=<timestamp>;h1=<hmac>`
 * Le hmac est SHA256 de `${ts}:${rawBody}` avec le secret du webhook.
 */
export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  // Anti-replay : +/- 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > 300) return false;

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(h1, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
