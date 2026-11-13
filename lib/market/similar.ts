// Titres similaires d'une fiche (bas de page) : sociétés du même secteur
// d'activité, classées par capitalisation, et titres souvent consultés avec
// celui-ci. Fonctions pures : requête du filtre de titres du fournisseur,
// lecture des réponses, fusion sans doublon.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export interface SimilarItem {
  symbol: string;
  name: string | null;
}

export interface SimilarResult {
  /** Secteur d'activité (libellé du fournisseur), pour le titre du groupe. */
  industry: string | null;
  /** Même secteur d'activité, de la plus grosse capitalisation à la plus petite. */
  peers: SimilarItem[];
  /** Souvent consultés avec ce titre (actions, ETF, indices, cryptos). */
  alsoWatched: SimilarItem[];
}

// Suffixe de place de cotation → région du filtre de titres.
const SUFFIX_REGIONS: Record<string, string> = {
  PA: 'fr', DE: 'de', F: 'de', AS: 'nl', BR: 'be', MI: 'it', MC: 'es', LS: 'pt', SW: 'ch',
  L: 'gb', IR: 'ie', ST: 'se', CO: 'dk', OL: 'no', HE: 'fi', VI: 'at', WA: 'pl',
  TO: 'ca', V: 'ca', T: 'jp', HK: 'hk', AX: 'au', SI: 'sg', KS: 'kr', TW: 'tw', NS: 'in', BO: 'in', SA: 'br', MX: 'mx',
};

/** Suffixe de place (« PA » pour SU.PA), null pour une valeur américaine (AAPL, BRK-B). */
export function exchangeSuffix(symbol: string): string | null {
  const m = /\.([A-Z]{1,3})$/.exec(symbol.toUpperCase());
  return m ? m[1] : null;
}

/** Région du filtre de titres pour un symbole ; null si la place n'est pas couverte. */
export function regionOf(symbol: string): string | null {
  const suffix = exchangeSuffix(symbol);
  return suffix === null ? 'us' : SUFFIX_REGIONS[suffix] ?? null;
}

/** Requête du filtre de titres : actions d'un secteur d'activité et d'une région, par capitalisation. */
export function industryScreenerQuery(industry: string, region: string, size = 12) {
  return {
    size,
    offset: 0,
    sortField: 'intradaymarketcap',
    sortType: 'DESC',
    quoteType: 'EQUITY',
    query: {
      operator: 'AND',
      operands: [
        { operator: 'EQ', operands: ['region', region] },
        { operator: 'EQ', operands: ['industry', industry] },
      ],
    },
    userId: '',
    userIdType: 'guid',
  };
}

/** Lit la réponse du filtre de titres ; null si elle est vide ou en erreur. */
export function parseScreener(json: unknown): Array<SimilarItem & { marketCap: number | null }> | null {
  const result = isRecord(json) && isRecord(json.finance) && Array.isArray(json.finance.result) ? json.finance.result[0] : null;
  if (!isRecord(result) || !Array.isArray(result.quotes)) return null;
  return result.quotes.filter(isRecord).flatMap((q) => {
    const symbol = str(q.symbol);
    if (!symbol) return [];
    const marketCap = isRecord(q.marketCap) ? (typeof q.marketCap.raw === 'number' ? q.marketCap.raw : null) : typeof q.marketCap === 'number' ? q.marketCap : null;
    return [{ symbol: symbol.toUpperCase(), name: str(q.longName) ?? str(q.shortName), marketCap }];
  });
}

/** Lit la réponse « souvent consultés avec » : symboles, du plus au moins proche. */
export function parseRecommendations(json: unknown): string[] | null {
  const result = isRecord(json) && isRecord(json.finance) && Array.isArray(json.finance.result) ? json.finance.result[0] : null;
  if (!isRecord(result) || !Array.isArray(result.recommendedSymbols)) return null;
  return result.recommendedSymbols
    .filter(isRecord)
    .map((r) => str(r.symbol)?.toUpperCase())
    .filter((s): s is string => Boolean(s));
}

/**
 * Pairs retenus : même place de cotation que le titre (une société allemande
 * n'est pas comparée à la cotation de Nvidia à Francfort), sans le titre
 * lui-même, sans doublon.
 */
export function selectPeers(symbol: string, candidates: SimilarItem[], max = 8): SimilarItem[] {
  const self = symbol.toUpperCase();
  const suffix = exchangeSuffix(self);
  const seen = new Set<string>([self]);
  const out: SimilarItem[] = [];
  for (const c of candidates) {
    const s = c.symbol.toUpperCase();
    if (seen.has(s) || exchangeSuffix(s) !== suffix) continue;
    seen.add(s);
    out.push({ symbol: s, name: c.name });
    if (out.length >= max) break;
  }
  return out;
}

/** Complète des pairs locaux trop peu nombreux par les plus grosses sociétés américaines du secteur. */
export function withGlobalPeers(local: SimilarItem[], us: SimilarItem[], self: string, min = 4, max = 8): SimilarItem[] {
  if (local.length >= min) return local.slice(0, max);
  const seen = new Set([self.toUpperCase(), ...local.map((p) => p.symbol)]);
  const extra = us
    .filter((p) => !seen.has(p.symbol) && exchangeSuffix(p.symbol) === null)
    .map((p) => ({ symbol: p.symbol, name: p.name }));
  return [...local, ...extra].slice(0, max);
}

/** « Souvent consultés » sans le titre ni les pairs déjà montrés. */
export function alsoWatchedOf(symbol: string, recommended: string[], peers: SimilarItem[], max = 6): SimilarItem[] {
  const seen = new Set([symbol.toUpperCase(), ...peers.map((p) => p.symbol)]);
  const out: SimilarItem[] = [];
  for (const s of recommended) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push({ symbol: s, name: null });
    if (out.length >= max) break;
  }
  return out;
}
