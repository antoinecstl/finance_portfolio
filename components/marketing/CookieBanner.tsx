'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'fihub_cookie_dismissed';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-4 text-sm">
      <p className="text-zinc-700 dark:text-zinc-300 mb-3">
        Fi-Hub n&apos;utilise que des cookies strictement nécessaires (authentification, session). Pas de
        tracking publicitaire.{' '}
        <Link href="/legal/cookies" className="text-blue-600 hover:underline">
          En savoir plus
        </Link>
        .
      </p>
      <button
        onClick={dismiss}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
      >
        J&apos;ai compris
      </button>
    </div>
  );
}
