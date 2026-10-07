'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { RECENTS_EVENT, parseRecents, recentsSnapshot, type RecentSymbol } from '@/lib/market/recents';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(RECENTS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(RECENTS_EVENT, onChange);
  };
}

// Recherches récentes, lues dans le navigateur uniquement (vide au rendu serveur).
export function useRecents(): RecentSymbol[] {
  const raw = useSyncExternalStore(subscribe, recentsSnapshot, () => '');
  return useMemo(() => parseRecents(raw || null), [raw]);
}
