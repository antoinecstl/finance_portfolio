import { beforeEach, describe, expect, it, vi } from 'vitest';

// Saisie rapide de positions : contrôle du titre, des limites de l'offre, puis
// enregistrement atomique par le RPC insert_transactions_batch.

const ACCOUNT_ID = '00000000-0000-4000-8000-000000000002';
let existing: Array<{ type: string; stock_symbol: string | null; quantity: number | null }> = [];
let limits = { maxTransactions: 100, maxPositions: 10 };
const rpc = vi.fn(async () => ({ data: { inserted: 3, total: 3 }, error: null }));

function query(table: string) {
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    maybeSingle: async () => ({
      data: table === 'accounts' ? { id: ACCOUNT_ID, type: 'PEA', supports_positions: null, currency: 'EUR' } : null,
      error: null,
    }),
    then: (resolve: (v: unknown) => void) => resolve({ data: table === 'transactions' ? existing : [], error: null }),
  };
  return api;
}

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: query,
    rpc,
  }),
}));
vi.mock('@/lib/subscription', () => ({ getLimits: async () => limits }));
vi.mock('@/lib/stock-api', () => ({
  getStockQuotes: async (symbols: string[]) =>
    symbols.filter((s) => s !== 'INCONNU').map((symbol) => ({ symbol, currency: symbol === 'AAPL' ? 'USD' : 'EUR' })),
}));

const { POST } = await import('@/app/api/positions/quick/route');

const BASE = 'https://fi-hub.test';
const request = (body: unknown, origin = BASE) =>
  new Request(`${BASE}/api/positions/quick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
const body = (positions: Array<{ symbol: string; quantity: number; average_price: number }>, cash = 0) => ({
  account_id: ACCOUNT_ID,
  date: '2026-11-13',
  cash,
  positions,
});

beforeEach(() => {
  existing = [];
  limits = { maxTransactions: 100, maxPositions: 10 };
  rpc.mockClear();
});

describe('/api/positions/quick', () => {
  it('enregistre le versement de départ et les achats en une fois', async () => {
    const res = await POST(request(body([{ symbol: 'wpea.pa', quantity: 100, average_price: 5 }, { symbol: 'AAPL', quantity: 1, average_price: 200 }], 50)));
    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledOnce();
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_transactions: Array<Record<string, unknown>>; p_import_job_id: null }];
    expect(name).toBe('insert_transactions_batch');
    expect(args.p_import_job_id).toBeNull();
    expect(args.p_transactions.map((t) => [t.type, t.currency, t.amount])).toEqual([
      ['DEPOSIT', 'EUR', 550],
      ['DEPOSIT', 'USD', 200], // devise de cotation lue côté serveur
      ['BUY', 'EUR', 500],
      ['BUY', 'USD', 200],
    ]);
  });

  it('refuse un titre inconnu sans rien écrire', async () => {
    const res = await POST(request(body([{ symbol: 'INCONNU', quantity: 1, average_price: 10 }])));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('unknown_symbols');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('applique la limite de positions de l’offre', async () => {
    limits = { maxTransactions: 100, maxPositions: 2 };
    existing = [
      { type: 'BUY', stock_symbol: 'MC.PA', quantity: 1 },
      { type: 'BUY', stock_symbol: 'AI.PA', quantity: 1 },
    ];
    // Renforcer une ligne déjà détenue reste possible ; une troisième position, non.
    expect((await POST(request(body([{ symbol: 'MC.PA', quantity: 1, average_price: 600 }])))).status).toBe(201);
    const res = await POST(request(body([{ symbol: 'TTE.PA', quantity: 1, average_price: 60 }])));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: 'limit_reached', scope: 'positions', limit: 2, current: 2 });
  });

  it('applique la limite de transactions de l’offre', async () => {
    limits = { maxTransactions: 3, maxPositions: 10 };
    existing = [{ type: 'DEPOSIT', stock_symbol: null, quantity: null }, { type: 'DEPOSIT', stock_symbol: null, quantity: null }];
    const res = await POST(request(body([{ symbol: 'MC.PA', quantity: 1, average_price: 600 }])));
    expect(res.status).toBe(402);
    expect((await res.json()).scope).toBe('transactions');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuse les requêtes venues d’un autre site et les corps invalides', async () => {
    expect((await POST(request(body([{ symbol: 'MC.PA', quantity: 1, average_price: 1 }]), 'https://evil.test'))).status).toBe(403);
    expect((await POST(request(body([])))).status).toBe(400);
    expect((await POST(request(body([{ symbol: 'MC.PA', quantity: -1, average_price: 1 }])))).status).toBe(400);
  });
});
