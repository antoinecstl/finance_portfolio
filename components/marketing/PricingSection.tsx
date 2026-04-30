'use client';

import { useState } from 'react';
import { PricingCard } from './PricingCard';
import { PLANS, type BillingInterval, getYearlySavingsPercent } from '@/lib/plans';

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>('year');
  const savings = getYearlySavingsPercent(PLANS.pro);

  return (
    <section
      id="pricing"
      className="max-w-6xl mx-auto px-5 py-16 scroll-mt-20"
      aria-labelledby="pricing-title"
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
        <div className="max-w-2xl">
          <span className="eyebrow">§&nbsp;05 — Tarifs</span>
          <h2
            id="pricing-title"
            className="display text-3xl sm:text-4xl mt-2 leading-tight text-[color:var(--ink)]"
          >
            Tarifs simples
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--ink-2)]">
            Commencez gratuitement, passez Pro quand vous voulez.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-1 p-1 rounded-full border border-[color:var(--rule)] bg-[color:var(--paper-2)]/70">
          <button
            type="button"
            onClick={() => setInterval('month')}
            className={`mono px-4 py-2 text-[11px] tracking-[0.14em] uppercase rounded-full transition-colors ${
              interval === 'month'
                ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setInterval('year')}
            className={`mono px-4 py-2 text-[11px] tracking-[0.14em] uppercase rounded-full transition-colors inline-flex items-center gap-1.5 ${
              interval === 'year'
                ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
            }`}
          >
            Annuel
            {savings !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  interval === 'year'
                    ? 'bg-[color:var(--gain-soft)] text-[color:var(--gain)]'
                    : 'bg-[color:var(--gain-soft)] text-[color:var(--gain)]'
                }`}
              >
                -{savings}%
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px max-w-4xl mx-auto bg-[color:var(--rule)] border border-[color:var(--rule)] rounded-2xl overflow-hidden pop-shadow">
        <PricingCard plan={PLANS.free} interval={interval} />
        <PricingCard plan={PLANS.pro} highlight interval={interval} />
      </div>
    </section>
  );
}
