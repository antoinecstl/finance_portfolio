// Appels aux sources de données de marché (docs/specs/explorateur-marches-v2.md §7) :
// délai maximum, une nouvelle tentative sur erreur passagère, disjoncteur par
// source. Aucun cache ici : voir ./cache.ts.

export type SourceName = 'provider' | 'sec';

export interface FetchJsonOptions {
  source: SourceName;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Nouvelles tentatives sur erreur réseau, 429 ou 5xx (1 par défaut). */
  retries?: number;
}

export type FetchJsonResult =
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number | null; reason: 'not_found' | 'http' | 'network' | 'invalid_json' | 'circuit_open' };

const FAILURE_THRESHOLD = 5;
const OPEN_MS = 60_000;

const breakers = new Map<SourceName, { failures: number; openUntil: number }>();

function breaker(source: SourceName) {
  let state = breakers.get(source);
  if (!state) {
    state = { failures: 0, openUntil: 0 };
    breakers.set(source, state);
  }
  return state;
}

/** Source en pause après des échecs répétés : on répond tout de suite depuis le cache. */
export function isCircuitOpen(source: SourceName, now = Date.now()): boolean {
  return breaker(source).openUntil > now;
}

function recordSuccess(source: SourceName) {
  const state = breaker(source);
  state.failures = 0;
  state.openUntil = 0;
}

function recordFailure(source: SourceName, now = Date.now()) {
  const state = breaker(source);
  state.failures += 1;
  if (state.failures >= FAILURE_THRESHOLD) {
    state.openUntil = now + OPEN_MS;
    state.failures = 0;
    console.warn(`[market] source ${source} paused for ${OPEN_MS / 1000}s after repeated failures`);
  }
}

/** Pour les tests. */
export function resetCircuits() {
  breakers.clear();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const transient = (status: number) => status === 429 || status >= 500;

/**
 * GET JSON tolérant aux pannes. Un 404 n'est pas une panne de la source (symbole
 * inconnu) : il ne compte pas pour le disjoncteur.
 */
export async function fetchJson(url: string, options: FetchJsonOptions): Promise<FetchJsonResult> {
  const { source, headers = {}, timeoutMs = 8_000, retries = 1 } = options;
  if (isCircuitOpen(source)) return { ok: false, status: null, reason: 'circuit_open' };

  let lastStatus: number | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(300 + Math.floor(Math.random() * 500));
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastStatus = response.status;
      if (response.status === 404) {
        recordSuccess(source);
        return { ok: false, status: 404, reason: 'not_found' };
      }
      if (!response.ok) {
        if (transient(response.status) && attempt < retries) continue;
        if (transient(response.status)) recordFailure(source);
        return { ok: false, status: response.status, reason: 'http' };
      }
      try {
        const json = await response.json();
        recordSuccess(source);
        return { ok: true, status: response.status, json };
      } catch {
        recordFailure(source);
        return { ok: false, status: response.status, reason: 'invalid_json' };
      }
    } catch {
      if (attempt < retries) continue;
      recordFailure(source);
      return { ok: false, status: lastStatus, reason: 'network' };
    }
  }
  return { ok: false, status: lastStatus, reason: 'network' };
}
