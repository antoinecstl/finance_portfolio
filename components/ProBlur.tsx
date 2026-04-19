'use client';

import Link from 'next/link';
import { Sparkles, Lock } from 'lucide-react';
import { useSubscription } from '@/lib/subscription-client';
import { type Feature } from '@/lib/plans';
import { type ReactNode } from 'react';

type ProBlurProps = {
  children: ReactNode;
  feature?: Feature;
  partial?: boolean;
  label?: string;
  className?: string;
};

export function ProBlur({
  children,
  feature = 'advanced_analytics',
  partial = false,
  label = 'Passez Pro pour débloquer',
  className = '',
}: ProBlurProps) {
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  const blurClass = partial ? 'blur-sm' : 'blur-md';

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${blurClass} select-none pointer-events-none transition`}
        aria-hidden="true"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg p-4 sm:p-6 max-w-xs text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-2">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            {label}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Analyses avancées, historique complet, export CSV…
          </p>
          <Link
            href="/settings/billing"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
          >
            Passer Pro — 4,99 € / mois
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProCellBlur({
  children,
  label = 'Pro',
}: {
  children: ReactNode;
  label?: string;
}) {
  const { hasFeature } = useSubscription();

  if (hasFeature('advanced_analytics')) {
    return <>{children}</>;
  }

  return (
    <span className="inline-flex items-center gap-1 relative">
      <span className="blur-sm select-none" aria-hidden="true">
        {children}
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-blue-600 dark:text-blue-400"
        title="Fonctionnalité Pro"
      >
        <Lock className="h-3 w-3 mr-0.5" />
        {label}
      </span>
    </span>
  );
}
