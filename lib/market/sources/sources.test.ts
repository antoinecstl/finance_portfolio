import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Faux client admin : une table en mémoire.
const rows = new Map<string, { payload: unknown; fetched_at: string }>();
let dbFails = false;
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => {
    if (dbFails) throw new Error('db down');
    return {
      from: () => {
        const filters: Record<string, string> = {};
        const api = {
          select: () => api,
          eq: (col: string, value: string) => { filters[col] = value; return api; },
          maybeSingle: async () => ({ data: rows.get(filters.key) ?? null, error: null }),
          upsert: async (row: { key: string; payload: unknown; fetched_at: string }) => {
            rows.set(row.key, { payload: row.payload, fetched_at: row.fetched_at });
            return { error: null };
          },
          delete: () => ({ lt: async () => ({ error: null }) }),
        };
        return api;
      },
    };
  },
}));

const { fetchJson, isCircuitOpen, resetCircuits } = await import('./resilient-fetch');
const { cached, resetMarketCache, HOUR, DAY } = await import('./cache');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  resetCircuits();
  resetMarketCache();
  rows.clear();
  dbFails = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchJson', () => {
  it('retries once on a transient error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchJson('https://x.test/a', { source: 'sec' });
    expect(result).toEqual({ ok: true, status: 200, json: { ok: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats 404 as an answer, not an outage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    for (let i = 0; i < 6; i++) {
      expect(await fetchJson('https://x.test/missing', { source: 'sec', retries: 0 })).toMatchObject({ reason: 'not_found' });
    }
    expect(isCircuitOpen('sec')).toBe(false);
  });

  it('pauses a failing source and answers immediately', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    for (let i = 0; i < 5; i++) await fetchJson('https://x.test/a', { source: 'provider', retries: 0 });
    expect(isCircuitOpen('provider')).toBe(true);
    const calls = fetchMock.mock.calls.length;
    expect(await fetchJson('https://x.test/a', { source: 'provider' })).toMatchObject({ reason: 'circuit_open' });
    expect(fetchMock.mock.calls.length).toBe(calls);
    // L'autre source n'est pas affectée.
    expect(isCircuitOpen('sec')).toBe(false);
  });
});

describe('cached', () => {
  const window = { freshMs: HOUR, staleMs: 30 * DAY };

  it('loads once, then serves the fresh copy', async () => {
    const load = vi.fn().mockResolvedValue({ v: 1 });
    expect(await cached('k1', window, load)).toMatchObject({ data: { v: 1 }, stale: false });
    expect(await cached('k1', window, load)).toMatchObject({ data: { v: 1 }, stale: false });
    expect(load).toHaveBeenCalledTimes(1);
    expect(rows.get('k1')?.payload).toEqual({ v: 1 });
  });

  it('shares one load between concurrent requests', async () => {
    let resolve!: (v: unknown) => void;
    const load = vi.fn(() => new Promise((r) => { resolve = r; }));
    const a = cached('k2', window, load);
    const b = cached('k2', window, load);
    await new Promise((r) => setTimeout(r, 0));
    resolve({ v: 2 });
    expect((await a)?.data).toEqual({ v: 2 });
    expect((await b)?.data).toEqual({ v: 2 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves the last good copy from the shared table when the source fails', async () => {
    rows.set('k3', { payload: { v: 'old' }, fetched_at: new Date(Date.now() - 2 * DAY).toISOString() });
    const entry = await cached('k3', window, async () => { throw new Error('down'); });
    expect(entry).toMatchObject({ data: { v: 'old' }, stale: true });
  });

  it('uses a fresh copy written by another instance without calling the source', async () => {
    rows.set('k4', { payload: { v: 'shared' }, fetched_at: new Date().toISOString() });
    const load = vi.fn();
    expect(await cached('k4', window, load)).toMatchObject({ data: { v: 'shared' }, stale: false });
    expect(load).not.toHaveBeenCalled();
  });

  it('gives up on copies older than the stale window', async () => {
    rows.set('k5', { payload: { v: 'ancient' }, fetched_at: new Date(Date.now() - 60 * DAY).toISOString() });
    expect(await cached('k5', window, async () => { throw new Error('down'); })).toBeNull();
  });

  it('keeps working on memory alone when the table is unavailable', async () => {
    dbFails = true;
    const load = vi.fn().mockResolvedValue({ v: 6 });
    expect(await cached('k6', window, load)).toMatchObject({ data: { v: 6 } });
    expect(await cached('k6', window, load)).toMatchObject({ data: { v: 6 } });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
