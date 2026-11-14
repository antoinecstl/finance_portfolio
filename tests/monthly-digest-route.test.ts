import { beforeEach, describe, expect, it, vi } from 'vitest';

// Tâche planifiée du récapitulatif mensuel : jamais exécutable sans le secret.

const runMonthlyDigest = vi.fn(async () => ({ period: '2026-10-01', candidates: 2, sent: 1, skipped: 1, failed: 0, preview: '<p>aperçu</p>' }));
vi.mock('@/lib/monthly-digest', () => ({ runMonthlyDigest }));

const { GET } = await import('@/app/api/cron/monthly-digest/route');
const { NextRequest } = await import('next/server');

const call = (query = '', authorization?: string) =>
  GET(new NextRequest(`https://fi-hub.test/api/cron/monthly-digest${query}`, { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  runMonthlyDigest.mockClear();
  process.env.CRON_SECRET = 'secret-de-test';
});

describe('/api/cron/monthly-digest', () => {
  it('refuse tout tant que CRON_SECRET n’est pas défini', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('', 'Bearer secret-de-test')).status).toBe(503);
    expect(runMonthlyDigest).not.toHaveBeenCalled();
  });

  it('refuse sans le bon secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('', 'Bearer autre')).status).toBe(401);
    expect((await call('', 'secret-de-test')).status).toBe(401);
    expect(runMonthlyDigest).not.toHaveBeenCalled();
  });

  it('lance l’envoi avec le secret, sans renvoyer l’aperçu', async () => {
    const res = await call('', 'Bearer secret-de-test');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, dryRun: false, period: '2026-10-01', candidates: 2, sent: 1, skipped: 1, failed: 0 });
    expect(runMonthlyDigest).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
  });

  it('calcule sans envoyer en mode essai et sait renvoyer l’aperçu', async () => {
    const res = await call('?dry=1&html=1', 'Bearer secret-de-test');
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe('<p>aperçu</p>');
    expect(runMonthlyDigest).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });
});
