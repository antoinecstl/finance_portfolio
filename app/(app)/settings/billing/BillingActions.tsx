'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProOnboarding } from '@/components/ProOnboarding';
import { PLANS, formatPriceFor, getYearlySavingsPercent, type BillingInterval } from '@/lib/plans';

type PaddleCheckoutOpen = (opts: {
  items: { priceId: string; quantity: number }[];
  customer?: { email: string };
  customData?: Record<string, string>;
  settings?: { displayMode?: 'overlay' | 'inline'; theme?: 'light' | 'dark' };
}) => void;

type PaddleEvent = { name: string; data?: unknown };

type PaddleGlobal = {
  Environment: { set: (env: 'sandbox' | 'production') => void };
  Initialize: (opts: { token: string; eventCallback?: (ev: PaddleEvent) => void }) => void;
  Checkout: { open: PaddleCheckoutOpen; close?: () => void };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_DURATION_MS = 10 * 60 * 1000;

export function BillingActions({
  planId,
  userId,
  email,
  isFounder,
}: {
  planId: 'free' | 'pro';
  userId: string;
  email: string;
  isFounder: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialInterval = useMemo<BillingInterval>(() => {
    return searchParams.get('interval') === 'year' ? 'year' : 'month';
  }, [searchParams]);

  const [paddleReady, setPaddleReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [celebrating, setCelebrating] = useState(false);
  const [polling, setPolling] = useState(false);
  const celebratingRef = useRef(false);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const monthlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID;
  const yearlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID;
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV ?? 'sandbox';

  const savings = getYearlySavingsPercent(PLANS.pro);

  const startCelebration = useCallback(() => {
    if (celebratingRef.current) return;
    celebratingRef.current = true;
    try {
      window.Paddle?.Checkout?.close?.();
    } catch {
      /* noop */
    }
    setPolling(false);
    setCelebrating(true);
    // Refresh server-rendered subscription state in the background so when the
    // onboarding closes, the page already reflects the Pro plan.
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Paddle) {
      setPaddleReady(true);
    }
  }, []);

  useEffect(() => {
    if (!paddleReady || !window.Paddle || !clientToken) return;
    if (env !== 'production') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: clientToken,
      eventCallback: (ev) => {
        if (ev.name === 'checkout.completed') {
          startCelebration();
        }
      },
    });
  }, [paddleReady, clientToken, env, startCelebration]);

  // Polling fallback: once a checkout is opened, poll the server until the
  // subscription flips to 'pro'. This guarantees the celebration triggers even
  // if Paddle's checkout.completed event is missed (ad-blockers, network, etc.).
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { planId?: string };
          if (data.planId === 'pro') {
            startCelebration();
            return;
          }
        }
      } catch {
        /* swallow transient errors and retry */
      }
      if (cancelled) return;
      if (Date.now() - startedAt > POLL_MAX_DURATION_MS) {
        setPolling(false);
        return;
      }
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    let timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [polling, startCelebration]);

  const handleUpgrade = () => {
    const priceId = interval === 'year' ? yearlyPriceId : monthlyPriceId;
    if (!window.Paddle || !priceId) {
      setError(
        interval === 'year'
          ? 'Paddle non configuré (NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID manquant)'
          : 'Paddle non configuré (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN / PRICE_ID manquants)'
      );
      return;
    }
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { user_id: userId },
    });
    setPolling(true);
  };

  const handleManage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'portal_error');
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setLoading(false);
    }
  };

  const handleOnboardingClose = () => {
    setCelebrating(false);
    // Hard reload as a fallback in case anything is cached and the user stays
    // on the billing page after closing the onboarding.
    setTimeout(() => router.refresh(), 100);
  };

  if (isFounder) {
    return (
      <p className="text-sm text-zinc-500">
        Accès Pro à vie (statut fondateur). Pas de facturation active.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => setPaddleReady(true)}
        onReady={() => setPaddleReady(true)}
        onError={() => setError('Impossible de charger Paddle (bloqueur de pub ?)')}
      />

      {celebrating && <ProOnboarding onClose={handleOnboardingClose} />}

      <div className="space-y-4">
        {planId === 'free' && (
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Cycle de facturation</p>
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
                Mensuel — {formatPriceFor(PLANS.pro, 'month')}
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
                Annuel — {formatPriceFor(PLANS.pro, 'year')}
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
        )}

        <div className="flex gap-3 flex-wrap">
          {planId === 'free' ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUpgrade}
                disabled={!paddleReady}
                className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg w-fit"
              >
                {!paddleReady && <Loader2 className="h-4 w-4 animate-spin" />}
                Passer Pro — {formatPriceFor(PLANS.pro, interval)}
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Les factures seront envoyées à l&apos;adresse email indiquée lors du paiement.
              </p>
            </div>
          ) : (
            <button
              onClick={handleManage}
              disabled={loading}
              className="inline-flex items-center gap-2 py-2.5 px-5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium rounded-lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Gérer mon abonnement
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </>
  );
}
