import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import {
  type BillingInterval,
  type Plan,
  formatPrice,
  formatPriceFor,
  getYearlySavingsPercent,
} from '@/lib/plans';

export function PricingCard({
  plan,
  highlight = false,
  interval = 'month',
}: {
  plan: Plan;
  highlight?: boolean;
  interval?: BillingInterval;
}) {
  const isPro = plan.id === 'pro';
  const priceLabel = isPro ? formatPriceFor(plan, interval) : formatPrice(plan);
  const savings = isPro && interval === 'year' ? getYearlySavingsPercent(plan) : null;
  const showPopular = highlight && interval === 'year';
  const monthlyEquivalent =
    isPro && interval === 'year' && plan.priceCentsYearly
      ? (plan.priceCentsYearly / 12 / 100).toFixed(2).replace('.', ',')
      : null;

  return (
    <article className="relative bg-[color:var(--paper)] p-7 sm:p-8 flex flex-col min-h-full">
      {showPopular && (
        <span
          className="absolute right-5 top-5 mono text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-sm"
          style={{ background: 'var(--accent)', color: 'var(--paper)' }}
        >
          Populaire
        </span>
      )}

      <div className={`mb-5 ${showPopular ? 'pr-24' : ''}`}>
        <span className="mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--ink-soft)]">
          {plan.id === 'free' ? '01' : '02'}
        </span>
        <h3 className="display text-2xl mt-2 leading-tight text-[color:var(--ink)]">
          {plan.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
          {plan.tagline}
        </p>
      </div>

      <div className="mb-7 pb-6 border-b border-[color:var(--rule)]">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="display text-4xl leading-none text-[color:var(--ink)]">
            {priceLabel}
          </span>
          {savings !== null && (
            <span className="mono text-[10px] tracking-[0.14em] uppercase px-2 py-1 rounded-full bg-[color:var(--gain-soft)] text-[color:var(--gain)]">
              -{savings}%
            </span>
          )}
        </div>
        {monthlyEquivalent && (
          <p className="mono text-[11px] text-[color:var(--ink-soft)] mt-2">
            Soit {monthlyEquivalent} € / mois facturés annuellement
          </p>
        )}
      </div>

      <ul className="space-y-2.5 mb-7 flex-1">
        {plan.highlights.map((h) => (
          <li
            key={h}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-[color:var(--ink-2)]"
          >
            <Check
              className="h-4 w-4 shrink-0 mt-0.5"
              style={{ color: 'var(--gain)' }}
              aria-hidden="true"
            />
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={`inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-medium ${
          highlight ? 'btn-ink' : 'btn-outline'
        }`}
      >
        {plan.id === 'free' ? 'Commencer gratuitement' : 'Passer Pro'}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
