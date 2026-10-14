import 'server-only';
import { getFundamentalsSeries, getMarketChart, getQuoteSummary, getStockQuote } from '@/lib/stock-api';
import type { MarketDividend, MarketPoint } from '../chart-data';
import {
  buildStatements,
  computeRatios,
  defaultDcfGrowth,
  majorCurrency,
  type FundamentalRatios,
  type QuoteSummaryData,
  type SeriesMap,
  type StatementRow,
  type Statements,
} from '../fundamentals';
import { buildHistory, dividendsPerYear, mergeAnnualRows, type HistoryRow } from '../history';
import { isSecEligible } from '../sources/sec';
import { cached, DAY, HOUR, type CacheEntry } from '../sources/cache';
import { getSecAnnual } from './sec';

export interface FundamentalsBundle {
  available: boolean;
  currency: string;
  priceCurrency: string;
  priceInStatementCurrency: number | null;
  fxRate: number | null;
  /** Divise un montant coté (centimes, ex. GBp) pour l'exprimer en unités. */
  priceDivisor: number;
  statements: Statements;
  /** Exercices fusionnés (officiel + fournisseur), 15 au plus. */
  annualRows: StatementRow[];
  history: HistoryRow[];
  ratios: FundamentalRatios;
  summary: QuoteSummaryData | null;
  dividends: MarketDividend[];
  /** Cours mensuels depuis l'origine (valorisation sur longue période). */
  monthlyPrices: MarketPoint[];
  sources: { official: boolean; officialYears: number; years: number };
  asOf: string;
  stale: boolean;
}

/** Séries comptables du fournisseur, avec copie de secours (30 jours). */
function providerSeries(symbol: string) {
  return cached<SeriesMap>(`prov:series:v1:${symbol}`, { freshMs: 6 * HOUR, staleMs: 30 * DAY }, async () => {
    const series = await getFundamentalsSeries(symbol);
    if (series === null) throw new Error('fundamentals series unavailable');
    return series;
  });
}

/** Profil et consensus (module « résumé », fragile), avec copie de secours. */
function providerSummary(symbol: string) {
  return cached<QuoteSummaryData>(`prov:summary:v1:${symbol}`, { freshMs: 6 * HOUR, staleMs: 30 * DAY }, async () => {
    const summary = await getQuoteSummary(symbol);
    if (summary === null) throw new Error('summary unavailable');
    return summary;
  });
}

/**
 * Tout ce que les onglets Finances, Valorisation et Profil d'une action
 * utilisent : comptes consolidés, ratios au cours actuel, profil, dividendes.
 * Null si aucune source ne répond.
 */
export async function getFundamentalsBundle(symbol: string): Promise<FundamentalsBundle | null> {
  const [quote, seriesEntry, summaryEntry, longChart] = await Promise.all([
    getStockQuote(symbol),
    providerSeries(symbol),
    providerSummary(symbol),
    getMarketChart(symbol, { range: 'max', interval: '1mo', events: true, revalidate: 24 * 3600 }),
  ]);
  const sec = isSecEligible(symbol, quote?.currency) ? await getSecAnnual(symbol) : { status: 'not_covered' as const };
  if (!seriesEntry && !summaryEntry && sec.status !== 'ok') return null;

  const statements = buildStatements(seriesEntry?.data ?? {}, 15);
  const merged = mergeAnnualRows(sec.status === 'ok' ? sec.facts.rows : [], statements.annual);
  for (const d of merged.divergences) {
    console.warn(`[fundamentals] ${symbol} ${d.date}: revenue differs between sources (official ${d.official}, provider ${d.provider})`);
  }
  const summary = summaryEntry?.data ?? null;
  const available = merged.rows.length > 0 || statements.ttm !== null || summary !== null;

  // Les ratios se calculent dans la devise des comptes : le cours y est converti
  // si la cotation se fait dans une autre devise (ou en centimes, ex. GBp).
  const priceCurrency = quote?.currency ?? '';
  const major = majorCurrency(priceCurrency || statements.currency || (sec.status === 'ok' ? 'USD' : ''));
  const currency = statements.currency ?? (sec.status === 'ok' ? 'USD' : major.currency);
  let fxRate: number | null = 1;
  if (quote && major.currency && currency && major.currency !== currency) {
    const fx = await getStockQuote(`${major.currency}${currency}=X`);
    fxRate = fx?.price && fx.price > 0 ? fx.price : null;
  }
  const price = quote && fxRate !== null ? (quote.price / major.divisor) * fxRate : 0;
  const ratiosStatements: Statements = { ...statements, annual: merged.rows.slice(-5) };
  const ratios = computeRatios(ratiosStatements, price);

  const dividends = longChart.status === 'ok' ? longChart.chart.dividends : [];
  // Dividende par action : versements de l'année civile, seulement s'ils sont dans la devise des comptes.
  const dps = major.currency === currency
    ? new Map([...dividendsPerYear(dividends)].map(([y, v]) => [y, v / major.divisor]))
    : new Map<number, number>();

  const entries = [seriesEntry, summaryEntry, sec.status === 'ok' ? sec : null].filter(Boolean) as Array<Pick<CacheEntry<unknown>, 'fetchedAt' | 'stale'>>;
  const fetchedAt = entries.length > 0 ? Math.min(...entries.map((e) => e.fetchedAt)) : Date.now();

  return {
    available,
    currency,
    priceCurrency,
    priceInStatementCurrency: price > 0 ? price : null,
    fxRate: fxRate !== 1 ? fxRate : null,
    priceDivisor: major.divisor,
    statements,
    annualRows: merged.rows,
    history: buildHistory(merged.rows, dps),
    ratios,
    summary,
    dividends,
    monthlyPrices: longChart.status === 'ok' ? longChart.chart.points : [],
    sources: { official: merged.officialYears > 0, officialYears: merged.officialYears, years: merged.rows.length },
    asOf: new Date(fetchedAt).toISOString(),
    stale: entries.some((e) => e.stale),
  };
}

export function dcfDefaultsFor(ratios: FundamentalRatios) {
  return { growth: defaultDcfGrowth(ratios), discountRate: 0.09, terminalGrowth: 0.02 };
}
