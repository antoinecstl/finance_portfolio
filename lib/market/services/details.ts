import 'server-only';
import { getMarketChart, getQuoteSummaryRaw } from '@/lib/stock-api';
import { assetClassOf, type AssetClass } from '../asset-class';
import { earliestDate, parseCryptoDetails, parseEtfDetails, supplyMetrics, type CryptoDetails, type EtfDetails } from '../details';
import { allTimeHigh, returnsCorrelation } from '../performance';
import { cached, DAY, HOUR } from '../sources/cache';

export type DetailsPayload =
  | { found: false }
  | {
    found: true;
    assetClass: AssetClass;
    currency: string;
    etf: EtfDetails | null;
    crypto: (CryptoDetails & {
      issuedShare: number | null;
      fullyDilutedValue: number | null;
      volumeToMarketCap: number | null;
      allTimeHigh: { value: number; date: string; distance: number | null } | null;
      correlation: { with: string; label: string; value: number } | null;
    }) | null;
  };

const ETF_MODULES = ['fundProfile', 'topHoldings', 'fundPerformance', 'summaryDetail', 'defaultKeyStatistics'];
const CRYPTO_MODULES = ['summaryDetail', 'summaryProfile', 'price'];

/** Onglets Composition (ETF) et Marché (crypto). */
export async function getDetails(symbol: string) {
  return cached<DetailsPayload>(`details:v2:${symbol}`, { freshMs: 6 * HOUR, staleMs: 30 * DAY }, async () => {
    const year = await getMarketChart(symbol, { range: '1y', interval: '1d', revalidate: 3600 });
    if (year.status === 'not_found') return { found: false };
    if (year.status !== 'ok') throw new Error(`chart ${year.status}`);
    const { meta, points } = year.chart;
    const assetClass = assetClassOf(meta.instrumentType);
    const base = { found: true as const, assetClass, currency: meta.currency, etf: null, crypto: null };

    if (assetClass === 'etf') {
      const raw = await getQuoteSummaryRaw(symbol, ETF_MODULES);
      if (raw === null) throw new Error('summary unavailable');
      const etf = parseEtfDetails(raw);
      // La date de création publiée peut être postérieure à la première cotation (changement de fonds, fusion).
      if (etf) etf.profile.inceptionDate = earliestDate(etf.profile.inceptionDate, meta.firstTradeDate);
      return { ...base, etf };
    }

    if (assetClass === 'crypto') {
      // Corrélation avec le bitcoin ; pour le bitcoin lui-même, avec le S&P 500.
      const reference = meta.symbol.startsWith('BTC-') ? { symbol: '^GSPC', label: 'S&P 500' } : { symbol: 'BTC-USD', label: 'Bitcoin' };
      const [raw, monthly, ref] = await Promise.all([
        getQuoteSummaryRaw(symbol, CRYPTO_MODULES),
        getMarketChart(symbol, { range: 'max', interval: '1mo', events: true, revalidate: 24 * 3600 }),
        getMarketChart(reference.symbol, { range: '1y', interval: '1d', revalidate: 3600 }),
      ]);
      const parsed = raw ? parseCryptoDetails(raw) : null;
      const details: CryptoDetails = parsed ?? { marketCap: null, volume24h: null, circulatingSupply: null, maxSupply: null, startDate: null, algorithm: null, description: null };
      const price = meta.regularMarketPrice ?? points[points.length - 1]?.c ?? null;
      const closedHigh = allTimeHigh(points, monthly.status === 'ok' ? monthly.chart.points : []);
      // Le cours du jour peut dépasser le plus haut des séances closes.
      const ath = closedHigh && price !== null && price > closedHigh.value
        ? { value: price, date: new Date().toISOString().slice(0, 10) }
        : closedHigh;
      const correlation = ref.status === 'ok' ? returnsCorrelation(points, ref.chart.points) : null;
      return {
        ...base,
        crypto: {
          ...details,
          ...supplyMetrics(details, price),
          allTimeHigh: ath ? { ...ath, distance: price && ath.value > 0 ? price / ath.value - 1 : null } : null,
          correlation: correlation !== null ? { with: reference.symbol, label: reference.label, value: correlation } : null,
        },
      };
    }
    return base;
  });
}
