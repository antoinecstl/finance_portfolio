import 'server-only';
import { getMarketChart } from '@/lib/stock-api';
import type { MarketPoint } from '../chart-data';
import { dcfValuePerShare, majorCurrency } from '../fundamentals';
import { downsample } from '../performance';
import { alignToTimeline } from '../analytics';
import { buildSnapshots, valuationHistory, valuationReferences, type MultipleKey, type MultipleSeries, type ValuationReference } from '../valuation';
import { cached, DAY, HOUR } from '../sources/cache';
import { dcfPlanFor, getFundamentalsBundle } from './fundamentals';

export type ValuationPayload =
  | { available: false }
  | {
    available: true;
    currency: string;
    priceCurrency: string;
    price: number | null;
    multiples: Partial<Record<MultipleKey, MultipleSeries>>;
    references: ValuationReference[];
  };

const fmt = (v: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} ×`;

/**
 * Multiples hebdomadaires sur 10 ans (mensuels avant, jusqu'aux plus anciens
 * comptes disponibles), dans la devise des comptes, et repères de valorisation
 * en devise de cotation.
 */
export async function getValuation(symbol: string) {
  return cached<ValuationPayload>(`val:v2:${symbol}`, { freshMs: 6 * HOUR, staleMs: 7 * DAY }, async () => {
    const bundle = await getFundamentalsBundle(symbol);
    if (!bundle) throw new Error('fundamentals unavailable');
    if (!bundle.available || bundle.annualRows.length === 0) return { available: false };

    const weekly = await getMarketChart(symbol, { range: '10y', interval: '1wk', revalidate: 3600 });
    const weeklyPoints = weekly.status === 'ok' ? weekly.chart.points : [];
    const firstWeekly = weeklyPoints[0]?.t ?? Infinity;
    const quotePrices: MarketPoint[] = [...bundle.monthlyPrices.filter((p) => p.t < firstWeekly), ...weeklyPoints];
    if (quotePrices.length === 0) throw new Error('price history unavailable');

    // Cours dans la devise des comptes : unités (pas centimes), puis change historique si besoin.
    const major = majorCurrency(bundle.priceCurrency || bundle.currency);
    let fxSeries: Array<number | null> = quotePrices.map(() => 1);
    if (major.currency !== bundle.currency) {
      const fx = await getMarketChart(`${major.currency}${bundle.currency}=X`, { range: 'max', interval: '1wk', revalidate: 24 * 3600 });
      const current = bundle.fxRate;
      fxSeries = fx.status === 'ok' && fx.chart.points.length > 0
        ? alignToTimeline(quotePrices.map((p) => p.t), fx.chart.points, 7 * 86_400).map((v) => v ?? current)
        : quotePrices.map(() => current);
    }
    const prices = quotePrices
      .map((p, i) => (fxSeries[i] ? { ...p, c: (p.c / major.divisor) * (fxSeries[i] as number) } : null))
      .filter((p): p is MarketPoint => p !== null);
    const dividendQuotes = quotePrices.map((p) => ({ ...p, c: p.c / major.divisor }));
    const dividends = bundle.dividends.map((d) => ({ ...d, amount: d.amount / major.divisor }));

    const snapshots = buildSnapshots(bundle.annualRows, bundle.statements.ttm);
    const multiples = valuationHistory(prices, snapshots, { dividends, quotePrices: dividendQuotes, maxYears: 30 });
    // ~360 points suffisent à l'écran (≈ 130 sur 5 ans) ; valeurs arrondies pour alléger la réponse.
    for (const series of Object.values(multiples)) {
      series.points = downsample(series.points, 360).map((p) => ({ t: p.t, v: Number(p.v.toPrecision(4)) }));
    }

    // Repères : médianes sur 10 ans au plus.
    const tenYears = valuationHistory(prices, snapshots, { maxYears: 10 });
    const r = bundle.ratios;
    const quotePrice = bundle.priceInStatementCurrency;
    const quoteFactor = quotePrice && bundle.fxRate ? 1 / bundle.fxRate : 1;
    const dcf = dcfPlanFor(r, bundle.summary).scenarios.central;
    const references = valuationReferences({
      multiples: tenYears,
      ttm: {
        eps: r.eps,
        fcfPerShare: r.fcfPerShare,
        salesPerShare: r.marketCap && quotePrice && r.priceToSales ? quotePrice / r.priceToSales : null,
      },
      dcfValue: r.fcfPerShare !== null ? dcfValuePerShare({ fcfPerShare: r.fcfPerShare, growth: dcf.growth, discountRate: dcf.discountRate, terminalGrowth: dcf.terminalGrowth }) : null,
      grahamNumber: r.grahamNumber,
      analystTarget: bundle.summary?.analysts.targetMean ?? null,
      // Devise des comptes → devise de cotation (centimes compris).
      toQuote: (v) => v * quoteFactor * major.divisor,
      formatMultiple: fmt,
    });

    const lastQuote = quotePrices[quotePrices.length - 1]?.c ?? null;
    return {
      available: true,
      currency: bundle.currency,
      priceCurrency: bundle.priceCurrency,
      price: lastQuote,
      multiples,
      references,
    };
  });
}
