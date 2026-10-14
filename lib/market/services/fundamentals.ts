import 'server-only';
import { getFundamentalsSeries, getMarketChart, getQuoteSummary, getStockQuote } from '@/lib/stock-api';
import type { MarketDividend, MarketPoint } from '../chart-data';
import {
  buildStatements,
  computeRatios,
  majorCurrency,
  type FundamentalRatios,
  type QuoteSummaryData,
  type SeriesMap,
  type StatementRow,
  type Statements,
} from '../fundamentals';
import { dcfPlan, type DcfPlan } from '../dcf';
import { buildRecentPeriods, type RecentPeriods } from '../quarters';
import { buildHistory, DISPLAYED_ANNUAL_YEARS, dividendsPerYear, MAX_ANNUAL_YEARS, mergeAnnualRows, type HistoryRow } from '../history';
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
  /** Exercices fusionnés (officiel + fournisseur), 20 au plus (valorisation historique). */
  annualRows: StatementRow[];
  history: HistoryRow[];
  ratios: FundamentalRatios;
  summary: QuoteSummaryData | null;
  dividends: MarketDividend[];
  /** Derniers trimestres ou semestres publiés, poste par poste. */
  periods: RecentPeriods;
  /** Cours mensuels depuis l'origine (valorisation sur longue période). */
  monthlyPrices: MarketPoint[];
  sources: { official: boolean; officialYears: number; years: number };
  asOf: string;
  stale: boolean;
}

/** Séries comptables du fournisseur, avec copie de secours (30 jours). */
function providerSeries(symbol: string) {
  return cached<SeriesMap>(`prov:series:v3:${symbol}`, { freshMs: 6 * HOUR, staleMs: 30 * DAY }, async () => {
    const series = await getFundamentalsSeries(symbol);
    if (series === null) throw new Error('fundamentals series unavailable');
    return series;
  });
}

/** Profil et consensus (module « résumé », fragile), avec copie de secours. */
function providerSummary(symbol: string) {
  return cached<QuoteSummaryData>(`prov:summary:v3:${symbol}`, { freshMs: 6 * HOUR, staleMs: 30 * DAY }, async () => {
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

  const statements = buildStatements(seriesEntry?.data ?? {}, MAX_ANNUAL_YEARS);
  const merged = mergeAnnualRows(sec.status === 'ok' ? sec.facts.rows : [], statements.annual, MAX_ANNUAL_YEARS);
  const displayed = merged.rows.slice(-DISPLAYED_ANNUAL_YEARS);
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
    history: buildHistory(displayed, dps),
    ratios,
    summary,
    dividends,
    periods: buildRecentPeriods(seriesEntry?.data ?? {}),
    monthlyPrices: longChart.status === 'ok' ? longChart.chart.points : [],
    sources: { official: merged.officialYears > 0, officialYears: Math.min(merged.officialYears, displayed.length), years: displayed.length },
    asOf: new Date(fetchedAt).toISOString(),
    stale: entries.some((e) => e.stale),
  };
}

/** Scénarios du simulateur de valeur, tirés des comptes, du consensus et du bêta. */
export function dcfPlanFor(ratios: FundamentalRatios, summary: QuoteSummaryData | null): DcfPlan {
  return dcfPlan({
    revenueCagr: ratios.revenueCagr,
    epsCagr: ratios.epsCagr,
    fcfCagr: ratios.fcfCagr,
    growthYears: ratios.growthYears,
    analystGrowth: summary?.stats.earningsGrowth5y ?? null,
    beta: summary?.stats.beta ?? null,
  });
}
