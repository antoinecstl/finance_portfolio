'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { QuickPortfolioForm } from './QuickPortfolioForm';
import { useLimitReached } from './LimitReachedModal';
import type { Account } from '@/lib/types';

interface QuickPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Comptes pouvant détenir des titres. */
  accounts: Account[];
  defaultAccountId?: string;
}

// Saisie rapide depuis l'onglet Positions : plusieurs titres déjà détenus en
// une fois (quantité et prix de revient), sans ressaisir chaque achat.
export function QuickPortfolioModal({ isOpen, onClose, onSuccess, accounts, defaultAccountId }: QuickPortfolioModalProps) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const limitReached = useLimitReached();

  if (!isOpen) return null;
  const account = accounts.find((a) => a.id === (accountId ?? defaultAccountId)) ?? accounts[0];

  const close = () => {
    setAccountId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-portfolio-title"
        className="relative mx-0 max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-[color:var(--paper)] p-4 text-[color:var(--ink)] shadow-xl sm:mx-4 sm:max-w-xl sm:rounded-xl sm:p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] sm:right-4 sm:top-4"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <h2 id="quick-portfolio-title" className="pr-10 text-lg font-semibold sm:text-xl">
          Saisie rapide de positions
        </h2>
        <p className="mb-5 mt-1 text-sm text-[color:var(--ink-soft)]">
          Une ligne par titre déjà détenu, avec la quantité et le prix de revient. Pour un nouvel achat, utilisez
          plutôt « Ajouter une position ».
        </p>

        {!account ? (
          <p className="text-sm text-[color:var(--ink-soft)]">
            Créez d’abord un compte pouvant détenir des titres (PEA, compte-titres, assurance-vie, crypto).
          </p>
        ) : (
          <>
            {accounts.length > 1 && (
              <div className="mb-4">
                <label htmlFor="quick-account" className="mb-1 block text-sm font-medium">
                  Compte
                </label>
                <select
                  id="quick-account"
                  value={account.id}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] px-3 py-2.5 text-[color:var(--ink)]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* key : changer de compte repart d'une saisie vide (titres et devise diffèrent). */}
            <QuickPortfolioForm
              key={account.id}
              account={account}
              onCancel={close}
              onLimit={(limit) => limitReached.show({ scope: limit.scope, current: limit.current, max: limit.max, reason: 'blocked' })}
              onDone={() => {
                onSuccess();
                close();
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
