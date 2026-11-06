'use client';

// Taux de change côté navigateur. Une requête par jeu de devises et de dates,
// partagée entre composants. Chaque série reçue est gardée dans le navigateur :
// si le service ne répond pas, on reprend le dernier taux connu et on le
// signale. Sans aucun taux, la devise est signalée comme non convertie
// (convertToBase compte alors les montants à 1 pour 1).

import { useSyncExternalStore } from 'react';
import type { FxRateMap } from './fx';
import type { HistoricalQuote } from './stock-api';
import { fetchJsonShared } from './shared-fetch';

const STORAGE_KEY = 'fihub_fx_last_v1';
const MAX_POINTS = 3000;

type StoredSeries = { savedAt: string; points: Array<[string, number]> };
type Stored = Record<string, StoredSeries>;

export type FxStatus = {
  /** Devises valorisées avec le dernier taux connu, et date de ce taux. */
  stale: Array<{ currency: string; savedAt: string }>;
  /** Devises sans aucun taux : montants comptés sans conversion. */
  missing: string[];
};

const stale = new Map<string, string>();
const missing = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: FxStatus = { stale: [], missing: [] };

function publish() {
  snapshot = {
    stale: Array.from(stale, ([currency, savedAt]) => ({ currency, savedAt })).sort((a, b) => a.currency.localeCompare(b.currency)),
    missing: Array.from(missing).sort(),
  };
  listeners.forEach((listener) => listener());
}

function readStored(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function writeStored(stored: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Stockage plein ou indisponible : le secours ne sera pas possible.
  }
}

function remember(rates: FxRateMap, currencies: string[]) {
  const stored = readStored();
  const today = new Date().toISOString().slice(0, 10);
  for (const currency of currencies) {
    const merged = new Map<string, number>(stored[currency]?.points ?? []);
    for (const quote of rates[currency] ?? []) {
      if (quote.close > 0) merged.set(quote.date, quote.close);
    }
    const points = Array.from(merged.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-MAX_POINTS);
    stored[currency] = { savedAt: today, points };
  }
  writeStored(stored);
}

function toQuotes(points: Array<[string, number]>, currency: string): HistoricalQuote[] {
  return points.map(([date, close]) => ({ date, open: close, high: close, low: close, close, volume: 0, adjustedClose: close, currency }));
}

function markLive(currencies: string[]) {
  let changed = false;
  for (const currency of currencies) {
    changed = stale.delete(currency) || changed;
    changed = missing.delete(currency) || changed;
  }
  if (changed) publish();
}

function fallback(currencies: string[]): FxRateMap {
  const stored = readStored();
  const out: FxRateMap = {};
  for (const currency of currencies) {
    const series = stored[currency];
    if (series && series.points.length > 0) {
      out[currency] = toQuotes(series.points, currency);
      stale.set(currency, series.savedAt);
      missing.delete(currency);
    } else {
      missing.add(currency);
      stale.delete(currency);
    }
  }
  if (currencies.length > 0) publish();
  return out;
}

/** Taux EUR → devises entre deux dates ; dernier taux connu si le service échoue. */
export async function fetchFxRates(currencies: string[], startDate: string, endDate: string): Promise<FxRateMap> {
  if (currencies.length === 0) return {};
  const params = new URLSearchParams({ currencies: currencies.join(','), startDate, endDate });
  try {
    const rates = await fetchJsonShared<FxRateMap>(`/api/fx/history?${params.toString()}`);
    const received = currencies.filter((currency) => (rates[currency]?.length ?? 0) > 0);
    remember(rates, received);
    markLive(received);
    const absent = currencies.filter((currency) => !received.includes(currency));
    return absent.length > 0 ? { ...rates, ...fallback(absent) } : rates;
  } catch (error) {
    console.warn('[fx] history fetch failed:', error);
    return fallback(currencies);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const EMPTY_STATUS: FxStatus = { stale: [], missing: [] };
const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY_STATUS;

/** Devises valorisées au dernier taux connu ou sans conversion. */
export function useFxStatus(): FxStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
