'use client';

import { useState } from 'react';
import { PricingCard } from './PricingCard';
import { PLANS, type BillingInterval, getYearlySavingsPercent } from '@/lib/plans';

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const savings = getYearlySavingsPercent(PLANS.pro);

  return (
    <section id="pricing" className="max-w-5xl mx-auto px-4 py-16 scroll-mt-20">
      <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-4">
        Tarifs simples
      </h2>
      <p className="text-center text-zinc-600 dark:text-zinc-400 mb-8">
        Commencez gratuitement, passez Pro quand vous voulez.
      </p>

      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-1 p-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setInterval('month')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              interval === 'month'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setInterval('year')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors inline-flex items-center gap-1.5 ${
              interval === 'year'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Annuel
            {savings !== null && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  interval === 'year'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                -{savings}%
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <PricingCard plan={PLANS.free} interval={interval} />
        <PricingCard plan={PLANS.pro} highlight interval={interval} />
      </div>
    </section>
  );
}
