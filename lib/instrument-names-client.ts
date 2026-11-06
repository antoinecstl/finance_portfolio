'use client';

// Annuaire des noms de titres côté navigateur : alimenté par les cotations et
// les recherches déjà chargées, complété à la demande (un appel groupé pour
// les codes inconnus) et gardé dans le navigateur pour les visites suivantes.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { instrumentName } from './instrument-names';

const STORAGE_KEY = 'fihub_instrument_names_v1';
const names = new Map<string, string>();
const listeners = new Set<() => void>();
// Codes déjà demandés pendant cette visite (succès ou échec) : pas de boucle.
const requested = new Set<string>();
const pending = new Set<string>();
let version = 0;
let loaded = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function loadStored() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    let added = false;
    for (const [symbol, name] of Object.entries(stored)) {
      if (typeof name === 'string' && !names.has(symbol)) {
        names.set(symbol, name);
        added = true;
      }
    }
    if (added) notify();
  } catch {
    // Stockage indisponible (navigation privée) : l'annuaire reste en mémoire.
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(names)));
  } catch {
    // Sans stockage, les noms seront redemandés à la prochaine visite.
  }
}

/** Enregistre des noms connus (cotations, résultats de recherche). */
export function rememberInstrumentNames(entries: Array<{ symbol: string; name?: string | null }>): void {
  loadStored();
  let changed = false;
  for (const entry of entries) {
    const symbol = entry.symbol?.toUpperCase();
    if (!symbol) continue;
    const name = instrumentName(symbol, entry.name);
    if (name && names.get(symbol) !== name) {
      names.set(symbol, name);
      changed = true;
    }
  }
  if (changed) {
    persist();
    notify();
  }
}

async function flush() {
  flushTimer = null;
  const symbols = Array.from(pending).slice(0, 40);
  symbols.forEach((symbol) => pending.delete(symbol));
  if (pending.size > 0) flushTimer = setTimeout(flush, 0);
  if (symbols.length === 0) return;
  try {
    const response = await fetch(`/api/stocks/quotes?symbols=${symbols.map(encodeURIComponent).join(',')}`);
    if (!response.ok) return;
    const data = (await response.json()) as { quotes?: Array<{ symbol: string; name?: string }> };
    rememberInstrumentNames(data.quotes ?? []);
  } catch {
    // Les codes restent affichés ; aucun message : ce n'est qu'un confort.
  }
}

function requestNames(symbols: string[]) {
  for (const symbol of symbols) {
    if (names.has(symbol) || requested.has(symbol)) continue;
    requested.add(symbol);
    pending.add(symbol);
  }
  if (pending.size > 0 && !flushTimer) flushTimer = setTimeout(flush, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getVersion = () => version;
const getServerVersion = () => 0;

/** Noms connus des codes demandés ; les codes inconnus sont recherchés en tâche de fond. */
export function useInstrumentNames(symbols: readonly (string | null | undefined)[]): Record<string, string> {
  const current = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const key = useMemo(
    () => Array.from(new Set(symbols.filter((symbol): symbol is string => Boolean(symbol)).map((symbol) => symbol.toUpperCase()))).sort().join(','),
    [symbols],
  );

  useEffect(() => {
    loadStored();
    if (key) requestNames(key.split(','));
  }, [key]);

  return useMemo(() => {
    const out: Record<string, string> = {};
    if (current === 0 || !key) return out;
    for (const symbol of key.split(',')) {
      const name = names.get(symbol);
      if (name) out[symbol] = name;
    }
    return out;
  }, [key, current]);
}
