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
    <div className="ink-card pop-shadow fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 rounded-xl p-4 text-sm">
      <p className="text-[color:var(--ink)] mb-3">
        Fi-Hub n&apos;utilise que des cookies strictement nécessaires (authentification, session). Pas de
        tracking publicitaire.{' '}
        <Link href="/legal/cookies" className="text-[color:var(--accent)] hover:underline">
          En savoir plus
        </Link>
        .
      </p>
      <button
        onClick={dismiss}
        className="btn-ink w-full py-2 rounded-lg"
      >
        J&apos;ai compris
      </button>
    </div>
  );
}
