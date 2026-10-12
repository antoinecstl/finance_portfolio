import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Faux client Supabase « admin » : enregistre les requêtes et renvoie des
// réponses programmées par table.
type Call = { table: string; op: string; filters: Array<[string, unknown]>; payload?: unknown };
const calls: Call[] = [];
let existingSubscription: Record<string, unknown> | null = null;
let rpcError: Error | null = null;

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  calls.push(call);
  const api: Record<string, unknown> = {
    select: () => api,
    insert: (payload: unknown) => { call.op = 'insert'; call.payload = payload; return Promise.resolve({ error: null }); },
    upsert: (payload: unknown) => { call.op = 'upsert'; call.payload = payload; return Promise.resolve({ error: null }); },
    update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return api; },
    delete: () => { call.op = 'delete'; return api; },
    eq: (column: string, value: unknown) => { call.filters.push([column, value]); return api; },
    maybeSingle: () => Promise.resolve({ data: table === 'subscriptions' ? existingSubscription : null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ error: null }),
  };
  return api;
}

const deleteUser = vi.fn(async () => ({ error: null }));
const cancelSubscription = vi.fn(async () => ({}));
let sessionUser: { id: string; email: string } | null = { id: 'user-1', email: 'a@b.fr' };

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: async () => {
    if (rpcError) throw rpcError;
    return {
      from: builder,
      auth: { admin: { deleteUser, getUserById: async () => ({ data: { user: null } }) } },
      rpc: () => ({ single: async () => ({ data: { allowed: false, retry_after: 42 }, error: null }) }),
    };
  },
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: sessionUser } }) } }),
}));
vi.mock('@/lib/email', () => ({
  sendSubscriptionReceipt: vi.fn(),
  sendPaymentFailed: vi.fn(),
  sendAccountDeletion: vi.fn(),
}));
vi.mock('@/lib/paddle', async (original) => ({
  ...(await original<typeof import('@/lib/paddle')>()),
  getPaddleClient: () => ({ subscriptions: { cancel: cancelSubscription } }),
}));
vi.mock('server-only', () => ({}));

process.env.PADDLE_WEBHOOK_SECRET = 'whsec_test';
process.env.PADDLE_PRO_PRICE_ID = 'pri_pro';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';

const { POST: paddleWebhook } = await import('@/app/api/webhooks/paddle/route');
const { POST: deleteAccount } = await import('@/app/api/account/delete/route');
const { sharedRateLimit } = await import('@/lib/shared-rate-limit');

function signed(event: unknown): Request {
  const body = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac('sha256', 'whsec_test').update(`${ts}:${body}`).digest('hex');
  return new Request('https://fi-hub.test/api/webhooks/paddle', {
    method: 'POST',
    body,
    headers: { 'paddle-signature': `ts=${ts};h1=${h1}` },
  });
}

beforeEach(() => {
  calls.length = 0;
  existingSubscription = null;
  rpcError = null;
  sessionUser = { id: 'user-1', email: 'a@b.fr' };
  deleteUser.mockClear();
  cancelSubscription.mockReset();
  cancelSubscription.mockResolvedValue({});
});

describe('Paddle webhook', () => {
  const subscriptionEvent = (overrides: Record<string, unknown> = {}) => ({
    event_id: `evt_${Math.random()}`,
    event_type: 'subscription.created',
    data: {
      id: 'sub_attacker', customer_id: 'ctm_attacker', status: 'active',
      custom_data: { user_id: 'victim' }, items: [{ price: { id: 'pri_pro' } }],
      ...overrides,
    },
  });

  it('rejects unsigned events', async () => {
    const res = await paddleWebhook(new Request('https://fi-hub.test/api/webhooks/paddle', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });

  it('does not let another Paddle customer overwrite a live subscription', async () => {
    existingSubscription = { paddle_subscription_id: 'sub_victim', paddle_customer_id: 'ctm_victim', status: 'active' };
    const res = await paddleWebhook(signed(subscriptionEvent()));
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.table === 'subscriptions' && c.op === 'upsert')).toBe(false);
  });

  it('still records a first subscription or a renewal by the same customer', async () => {
    await paddleWebhook(signed(subscriptionEvent()));
    expect(calls.find((c) => c.op === 'upsert')?.payload).toMatchObject({ user_id: 'victim', plan_id: 'pro' });

    calls.length = 0;
    existingSubscription = { paddle_subscription_id: 'sub_old', paddle_customer_id: 'ctm_attacker', status: 'canceled' };
    await paddleWebhook(signed(subscriptionEvent()));
    expect(calls.some((c) => c.op === 'upsert')).toBe(true);
  });

  it('only cancels the subscription named in the event', async () => {
    await paddleWebhook(signed({ ...subscriptionEvent(), event_type: 'subscription.canceled' }));
    const update = calls.find((c) => c.table === 'subscriptions' && c.op === 'update');
    expect(update?.filters).toEqual([['user_id', 'victim'], ['paddle_subscription_id', 'sub_attacker']]);
  });
});

describe('account deletion', () => {
  const request = () => new Request('https://fi-hub.test/api/account/delete', { method: 'POST', headers: { origin: 'https://fi-hub.test' } });

  it('cancels a billed subscription before deleting the user', async () => {
    existingSubscription = { paddle_subscription_id: 'sub_1', status: 'active' };
    const res = await deleteAccount(request());
    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalledWith('sub_1', { effectiveFrom: 'immediately' });
    expect(deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('keeps the account when the subscription cannot be cancelled', async () => {
    existingSubscription = { paddle_subscription_id: 'sub_1', status: 'active' };
    cancelSubscription.mockRejectedValueOnce(new Error('paddle down'));
    const res = await deleteAccount(request());
    expect(res.status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('deletes directly when nothing is billed', async () => {
    existingSubscription = { paddle_subscription_id: 'sub_1', status: 'canceled' };
    expect((await deleteAccount(request())).status).toBe(200);
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it('refuses cross-site requests', async () => {
    const res = await deleteAccount(new Request('https://fi-hub.test/api/account/delete', { method: 'POST', headers: { origin: 'https://evil.test' } }));
    expect(res.status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe('sharedRateLimit', () => {
  it('uses the shared counter when available', async () => {
    expect(await sharedRateLimit('test:shared', 1, 60)).toEqual({ ok: false, retryAfterMs: 42_000 });
  });

  it('falls back to the in-memory limiter when the counter is down', async () => {
    rpcError = new Error('db down');
    expect((await sharedRateLimit('test:fallback', 1, 60)).ok).toBe(true);
    expect((await sharedRateLimit('test:fallback', 1, 60)).ok).toBe(false);
  });
});
