'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useStockSearch } from '@/lib/hooks';
import { pushRecent } from '@/lib/market/recents';
import { marketHref } from './format';

// Recherche de l'explorateur (spec F1) : actions, ETF, indices et cryptos.
// Combobox accessible : flèches pour parcourir, Entrée pour ouvrir.
// Avec `onSelect`, le résultat choisi est renvoyé au parent (ajout d'une
// comparaison) au lieu d'ouvrir sa fiche.
export function MarketSearch({
  autoFocus = false,
  size = 'lg',
  onSelect,
  placeholder = 'Air Liquide, CW8, CAC 40, Bitcoin…',
}: {
  autoFocus?: boolean;
  size?: 'lg' | 'sm';
  onSelect?: (pick: { symbol: string; name: string }) => void;
  placeholder?: string;
}) {
  const router = useRouter();
  // Identifiant stable entre rendu serveur et navigateur (au plus un champ de
  // chaque sorte par page : recherche principale, recherche d'en-tête, comparaison).
  const listId = `market-search-${size}-${onSelect ? 'pick' : 'open'}`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { results, loading, search } = useStockSearch({ includeIndices: true });
  const trimmed = query.trim();
  const visible = trimmed.length >= 2 ? results.slice(0, 8) : [];

  useEffect(() => {
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => search(trimmed), 300);
    return () => clearTimeout(timer);
  }, [trimmed, search]);

  const go = (symbol: string, name: string) => {
    setOpen(false);
    setQuery('');
    if (onSelect) {
      onSelect({ symbol, name });
      return;
    }
    pushRecent({ symbol, name });
    router.push(marketHref(symbol));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = visible[active];
      if (pick) go(pick.symbol, pick.name);
      // Symbole tapé tel quel (ex. « AI.PA ») : on tente la fiche directement.
      else if (/^\^?[A-Za-z0-9.\-]{1,15}$/.test(trimmed)) go(trimmed.toUpperCase(), trimmed.toUpperCase());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const large = size === 'lg';
  const showList = open && trimmed.length >= 2;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Search
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 ${large ? 'h-5 w-5' : 'h-4 w-4'}`}
        aria-hidden="true"
      />
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && visible[active] ? `${listId}-${active}` : undefined}
        aria-label="Rechercher un titre, un ETF, un indice ou une crypto"
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-transparent focus:ring-2 focus:ring-[color:var(--accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${
          large ? 'py-3.5 pl-11 pr-10 text-base' : 'py-2 pl-9 pr-8 text-sm'
        }`}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" aria-hidden="true" />
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {visible.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? 'Recherche…' : 'Aucun résultat. Essayez le nom de la société ou son symbole (ex. MC.PA).'}
            </li>
          )}
          {visible.map((r, i) => (
            <li key={r.symbol} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.symbol, r.name)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                  i === active ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium text-zinc-900 dark:text-zinc-100">{r.symbol}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{r.name}</span>
                </span>
                {r.exchange && <span className="shrink-0 text-xs text-zinc-400">{r.exchange}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
