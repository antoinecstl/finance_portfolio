import Link from 'next/link';
import { Check } from 'lucide-react';
import { type Plan, formatPrice } from '@/lib/plans';

export function PricingCard({ plan, highlight = false }: { plan: Plan; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col ${
        highlight
          ? 'border-blue-600 ring-2 ring-blue-600/20 bg-white dark:bg-zinc-900'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}
    >
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.tagline}</p>
      </div>
      <div className="mb-6">
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{formatPrice(plan)}</span>
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`block w-full py-2.5 px-4 text-center rounded-lg font-medium transition-colors ${
          highlight
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {plan.id === 'free' ? 'Commencer gratuitement' : 'Passer Pro'}
      </Link>
    </div>
  );
}
