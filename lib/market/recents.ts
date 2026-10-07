// Recherches récentes de l'explorateur de marchés : préférence locale du
// navigateur (spec F2). Toute erreur de stockage est ignorée.

export interface RecentSymbol {
  symbol: string;
  name: string;
}

const KEY = 'fihub:market:recents';
export const MAX_RECENTS = 6;
// Émis après chaque écriture, pour que les composants abonnés se mettent à jour.
export const RECENTS_EVENT = 'fihub:market-recents';

export function readRecents(storage: Pick<Storage, 'getItem'> | null = safeStorage()): RecentSymbol[] {
  try {
    return parseRecents(storage?.getItem(KEY) ?? null);
  } catch {
    return [];
  }
}

// Valeur brute (chaîne stable) pour useSyncExternalStore.
export function recentsSnapshot(): string {
  try {
    return safeStorage()?.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function parseRecents(raw: string | null): RecentSymbol[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((r): r is RecentSymbol => typeof r?.symbol === 'string' && typeof r?.name === 'string')
          .slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export function pushRecent(
  entry: RecentSymbol,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()
): RecentSymbol[] {
  const next = [entry, ...readRecents(storage).filter((r) => r.symbol !== entry.symbol)].slice(0, MAX_RECENTS);
  try {
    storage?.setItem(KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(RECENTS_EVENT));
  } catch {
    // Stockage indisponible (navigation privée, quota) : on garde l'ordre en mémoire seulement.
  }
  return next;
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
