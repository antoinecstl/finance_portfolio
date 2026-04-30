'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from './faq-data';

export { FAQ_ITEMS } from './faq-data';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="max-w-6xl mx-auto px-5 py-16 scroll-mt-20"
      aria-labelledby="faq-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <span className="eyebrow">§&nbsp;06 — FAQ</span>
          <h2
            id="faq-title"
            className="display text-3xl sm:text-4xl mt-2 leading-tight text-[color:var(--ink)]"
          >
            Questions fréquentes
          </h2>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-px bg-[color:var(--rule)] border border-[color:var(--rule)] rounded-2xl overflow-hidden pop-shadow">
        {FAQ_ITEMS.map((it, i) => (
          <div key={it.q} className="bg-[color:var(--paper)]">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              aria-controls={`faq-panel-${i}`}
              className="w-full flex items-center justify-between gap-5 p-5 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-medium leading-snug text-[color:var(--ink)]">
                  {it.q}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[color:var(--ink-soft)] transition-transform ${
                  open === i ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            {open === i && (
              <div
                id={`faq-panel-${i}`}
                className="px-5 pb-5 sm:pl-[4.5rem] text-sm leading-relaxed text-[color:var(--ink-2)]"
              >
                {it.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
