'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { PLANS, formatPriceFor, getYearlySavingsPercent, type BillingInterval } from '@/lib/plans';

export type LimitScope = 'accounts' | 'transactions' | 'positions';

type LimitDetails = {
  scope: LimitScope;
  current?: number;
  max?: number;
  reason?: 'reached' | 'blocked';
};

type LimitReachedContextValue = {
  show: (details: LimitDetails) => void;
};

const LimitReachedContext = createContext<LimitReachedContextValue | undefined>(undefined);

const SCOPE_COPY: Record<
  LimitScope,
  { title: string; body: (limit: number) => string; label: string }
> = {
  accounts: {
    title: 'Limite de comptes atteinte',
    body: (n) =>
      `Le plan Free autorise ${n} compte. Passez Pro pour connecter tous vos PEA, CTO, livrets et assurances-vie.`,
    label: 'comptes',
  },
  transactions: {
    title: 'Limite de transactions atteinte',
    body: (n) =>
      `Vous avez atteint le cap de ${n} transactions sur votre plan Free. Pro débloque l'historique illimité.`,
    label: 'transactions',
  },
  positions: {
    title: 'Limite de positions atteinte',
    body: (n) =>
      `Vous avez ${n} positions, le maximum du plan Free. Passez Pro pour suivre autant de lignes que vous voulez.`,
    label: 'positions',
  },
};

export function LimitReachedProvider({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState<LimitDetails | null>(null);
  const [interval, setInterval] = useState<BillingInterval>('month');

  const show = useCallback((d: LimitDetails) => setDetails(d), []);
  const close = useCallback(() => setDetails(null), []);

  // Escape key to close.
  useEffect(() => {
    if (!details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [details, close]);

  const value = useMemo<LimitReachedContextValue>(() => ({ show }), [show]);

  return (
    <LimitReachedContext.Provider value={value}>
      {children}
      {details && (
        <LimitReachedOverlay
          details={details}
          interval={interval}
          onIntervalChange={setInterval}
          onClose={close}
        />
      )}
    </LimitReachedContext.Provider>
  );
}

function LimitReachedOverlay({
  details,
  interval,
  onIntervalChange,
  onClose,
}: {
  details: LimitDetails;
  interval: BillingInterval;
  onIntervalChange: (i: BillingInterval) => void;
  onClose: () => void;
}) {
  const pro = PLANS.pro;
  const copy = SCOPE_COPY[details.scope];
  const limitValue = details.max ?? PLANS.free[
    details.scope === 'accounts'
      ? 'maxAccounts'
      : details.scope === 'transactions'
        ? 'maxTransactions'
        : 'maxPositions'
  ];
  const savings = getYearlySavingsPercent(pro);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-lg mx-0 sm:mx-4 bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-3">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {copy.title}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {copy.body(limitValue)}
          </p>
          {typeof details.current === 'number' && Number.isFinite(limitValue) && (
            <div className="mt-3">
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width: `${Math.min(100, Math.round((details.current / limitValue) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {details.current} / {limitValue} {copy.label}
              </p>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Fi-Hub Pro
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{pro.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatPriceFor(pro, interval)}
              </p>
              {interval === 'year' && pro.priceCentsYearly && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  soit {(pro.priceCentsYearly / 12 / 100).toFixed(2).replace('.', ',')} € / mois
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => onIntervalChange('month')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  interval === 'month'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => onIntervalChange('year')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors inline-flex items-center gap-1 ${
                  interval === 'year'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Annuel
                <span className="text-[9px] font-semibold px-1 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Recommandé
                </span>
                {savings !== null && (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    -{savings}%
                  </span>
                )}
              </button>
            </div>
          </div>

          <ul className="space-y-2 mb-5">
            {pro.highlights.map((h) => (
              <li
                key={h}
                className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href={`/settings/billing?interval=${interval}`}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              onClick={onClose}
            >
              Passer Pro
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function useLimitReached(): LimitReachedContextValue {
  const ctx = useContext(LimitReachedContext);
  if (!ctx) {
    throw new Error('useLimitReached must be used within LimitReachedProvider');
  }
  return ctx;
}
