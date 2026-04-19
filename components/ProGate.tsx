'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useSubscription } from '@/lib/subscription-client';
import { type Feature } from '@/lib/plans';
import { type ReactNode } from 'react';

type ProGateProps = {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
};

export function ProGate({ feature, children, fallback }: ProGateProps) {
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 p-4 sm:p-6 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white mb-2">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Fonctionnalité Pro
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        Passez Pro pour accéder à cette fonctionnalité.
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
      >
        Passer Pro
      </Link>
    </div>
  );
}
