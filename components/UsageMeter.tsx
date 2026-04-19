'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useSubscription } from '@/lib/subscription-client';

type UsageMeterProps = {
  label: string;
  current: number;
  max: number;
  className?: string;
};

export function UsageMeter({ label, current, max, className = '' }: UsageMeterProps) {
  const { isPro } = useSubscription();

  if (isPro || !Number.isFinite(max)) {
    return null;
  }

  const pct = Math.min(100, Math.round((current / max) * 100));
  const warn = pct >= 80;
  const full = current >= max;

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        full
          ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20'
          : warn
            ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20'
            : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            full ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {warn && (
        <Link
          href="/settings/billing"
          className="mt-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Sparkles className="h-3 w-3" />
          Passer Pro pour des {label.toLowerCase()} illimité·e·s
        </Link>
      )}
    </div>
  );
}
