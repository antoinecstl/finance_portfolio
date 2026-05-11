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

type PaddleClientConfig = {
  clientToken: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  environment: 'sandbox' | 'production';
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_DURATION_MS = 10 * 60 * 1000;
const PADDLE_SDK_READY_TIMEOUT_MS = 10000;
const PADDLE_SDK_READY_POLL_MS = 100;
type PaddleLoadState = 'loading' | 'ready' | 'error';

export function BillingActions({
  planId,
  userId,
  email,
  isFounder,
  paddleConfig,
}: {
  planId: 'free' | 'pro';
  userId: string;
  email: string;
  isFounder: boolean;
  paddleConfig: PaddleClientConfig;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialInterval = useMemo<BillingInterval>(() => {
    return searchParams.get('interval') === 'year' ? 'year' : 'month';
  }, [searchParams]);

  const [paddleReady, setPaddleReady] = useState(false);
  const [paddleLoadState, setPaddleLoadState] = useState<PaddleLoadState>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [celebrating, setCelebrating] = useState(false);
  const [polling, setPolling] = useState(false);
  const celebratingRef = useRef(false);

  const clientToken = paddleConfig.clientToken;
  const monthlyPriceId = paddleConfig.monthlyPriceId;
  const yearlyPriceId = paddleConfig.yearlyPriceId;
  const env = paddleConfig.environment;

  const savings = getYearlySavingsPercent(PLANS.pro);
  const selectedPriceId = interval === 'year' ? yearlyPriceId : monthlyPriceId;
  const missingClientToken = !clientToken;
  const missingSelectedPrice = !selectedPriceId;
  const canUpgrade = paddleReady && !missingClientToken && !missingSelectedPrice;

  const markPaddleUnavailable = useCallback((message = 'SDK Paddle indisponible (cdn.paddle.com non chargé)') => {
    setPaddleReady(false);
    setPaddleLoadState('error');
    setError(message);
  }, []);

  const waitForPaddleSdk = useCallback(() => {
    const startedAt = Date.now();

    const tick = () => {
      const paddle = window.Paddle;
      if (paddle && typeof paddle.Initialize === 'function' && typeof paddle.Checkout?.open === 'function') {
        setPaddleReady(true);
        setPaddleLoadState('ready');
        setError((current) =>
          current === 'SDK Paddle indisponible (cdn.paddle.com non chargé)' ? null : current
        );
        return;
      }

      if (Date.now() - startedAt >= PADDLE_SDK_READY_TIMEOUT_MS) {
        markPaddleUnavailable();
        return;
      }

      window.setTimeout(tick, PADDLE_SDK_READY_POLL_MS);
    };

    tick();
  }, [markPaddleUnavailable]);

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
    if (typeof window !== 'undefined') {
      waitForPaddleSdk();
    }
  }, [waitForPaddleSdk]);

  useEffect(() => {
    if (paddleLoadState !== 'loading') return;
    const timer = window.setTimeout(() => {
      if (
        !window.Paddle ||
        typeof window.Paddle.Initialize !== 'function' ||
        typeof window.Paddle.Checkout?.open !== 'function'
      ) {
        markPaddleUnavailable();
      }
    }, PADDLE_SDK_READY_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [markPaddleUnavailable, paddleLoadState]);

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

  useEffect(() => {
    if (planId !== 'free') return;
    if (!missingClientToken && !missingSelectedPrice) return;

    setError(
      interval === 'year' && missingSelectedPrice
        ? 'Paddle non configuré (PRICE_ID annuel manquant)'
        : 'Paddle non configuré (CLIENT_TOKEN / PRICE_ID manquants)'
    );
  }, [interval, missingClientToken, missingSelectedPrice, planId]);

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
    if (!clientToken || !selectedPriceId) {
      setError(
        interval === 'year'
          ? 'Paddle non configuré (PRICE_ID annuel manquant)'
          : 'Paddle non configuré (CLIENT_TOKEN / PRICE_ID manquants)'
      );
      return;
    }

    if (!window.Paddle?.Checkout?.open) {
      markPaddleUnavailable();
      return;
    }

    window.Paddle.Checkout.open({
      items: [{ priceId: selectedPriceId, quantity: 1 }],
      customer: { email },
      customData: { user_id: userId },
    });
    setPolling(true);
  };

  const handlePaddleReady = () => {
    waitForPaddleSdk();
  };

  const handlePaddleError = () => {
    markPaddleUnavailable();
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
      <p className="text-sm text-[color:var(--ink-soft)]">
        Accès Pro à vie (statut fondateur). Pas de facturation active.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={handlePaddleReady}
        onReady={handlePaddleReady}
        onError={handlePaddleError}
      />

      {celebrating && <ProOnboarding onClose={handleOnboardingClose} />}

      <div className="space-y-4">
        {planId === 'free' && (
          <div>
            <p className="text-xs text-[color:var(--ink-soft)] mb-2">Cycle de facturation</p>
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[color:var(--rule)] bg-[color:var(--paper)]">
              <button
                type="button"
                onClick={() => setInterval('month')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  interval === 'month'
                    ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                    : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
                }`}
              >
                Mensuel — {formatPriceFor(PLANS.pro, 'month')}
              </button>
              <button
                type="button"
                onClick={() => setInterval('year')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors inline-flex items-center gap-1.5 ${
                  interval === 'year'
                    ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                    : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
                }`}
              >
                Annuel — {formatPriceFor(PLANS.pro, 'year')}
                {savings !== null && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      interval === 'year'
                        ? 'bg-[color:var(--gain-soft)] text-[color:var(--gain)]'
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
                disabled={!canUpgrade}
                className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 disabled:opacity-50 rounded-lg w-fit"
              >
                {paddleLoadState === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
                {paddleLoadState === 'error'
                  ? 'Paiement indisponible'
                  : `Passer Pro — ${formatPriceFor(PLANS.pro, interval)}`}
              </button>
              <p className="text-xs text-[color:var(--ink-soft)]">
                Les factures seront envoyées à l&apos;adresse email indiquée lors du paiement.
              </p>
            </div>
          ) : (
            <button
              onClick={handleManage}
              disabled={loading}
              className="btn-outline inline-flex items-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-60"
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
