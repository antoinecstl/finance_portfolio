// Per-instance in-memory rate limiter. Serverless-weak (resets on cold
// start, not shared across regions) but raises the bar against unsophisticated
// abuse. For true distributed limiting, replace with Upstash / Redis later.

type Bucket = { hits: number[] };
const store = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
};

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const b = store.get(key) ?? { hits: [] };
  b.hits = b.hits.filter(t => now - t < windowMs);

  if (b.hits.length >= max) {
    store.set(key, b);
    const resetMs = windowMs - (now - b.hits[0]);
    return { ok: false, remaining: 0, resetMs };
  }

  b.hits.push(now);
  store.set(key, b);

  if (store.size > 10_000) {
    for (const [k, v] of store) {
      if (v.hits.every(t => now - t >= windowMs)) store.delete(k);
    }
  }

  return { ok: true, remaining: max - b.hits.length, resetMs: windowMs };
}

export function clientKey(req: Request, userId?: string): string {
  if (userId) return `u:${userId}`;
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return `ip:${ip}`;
}
