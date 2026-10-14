'use client';

import { TAB_LABELS, type MarketTab } from '@/lib/market/asset-class';

/** Onglets de la fiche valeur, adaptés au type d'actif ; défilement horizontal sur mobile. */
export function MarketTabs({ tabs, active, onChange }: { tabs: MarketTab[]; active: MarketTab; onChange: (tab: MarketTab) => void }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Sections de la fiche" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const on = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              aria-current={on ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-2 py-2 text-sm transition-colors sm:px-3 ${
                on
                  ? 'border-[color:var(--ink)] font-medium text-zinc-900 dark:text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
