// Lecture tolérante de la réponse « chart » du fournisseur de cours, et types
// partagés par les routes /api/market/* et les composants de l'explorateur.

export interface MarketPoint {
  t: number; // secondes Unix
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketDividend {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface MarketSplit {
  date: string;
  ratio: string; // ex. "10:1"
}

export interface MarketMeta {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  instrumentType: string; // EQUITY | ETF | INDEX | CRYPTOCURRENCY | MUTUALFUND | …
  timezone: string;
  regularMarketPrice: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  regularMarketStart: number | null;
  regularMarketEnd: number | null;
}

export interface ParsedChart {
  meta: MarketMeta;
  points: MarketPoint[];
  dividends: MarketDividend[];
  splits: MarketSplit[];
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const isoDate = (unix: number): string => new Date(unix * 1000).toISOString().slice(0, 10);

// Renvoie null si la réponse ne contient aucun résultat exploitable (symbole
// inconnu, format inattendu). Les points sans clôture sont ignorés ; un champ
// OHLC manquant retombe sur la clôture.
export function parseChartResponse(json: unknown, requestedSymbol: string): ParsedChart | null {
  const result = (json as { chart?: { result?: unknown[] } } | null)?.chart?.result?.[0] as
    | {
        meta?: Record<string, unknown>;
        timestamp?: unknown[];
        indicators?: { quote?: Array<Record<string, unknown[] | undefined>> };
        events?: {
          dividends?: Record<string, { amount?: unknown; date?: unknown }>;
          splits?: Record<string, { date?: unknown; numerator?: unknown; denominator?: unknown; splitRatio?: unknown }>;
        };
      }
    | undefined;
  if (!result || !result.meta) return null;

  const meta = result.meta;
  const regular = (meta.currentTradingPeriod as { regular?: { start?: unknown; end?: unknown } } | undefined)?.regular;
  const parsedMeta: MarketMeta = {
    symbol: String(meta.symbol ?? requestedSymbol).toUpperCase(),
    name: String(meta.longName ?? meta.shortName ?? meta.symbol ?? requestedSymbol),
    exchange: String(meta.fullExchangeName ?? meta.exchangeName ?? ''),
    currency: String(meta.currency ?? '').toUpperCase(),
    instrumentType: String(meta.instrumentType ?? ''),
    timezone: String(meta.exchangeTimezoneName ?? 'UTC'),
    regularMarketPrice: num(meta.regularMarketPrice),
    previousClose: num(meta.previousClose) ?? num(meta.chartPreviousClose),
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    fiftyTwoWeekHigh: num(meta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(meta.fiftyTwoWeekLow),
    regularMarketStart: num(regular?.start),
    regularMarketEnd: num(regular?.end),
  };

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const points: MarketPoint[] = [];
  timestamps.forEach((rawT, i) => {
    const t = num(rawT);
    const c = num(quote.close?.[i]);
    if (t === null || c === null) return;
    points.push({
      t,
      c,
      o: num(quote.open?.[i]) ?? c,
      h: num(quote.high?.[i]) ?? c,
      l: num(quote.low?.[i]) ?? c,
      v: num(quote.volume?.[i]) ?? 0,
    });
  });
  points.sort((a, b) => a.t - b.t);

  const dividends: MarketDividend[] = Object.values(result.events?.dividends ?? {})
    .map((d) => ({ t: num(d.date), amount: num(d.amount) }))
    .filter((d): d is { t: number; amount: number } => d.t !== null && d.amount !== null && d.amount > 0)
    .sort((a, b) => a.t - b.t)
    .map((d) => ({ date: isoDate(d.t), amount: d.amount }));

  const splits: MarketSplit[] = Object.values(result.events?.splits ?? {})
    .map((s) => {
      const t = num(s.date);
      const numerator = num(s.numerator);
      const denominator = num(s.denominator);
      const ratio = typeof s.splitRatio === 'string'
        ? s.splitRatio.replace('/', ':')
        : numerator !== null && denominator !== null ? `${numerator}:${denominator}` : null;
      return t !== null && ratio ? { t, ratio } : null;
    })
    .filter((s): s is { t: number; ratio: string } => s !== null)
    .sort((a, b) => a.t - b.t)
    .map((s) => ({ date: isoDate(s.t), ratio: s.ratio }));

  return { meta: parsedMeta, points, dividends, splits };
}
