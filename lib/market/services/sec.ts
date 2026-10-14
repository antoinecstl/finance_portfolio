import 'server-only';
import { parseCompanyFacts, parseCompanyTickers, type SecFacts } from '../sources/sec';
import { fetchJson } from '../sources/resilient-fetch';
import { cached, DAY, HOUR } from '../sources/cache';

const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const factsUrl = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;

let warnedUserAgent = false;

// La SEC exige un User-Agent nommant l'application et un contact
// (https://www.sec.gov/os/accessing-edgar-data). À renseigner sur Vercel.
function secHeaders(): Record<string, string> {
  const userAgent = process.env.SEC_USER_AGENT?.trim();
  if (!userAgent && !warnedUserAgent) {
    warnedUserAgent = true;
    console.warn('[sec] SEC_USER_AGENT is not set; EDGAR may refuse requests without a contact email');
  }
  return { 'User-Agent': userAgent || 'Fi-Hub (https://fi-hub.subleet.com)' };
}

async function tickerMap() {
  return cached<Record<string, string>>('sec:tickers:v1', { freshMs: 7 * DAY, staleMs: 90 * DAY }, async () => {
    const res = await fetchJson(TICKERS_URL, { source: 'sec', headers: secHeaders(), timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`tickers ${res.reason} ${res.status ?? ''}`);
    const map = parseCompanyTickers(res.json);
    if (Object.keys(map).length < 1000) throw new Error('tickers: unexpected format');
    return map;
  });
}

export type SecAnnual =
  | { status: 'ok'; facts: SecFacts; fetchedAt: number; stale: boolean }
  | { status: 'not_covered' }
  | { status: 'unavailable' };

/** Comptes annuels officiels d'une société américaine (15 exercices au plus). */
export async function getSecAnnual(symbol: string): Promise<SecAnnual> {
  const map = await tickerMap();
  if (!map) return { status: 'unavailable' };
  const cik = map.data[symbol.toUpperCase()];
  if (!cik) return { status: 'not_covered' };

  const entry = await cached<SecFacts>(`sec:facts:v1:${cik}`, { freshMs: 24 * HOUR, staleMs: 90 * DAY }, async () => {
    const res = await fetchJson(factsUrl(cik), { source: 'sec', headers: secHeaders(), timeoutMs: 15_000 });
    if (res.ok) return parseCompanyFacts(res.json);
    if (res.reason === 'not_found') return { name: null, rows: [] };
    throw new Error(`companyfacts ${res.reason} ${res.status ?? ''}`);
  });
  if (!entry) return { status: 'unavailable' };
  if (entry.data.rows.length === 0) return { status: 'not_covered' };
  return { status: 'ok', facts: entry.data, fetchedAt: entry.fetchedAt, stale: entry.stale };
}
