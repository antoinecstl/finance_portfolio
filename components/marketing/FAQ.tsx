import { ChevronDown } from 'lucide-react';
import { FAQ_ITEMS } from './faq-data';

export { FAQ_ITEMS } from './faq-data';

export function FAQ() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-[color:var(--border)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:py-24">
        <h2
          id="faq-title"
          className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:col-span-4 lg:text-4xl"
        >
          Questions fréquentes
        </h2>

        <div className="border-t border-[color:var(--text)] lg:col-span-8">
          {FAQ_ITEMS.map((it) => (
            <details key={it.q} className="group border-b border-[color:var(--border)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left text-base font-medium leading-snug text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                {it.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition-transform duration-200 group-open:rotate-180"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-[68ch] pb-5 text-[15px] leading-relaxed text-[color:var(--text-2)]">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
