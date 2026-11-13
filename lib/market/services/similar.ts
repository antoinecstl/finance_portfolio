import 'server-only';
import { getQuoteSummaryRaw, getRecommendedSymbols, screenIndustry } from '@/lib/stock-api';
import { alsoWatchedOf, regionOf, selectPeers, withGlobalPeers, type SimilarItem, type SimilarResult } from '../similar';
import { cached, DAY } from '../sources/cache';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Secteur d'activité d'une action (libellés brut et affiché) ; null pour un ETF, un indice, une crypto. */
async function industryOf(symbol: string): Promise<{ raw: string; display: string } | null> {
  const json = await getQuoteSummaryRaw(symbol, ['assetProfile', 'quoteType']);
  const result = isRecord(json) && isRecord(json.quoteSummary) && Array.isArray(json.quoteSummary.result) ? json.quoteSummary.result[0] : null;
  if (!isRecord(result)) return null;
  const quoteType = isRecord(result.quoteType) ? result.quoteType.quoteType : null;
  const profile = isRecord(result.assetProfile) ? result.assetProfile : {};
  if (quoteType && quoteType !== 'EQUITY') return null;
  const raw = typeof profile.industry === 'string' && profile.industry.trim() ? profile.industry.trim() : null;
  const display = typeof profile.industryDisp === 'string' && profile.industryDisp.trim() ? profile.industryDisp.trim() : raw;
  return raw && display ? { raw, display } : null;
}

/** Sociétés du même secteur : place du titre d'abord, complétées par les États-Unis si besoin. */
async function industryPeers(symbol: string, industry: string): Promise<SimilarItem[] | null> {
  const region = regionOf(symbol);
  if (!region) return null;
  const local = await screenIndustry(industry, region, 15);
  if (local === null) return null;
  const peers = selectPeers(symbol, local);
  if (peers.length >= 4 || region === 'us') return peers;
  const us = await screenIndustry(industry, 'us', 10);
  return withGlobalPeers(peers, us ?? [], symbol);
}

/**
 * Titres similaires d'une fiche, gardés un jour (14 jours en secours). Les
 * cours sont demandés à part par la page, pour rester frais.
 */
export function getSimilar(symbol: string) {
  return cached<SimilarResult>(`similar:v1:${symbol}`, { freshMs: DAY, staleMs: 14 * DAY }, async () => {
    const [industry, recommended] = await Promise.all([
      industryOf(symbol).catch(() => null),
      getRecommendedSymbols(symbol),
    ]);
    const peers = industry ? await industryPeers(symbol, industry.raw).catch(() => null) : null;
    if (peers === null && recommended === null) throw new Error('similar sources unavailable');
    const peerList = peers ?? [];
    return {
      industry: peerList.length > 0 ? industry?.display ?? null : null,
      peers: peerList,
      alsoWatched: alsoWatchedOf(symbol, recommended ?? [], peerList),
    };
  });
}
