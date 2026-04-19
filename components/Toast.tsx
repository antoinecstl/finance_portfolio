'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

type ToastKind = 'info' | 'success' | 'error' | 'upsell';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  href?: string;
  hrefLabel?: string;
};

type ToastContextValue = {
  show: (t: Omit<ToastItem, 'id'>) => void;
  showUpsell: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, ...t }]);
      setTimeout(() => remove(id), 6000);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      showUpsell: (message: string) =>
        show({
          kind: 'upsell',
          message,
          href: '/settings/billing',
          hrefLabel: 'Passer Pro',
        }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const Icon =
    toast.kind === 'upsell'
      ? Sparkles
      : toast.kind === 'success'
        ? CheckCircle2
        : toast.kind === 'error'
          ? AlertCircle
          : AlertCircle;

  const tone =
    toast.kind === 'upsell'
      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
      : toast.kind === 'success'
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100'
        : toast.kind === 'error'
          ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30 text-red-900 dark:text-red-100'
          : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100';

  return (
    <div className={`rounded-lg border shadow-lg p-3 flex items-start gap-2 ${tone}`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p>{toast.message}</p>
        {toast.href && toast.hrefLabel && (
          <Link
            href={toast.href}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline"
          >
            {toast.hrefLabel} →
          </Link>
        )}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 text-current opacity-60 hover:opacity-100"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
