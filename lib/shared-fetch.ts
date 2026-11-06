'use client';

// Requêtes JSON partagées entre composants : une même URL demandée plusieurs
// fois en même temps (ou dans la minute) ne part qu'une fois. Les échecs ne
// restent pas en cache. Le bouton « Rafraîchir » vide le cache et incrémente
// une époque que les hooks de données suivent pour tout recharger.

import { useSyncExternalStore } from 'react';

export class SharedFetchError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
    this.name = 'SharedFetchError';
  }
}

const DEFAULT_TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

export function fetchJsonShared<T>(url: string, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.at < ttlMs) return hit.promise as Promise<T>;
  const promise = fetch(url).then(async (response) => {
    if (!response.ok) throw new SharedFetchError(response.status);
    return (await response.json()) as T;
  });
  cache.set(url, { at: now, promise });
  promise.catch(() => {
    if (cache.get(url)?.promise === promise) cache.delete(url);
  });
  return promise;
}

let epoch = 0;
const listeners = new Set<() => void>();

/** Vide le cache et demande aux hooks de données de recharger. */
export function refreshSharedData(): void {
  cache.clear();
  epoch += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getEpoch = () => epoch;
const getServerEpoch = () => 0;

/** Époque de rafraîchissement : à mettre dans les dépendances des chargements. */
export function useRefreshEpoch(): number {
  return useSyncExternalStore(subscribe, getEpoch, getServerEpoch);
}
