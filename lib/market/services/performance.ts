import 'server-only';
import { getMarketChart } from '@/lib/stock-api';
import { assetClassOf, tradesAroundTheClock, type AssetClass } from '../asset-class';
import { buildPerformanceReport, type PerformanceReport } from '../performance';
import { cached, DAY, HOUR } from '../sources/cache';

export type PerformancePayload =
  | { found: false }
  | ({ found: true; symbol: string; currency: string; assetClass: AssetClass; timezone: string } & PerformanceReport);

/**
 * Onglet Performance : 10 ans de clôtures quotidiennes + l'historique mensuel
 * complet, calculés côté serveur (quelques Ko envoyés au navigateur).
 */
export async function getPerformance(symbol: string) {
  return cached<PerformancePayload>(`perf:v1:${symbol}`, { freshMs: 6 * HOUR, staleMs: 7 * DAY }, async () => {
    const [daily, monthly] = await Promise.all([
      getMarketChart(symbol, { range: '10y', interval: '1d', revalidate: 6 * 3600 }),
      getMarketChart(symbol, { range: 'max', interval: '1mo', events: true, revalidate: 24 * 3600 }),
    ]);
    if (daily.status === 'not_found' && monthly.status !== 'ok') return { found: false };
    if (daily.status !== 'ok') throw new Error(`chart ${daily.status}`);

    const { meta, points } = daily.chart;
    const assetClass = assetClassOf(meta.instrumentType);
    const report = buildPerformanceReport(points, monthly.status === 'ok' ? monthly.chart.points : [], {
      timeZone: meta.timezone || 'UTC',
      price: meta.regularMarketPrice,
      periodsPerYear: tradesAroundTheClock(assetClass) ? 365 : 252,
    });
    return { found: true, symbol: meta.symbol, currency: meta.currency, assetClass, timezone: meta.timezone, ...report };
  });
}
