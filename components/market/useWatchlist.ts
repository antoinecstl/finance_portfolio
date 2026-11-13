'use client';

// Favoris de l'explorateur : une seule liste en mémoire partagée par l'étoile
// des fiches et le bloc « Favoris » de l'accueil Marchés. Ajout et retrait
// s'affichent tout de suite, puis sont annulés si le serveur refuse.

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export interface WatchlistItem {
  symbol: string;
  name: string | null;
  created_at?: string;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';
interface State {
  status: Status;
  items: WatchlistItem[];
  loadedAt: number;
}

const EMPTY: State = { status: 'idle', items: [], loadedAt: 0 };
// Liste rechargée à l'ouverture d'une page si elle date de plus de 30 s
// (autre onglet, autre appareil, changement de compte).
const MAX_AGE_MS = 30_000;

let state: State = EMPTY;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): Promise<void> {
  if (inflight) return inflight;
  if (state.status === 'idle') setState({ ...state, status: 'loading' });
  inflight = fetch('/api/market/watchlist', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { items?: WatchlistItem[] };
      setState({ status: 'ready', items: Array.isArray(json.items) ? json.items : [], loadedAt: Date.now() });
    })
    .catch(() => setState({ ...state, status: state.status === 'ready' ? 'ready' : 'error', loadedAt: Date.now() }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const sameSymbol = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

export type WatchlistResult = { ok: true } | { ok: false; message: string };

async function add(symbol: string, name: string | null): Promise<WatchlistResult> {
  if (state.items.some((i) => sameSymbol(i.symbol, symbol))) return { ok: true };
  const previous = state;
  setState({ ...state, items: [...state.items, { symbol: symbol.toUpperCase(), name }] });
  try {
    const res = await fetch('/api/market/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, name }),
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    setState({ ...state, items: previous.items });
    return { ok: false, message: json.message ?? 'Impossible d’ajouter ce titre aux favoris. Réessayez.' };
  } catch {
    setState({ ...state, items: previous.items });
    return { ok: false, message: 'Impossible d’ajouter ce titre aux favoris. Vérifiez votre connexion.' };
  }
}

async function remove(symbol: string): Promise<WatchlistResult> {
  const removed = state.items.find((i) => sameSymbol(i.symbol, symbol));
  if (!removed) return { ok: true };
  setState({ ...state, items: state.items.filter((i) => i !== removed) });
  try {
    const res = await fetch(`/api/market/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: 'DELETE' });
    if (res.ok) return { ok: true };
  } catch {
    // remis en place ci-dessous
  }
  const index = state.items.findIndex((i) => (i.created_at ?? '') > (removed.created_at ?? ''));
  const items = [...state.items];
  items.splice(index === -1 ? items.length : index, 0, removed);
  setState({ ...state, items });
  return { ok: false, message: 'Impossible de retirer ce titre des favoris. Réessayez.' };
}

export function useWatchlist() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);

  useEffect(() => {
    if (state.status === 'idle' || state.status === 'error' || Date.now() - state.loadedAt > MAX_AGE_MS) void load();
  }, []);

  const has = useCallback((symbol: string) => snapshot.items.some((i) => sameSymbol(i.symbol, symbol)), [snapshot.items]);

  return {
    items: snapshot.items,
    /** La liste a été chargée au moins une fois. */
    ready: snapshot.status === 'ready',
    failed: snapshot.status === 'error',
    has,
    add,
    remove,
    reload: load,
  };
}
