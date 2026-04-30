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
    <div className="rounded-xl border border-dashed border-[color:var(--accent)] bg-[color:var(--accent-soft)] p-4 sm:p-6 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--paper)] text-[color:var(--accent)] mb-2">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-[color:var(--ink)] mb-1">
        Fonctionnalité Pro
      </p>
      <p className="text-xs text-[color:var(--ink-soft)] mb-3">
        Passez Pro pour accéder à cette fonctionnalité.
      </p>
      <Link
        href="/settings/billing"
        className="btn-ink inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition"
      >
        Passer Pro
      </Link>
    </div>
  );
}
