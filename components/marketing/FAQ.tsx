'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from './faq-data';

export { FAQ_ITEMS } from './faq-data';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="max-w-3xl mx-auto px-4 py-16" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-10">
        Questions fréquentes
      </h2>
      <div className="space-y-2">
        {FAQ_ITEMS.map((it, i) => (
          <div
            key={it.q}
            className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              aria-controls={`faq-panel-${i}`}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{it.q}</span>
              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition-transform ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            {open === i && (
              <div id={`faq-panel-${i}`} className="px-4 pb-4 text-sm text-zinc-600 dark:text-zinc-400">{it.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
