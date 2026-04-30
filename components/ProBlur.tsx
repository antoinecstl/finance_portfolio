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
  fallback?: ReactNode;
};

// Fake placeholder rendered in place of real content for Free users.
// Real children are never sent to the client so DevTools can't bypass the blur.
function DefaultPlaceholder({ partial }: { partial?: boolean }) {
  const height = partial ? 'h-64 sm:h-80' : 'h-80 sm:h-96';
  return (
    <div
      className={`bg-[color:var(--paper-2)] rounded-xl border border-[color:var(--rule)] p-4 sm:p-6 ${height}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-4 rounded bg-[color:var(--rule)]" />
        <div className="h-4 w-40 rounded bg-[color:var(--rule)]" />
      </div>
      <div className="h-[calc(100%-2rem)] flex items-end gap-2">
        {[40, 65, 35, 80, 55, 70, 45, 90, 60, 50, 75, 40].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[color:var(--accent-soft)]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ProBlur({
  children,
  feature = 'advanced_analytics',
  partial = false,
  label = 'Passez Pro pour débloquer',
  className = '',
  fallback,
}: ProBlurProps) {
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  const blurClass = partial ? 'blur-sm' : 'blur-md';
  const placeholder = fallback ?? <DefaultPlaceholder partial={partial} />;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${blurClass} select-none pointer-events-none transition`}
        aria-hidden="true"
      >
        {placeholder}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="ink-card pop-shadow backdrop-blur rounded-xl p-4 sm:p-6 max-w-xs text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent)] mb-2">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-[color:var(--ink)] mb-1">
            {label}
          </p>
          <p className="text-xs text-[color:var(--ink-soft)] mb-3">
            Analyses avancées, historique complet, export CSV…
          </p>
          <Link
            href="/settings/billing"
            className="btn-ink inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition"
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

  // Replace real content with a neutral dash so DevTools can't reveal the value.
  return (
    <span className="inline-flex items-center gap-1 relative">
      <span className="blur-sm select-none text-[color:var(--ink-soft)]" aria-hidden="true">
        ———
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-[color:var(--accent)]"
        title="Fonctionnalité Pro"
      >
        <Lock className="h-3 w-3 mr-0.5" />
        {label}
      </span>
    </span>
  );
}
