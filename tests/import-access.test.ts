import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLANS, importAccess } from '@/lib/plans';

// Import de relevés : illimité en Pro, premier lot offert en Free.

let access = { allowed: true, offered: true };
let rpcError: { message: string } | null = null;
const getImportAccess = vi.fn(async () => access);
type RateLimit = (key: string, limit: number, windowSeconds: number) => Promise<{ ok: boolean; retryAfterMs: number }>;
const sharedRateLimit = vi.fn<RateLimit>(async () => ({ ok: true, retryAfterMs: 0 }));
const runImportPipeline = vi.fn(async () => ({ transactions: [], notes: [], rawExcerpt: '' }));

const JOB_ID = '00000000-0000-4000-8000-000000000001';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000002';

// Faux client Supabase : chaque requête renvoie la réponse programmée pour sa table.
function query(table: string) {
  const result =
    table === 'accounts'
      ? { data: { id: ACCOUNT_ID, name: 'PEA', currency: 'EUR', type: 'PEA', supports_positions: true }, error: null }
      : table === 'import_jobs'
        ? { data: null, error: null }
        : { data: null, error: null, count: 0 };
  const api: Record<string, unknown> = {
    select: () => api,
    insert: () => api,
    update: () => api,
    eq: () => api,
    in: () => api,
    maybeSingle: async () => result,
    single: async () => ({ data: { id: 'job-1' }, error: null }),
    then: (resolve: (v: unknown) => void) =>
      resolve(table === 'import_jobs' ? { data: [{ id: JOB_ID, status: 'previewing', account_id: ACCOUNT_ID }], error: null } : result),
  };
  return api;
}

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: query,
    rpc: async () => (rpcError ? { data: null, error: rpcError } : { data: { inserted: 1, total: 1 }, error: null }),
  }),
}));
vi.mock('@/lib/subscription', () => ({
  getImportAccess,
  getLimits: async () => ({ maxTransactions: 100 }),
  IMPORT_USED_MESSAGE: 'used',
}));
vi.mock('@/lib/shared-rate-limit', () => ({ sharedRateLimit }));
vi.mock('@/lib/import/orchestrator', () => ({
  runImportPipeline,
  buildIdempotencyKey: () => 'key',
}));
vi.mock('@/lib/stock-api', () => ({ getStockQuotes: async () => [] }));

const { POST: parse } = await import('@/app/api/import/parse/route');
const { POST: commit } = await import('@/app/api/import/commit/route');

const BASE = 'https://fi-hub.test';
const post = (path: string, body: unknown) =>
  new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(body),
  });
const parseRequest = () => post('/api/import/parse', { account_id: 'acc-1', text: '01/02/2026 versement 100' });
const commitRequest = () =>
  post('/api/import/commit', {
    import_job_id: JOB_ID,
    account_id: ACCOUNT_ID,
    transactions: [{ type: 'DEPOSIT', amount: 100, fees: 0, description: 'Versement', date: '2026-02-01' }],
  });

beforeEach(() => {
  access = { allowed: true, offered: true };
  rpcError = null;
  getImportAccess.mockClear();
  sharedRateLimit.mockClear();
  runImportPipeline.mockClear();
});

describe('importAccess', () => {
  it('offre le premier import en Free, puis le ferme', () => {
    expect(importAccess(PLANS.free, 0)).toEqual({ allowed: true, offered: true });
    expect(importAccess(PLANS.free, 1)).toEqual({ allowed: false, offered: false });
    expect(importAccess(PLANS.free, 3)).toEqual({ allowed: false, offered: false });
  });

  it('laisse l’import illimité en Pro', () => {
    expect(importAccess(PLANS.pro, 0)).toEqual({ allowed: true, offered: false });
    expect(importAccess(PLANS.pro, 40)).toEqual({ allowed: true, offered: false });
  });
});

describe('/api/import/parse', () => {
  it('refuse sans appeler l’analyse quand l’import offert est utilisé', async () => {
    access = { allowed: false, offered: false };
    const res = await parse(parseRequest() as never);
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('pro_required');
    expect(runImportPipeline).not.toHaveBeenCalled();
    expect(sharedRateLimit).not.toHaveBeenCalled();
  });

  it('borne les analyses de l’import offert par jour', async () => {
    const res = await parse(parseRequest() as never);
    expect(res.status).toBe(200);
    expect(sharedRateLimit).toHaveBeenCalledWith('import-parse-free:u:user-1', expect.any(Number), 24 * 60 * 60);
    expect(runImportPipeline).toHaveBeenCalledOnce();
  });

  it('s’arrête à la limite du jour', async () => {
    sharedRateLimit.mockImplementation(async (key: string) => ({ ok: !key.startsWith('import-parse-free'), retryAfterMs: 1000 }));
    const res = await parse(parseRequest() as never);
    expect(res.status).toBe(429);
    expect(runImportPipeline).not.toHaveBeenCalled();
    sharedRateLimit.mockImplementation(async () => ({ ok: true, retryAfterMs: 0 }));
  });

  it('n’applique pas la limite du jour en Pro', async () => {
    access = { allowed: true, offered: false };
    const res = await parse(parseRequest() as never);
    expect(res.status).toBe(200);
    expect(sharedRateLimit).toHaveBeenCalledTimes(1);
    expect(sharedRateLimit).toHaveBeenCalledWith('import-parse:u:user-1', 20, 60 * 60);
  });
});

describe('/api/import/commit', () => {
  it('refuse un second import en Free', async () => {
    access = { allowed: false, offered: false };
    const res = await commit(commitRequest());
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('pro_required');
  });

  it('traduit le refus de la base (import offert déjà utilisé)', async () => {
    rpcError = { message: 'FREE_IMPORT_USED: import offert déjà utilisé' };
    const res = await commit(commitRequest());
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'pro_required', message: 'used' });
  });
});
