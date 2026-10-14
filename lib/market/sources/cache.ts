// Cache des données de marché calculées (docs/specs/explorateur-marches-v2.md §7) :
// mémoire de l'instance, puis table `market_data_cache` partagée par toutes les
// instances. Si la source échoue, la dernière copie valide est servie (marquée
// `stale`). Sans la table, tout fonctionne avec la mémoire seule.

import { createAdminClient } from '@/lib/supabase/server';

export interface CacheEntry<T> {
  data: T;
  /** Date de récupération à la source (ms). */
  fetchedAt: number;
  /** Copie de secours : la source n'a pas répondu. */
  stale: boolean;
}

export interface CacheWindow {
  /** Au-delà, on retourne à la source. */
  freshMs: number;
  /** Au-delà, la copie n'est plus servie même en cas de panne. */
  staleMs: number;
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const TABLE = 'market_data_cache';
const MEMORY_MAX = 400;
const memory = new Map<string, { data: unknown; fetchedAt: number }>();
const inflight = new Map<string, Promise<CacheEntry<unknown> | null>>();
let dbDisabledUntil = 0;

function remember(key: string, data: unknown, fetchedAt: number) {
  memory.delete(key);
  memory.set(key, { data, fetchedAt });
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value as string);
}

function dbAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) && Date.now() >= dbDisabledUntil;
}

function disableDb(error: unknown) {
  // Table absente (migration non appliquée) ou base indisponible : mémoire seule pendant 5 min.
  if (Date.now() >= dbDisabledUntil) console.warn('[market-cache] persistent cache unavailable, memory only', error);
  dbDisabledUntil = Date.now() + 5 * 60_000;
}

async function readDb(key: string): Promise<{ data: unknown; fetchedAt: number } | null> {
  if (!dbAvailable()) return null;
  try {
    const db = await createAdminClient();
    const { data, error } = await db.from(TABLE).select('payload, fetched_at').eq('key', key).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const fetchedAt = Date.parse(String(data.fetched_at));
    return Number.isFinite(fetchedAt) ? { data: data.payload, fetchedAt } : null;
  } catch (error) {
    disableDb(error);
    return null;
  }
}

async function writeDb(key: string, data: unknown, fetchedAt: number): Promise<void> {
  if (!dbAvailable()) return;
  try {
    const db = await createAdminClient();
    const { error } = await db
      .from(TABLE)
      .upsert({ key, payload: data, fetched_at: new Date(fetchedAt).toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    // Ménage occasionnel des fiches plus consultées depuis 6 mois.
    if (Math.random() < 0.01) {
      await db.from(TABLE).delete().lt('fetched_at', new Date(Date.now() - 180 * DAY).toISOString());
    }
  } catch (error) {
    disableDb(error);
  }
}

/**
 * Donnée en cache si elle est fraîche, sinon `load()` ; si `load()` lève une
 * erreur, la dernière copie encore dans `staleMs`. `null` si rien n'est
 * disponible. Une seule exécution de `load()` à la fois par clé et par instance.
 */
export async function cached<T>(key: string, window: CacheWindow, load: () => Promise<T>): Promise<CacheEntry<T> | null> {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && now - mem.fetchedAt < window.freshMs) return { data: mem.data as T, fetchedAt: mem.fetchedAt, stale: false };

  const pending = inflight.get(key);
  if (pending) return pending as Promise<CacheEntry<T> | null>;

  const task = (async (): Promise<CacheEntry<unknown> | null> => {
    let copy = mem ?? null;
    const row = await readDb(key);
    if (row && (!copy || row.fetchedAt > copy.fetchedAt)) copy = row;
    if (copy && Date.now() - copy.fetchedAt < window.freshMs) {
      remember(key, copy.data, copy.fetchedAt);
      return { data: copy.data, fetchedAt: copy.fetchedAt, stale: false };
    }
    try {
      const data = await load();
      const fetchedAt = Date.now();
      remember(key, data, fetchedAt);
      await writeDb(key, data, fetchedAt);
      return { data, fetchedAt, stale: false };
    } catch (error) {
      console.warn(`[market-cache] ${key}: source failed`, error instanceof Error ? error.message : error);
      if (copy && Date.now() - copy.fetchedAt < window.staleMs) {
        remember(key, copy.data, copy.fetchedAt);
        return { data: copy.data, fetchedAt: copy.fetchedAt, stale: true };
      }
      return null;
    }
  })();

  inflight.set(key, task);
  try {
    return (await task) as CacheEntry<T> | null;
  } finally {
    inflight.delete(key);
  }
}

/** Pour les tests. */
export function resetMarketCache() {
  memory.clear();
  inflight.clear();
  dbDisabledUntil = 0;
}
