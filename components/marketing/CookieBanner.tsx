'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'fihub_cookie_dismissed';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const id = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Information sur les cookies"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 text-sm shadow-lg"
    >
      <p className="text-[color:var(--text-2)] mb-3 leading-relaxed">
        Fi-Hub n&apos;utilise que des cookies strictement nécessaires (authentification, session). Pas de
        tracking publicitaire.{' '}
        <Link href="/legal/cookies" className="link">
          En savoir plus
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="btn-primary btn-sm w-full"
      >
        J&apos;ai compris
      </button>
    </div>
  );
}
