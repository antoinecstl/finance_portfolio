import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { MarketPoint, ParsedChart } from '@/lib/market/chart-data';

const getMarketChart = vi.fn();
const getStockQuote = vi.fn();
let user: { id: string } | null = { id: 'user-1' };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
vi.mock('@/lib/stock-api', () => ({
  getMarketChart: (...args: unknown[]) => getMarketChart(...args),
  getStockQuote: (...args: unknown[]) => getStockQuote(...args),
}));

const { GET: chartGET } = await import('@/app/api/market/chart/route');
const { GET: overviewGET } = await import('@/app/api/market/overview/route');

const DAY = 86_400;
const now = Math.floor(Date.now() / 1000);
const points: MarketPoint[] = Array.from({ length: 800 }, (_, i) => {
  const c = 100 + i * 0.1;
  return { t: now - (799 - i) * DAY, o: c, h: c + 1, l: c - 1, c, v: 1000 };
});
const chart = (extra: Partial<ParsedChart> = {}): ParsedChart => ({
  meta: {
    symbol: 'CW8.PA', name: 'Amundi MSCI World', exchange: 'Paris', currency: 'EUR', instrumentType: 'ETF',
    timezone: 'Europe/Paris', regularMarketPrice: 179.9, previousClose: 179, dayHigh: 181, dayLow: 178, volume: 900,
    fiftyTwoWeekHigh: 181, fiftyTwoWeekLow: 140, regularMarketStart: 1, regularMarketEnd: 2,
  },
  points,
  dividends: [{ date: new Date((now - 100 * DAY) * 1000).toISOString().slice(0, 10), amount: 1.8 }],
  splits: [],
  ...extra,
});
const req = (path: string) => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  user = { id: `user-${Math.random()}` }; // limite de débit propre à chaque test
  getMarketChart.mockReset();
  getStockQuote.mockReset();
});

describe('GET /api/market/chart', () => {
  it('requires a session and valid parameters', async () => {
    user = null;
    expect((await chartGET(req('/api/market/chart?symbol=CW8.PA'))).status).toBe(401);
    user = { id: 'u-params' };
    expect((await chartGET(req('/api/market/chart?symbol=CW8.PA;DROP'))).status).toBe(400);
    expect((await chartGET(req('/api/market/chart?symbol=CW8.PA&period=2A'))).status).toBe(400);
  });

  it('asks for a longer history and tells where the display starts', async () => {
    getMarketChart.mockResolvedValue({ status: 'ok', chart: chart() });
    const res = await chartGET(req('/api/market/chart?symbol=cw8.pa&period=6M'));
    expect(res.status).toBe(200);
    expect(getMarketChart).toHaveBeenCalledWith('CW8.PA', { range: '2y', interval: '1d', revalidate: 3600 });
    const body = await res.json();
    expect(body).toMatchObject({ symbol: 'CW8.PA', period: '6M', interval: '1d', intraday: false, timezone: 'Europe/Paris' });
    expect(body.points).toHaveLength(800);
    expect(body.displayFrom).toBeGreaterThan(now - 190 * DAY);
    expect(body.displayFrom).toBeLessThan(now - 170 * DAY);
  });

  it('accepts index symbols and maps provider failures', async () => {
    getMarketChart.mockResolvedValueOnce({ status: 'not_found' });
    expect((await chartGET(req('/api/market/chart?symbol=%5EFCHI&period=1J'))).status).toBe(404);
    expect(getMarketChart).toHaveBeenCalledWith('^FCHI', { range: '1d', interval: '5m', revalidate: 60 });
    getMarketChart.mockResolvedValueOnce({ status: 'error' });
    const res = await chartGET(req('/api/market/chart?symbol=%5EFCHI'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'provider_unavailable' });
  });
});

describe('GET /api/market/overview', () => {
  it('combines the session quote with five-year statistics and dividends', async () => {
    getMarketChart.mockResolvedValue({ status: 'ok', chart: chart() });
    getStockQuote.mockResolvedValue({ symbol: 'CW8.PA', name: 'Amundi', price: 180, change: 1, changePercent: 0.56, previousClose: 179, open: 179, high: 181, low: 178, volume: 1200, currency: 'EUR', regularMarketStart: 10, regularMarketEnd: 20 });
    const res = await overviewGET(req('/api/market/overview?symbol=CW8.PA'));
    expect(res.status).toBe(200);
    expect(getMarketChart).toHaveBeenCalledWith('CW8.PA', { range: '5y', interval: '1d', events: true, revalidate: 3600 });
    const body = await res.json();
    expect(body).toMatchObject({ name: 'Amundi MSCI World', price: 180, changePercent: 0.56, volume: 1200, regularMarketStart: 10 });
    expect(body.performance['1A']).toBeCloseTo(180 / (100 + (799 - 365) * 0.1) - 1, 1);
    expect(body.performance['5A']).toBeNull();
    expect(body.trailingYield).toBeCloseTo(1.8 / 180, 6);
    expect(body.dividendsByYear).toHaveLength(5);
    expect(body.maxDrawdown1Y).toBe(0);
  });

  it('returns 404 for an unknown symbol and 502 when the provider fails', async () => {
    getMarketChart.mockResolvedValueOnce({ status: 'not_found' });
    getStockQuote.mockResolvedValueOnce(null);
    expect((await overviewGET(req('/api/market/overview?symbol=NOPE'))).status).toBe(404);
    getMarketChart.mockResolvedValueOnce({ status: 'error' });
    getStockQuote.mockResolvedValueOnce(null);
    expect((await overviewGET(req('/api/market/overview?symbol=NOPE'))).status).toBe(502);
  });
});
