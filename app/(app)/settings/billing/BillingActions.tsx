'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';

type PaddleCheckoutOpen = (opts: {
  items: { priceId: string; quantity: number }[];
  customer?: { id?: string; email?: string };
  customData?: Record<string, string>;
  settings?: { displayMode?: 'overlay' | 'inline'; theme?: 'light' | 'dark' };
}) => void;

type PaddleGlobal = {
  Environment: { set: (env: 'sandbox' | 'production') => void };
  Initialize: (opts: { token: string; eventCallback?: (ev: { name: string }) => void }) => void;
  Checkout: { open: PaddleCheckoutOpen };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

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
  const [paddleReady, setPaddleReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID;
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV ?? 'sandbox';

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Paddle) {
      setPaddleReady(true);
    }
  }, []);

  useEffect(() => {
    if (!paddleReady || !window.Paddle || !clientToken) return;
    if (env !== 'production') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token: clientToken });
  }, [paddleReady, clientToken, env]);

  const handleUpgrade = async () => {
    if (!window.Paddle || !priceId) {
      setError('Paddle non configuré (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN / PRICE_ID manquants)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/customer', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'customer_error');
      const { customerId } = (await res.json()) as { customerId: string };
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { id: customerId },
        customData: { user_id: userId },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
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
      <div className="flex gap-3 flex-wrap">
        {planId === 'free' ? (
          <button
            onClick={handleUpgrade}
            disabled={!paddleReady || loading}
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
          >
            {(!paddleReady || loading) && <Loader2 className="h-4 w-4 animate-spin" />}
            Passer Pro
          </button>
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
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </>
  );
}
