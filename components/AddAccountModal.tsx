'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AccountType } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useLimitReached } from './LimitReachedModal';
import { parseDecimal } from '@/lib/decimal';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'PEA', label: 'PEA' },
  { value: 'LIVRET_A', label: 'Livret A' },
  { value: 'LDDS', label: 'LDDS' },
  { value: 'CTO', label: 'Compte-titres ordinaire' },
  { value: 'ASSURANCE_VIE', label: 'Assurance-vie' },
  { value: 'PEL', label: 'PEL' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'AUTRE', label: 'Autre' },
];

export function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('LIVRET_A');
  const [autreSupportsPositions, setAutreSupportsPositions] = useState(false);
  // Solde de départ facultatif : enregistré comme un versement du jour.
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const limitReached = useLimitReached();

  const resetForm = () => {
    setName('');
    setType('LIVRET_A');
    setAutreSupportsPositions(false);
    setInitialBalance('');
    setError(null);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!user) {
      setError('Vous devez être connecté');
      setLoading(false);
      return;
    }

    const balance = initialBalance.trim() === '' ? 0 : parseDecimal(initialBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setError('Indiquez un solde positif, ou laissez le champ vide.');
      setLoading(false);
      return;
    }

    try {
      // On n'envoie supports_positions que pour AUTRE (surcharge explicite).
      // Pour les autres types, le défaut du type s'applique côté lecture.
      const payloadBody: Record<string, unknown> = { name, type, currency: 'EUR' };
      if (type === 'AUTRE') {
        payloadBody.supports_positions = autreSupportsPositions;
      }
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      });

      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        limitReached.show({
          scope: 'accounts',
          current: data.current,
          max: data.limit,
          reason: 'blocked',
        });
        setError(data.message ?? 'Limite atteinte');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(data, 'Erreur lors de la création du compte.', res.status));
      }

      const payload = await res.json().catch(() => ({}));

      // Solde de départ : un versement daté du jour sur le nouveau compte.
      if (balance > 0 && payload.account?.id) {
        const deposit = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: payload.account.id,
            type: 'DEPOSIT',
            amount: Math.round(balance * 100) / 100,
            fees: 0,
            description: 'Solde initial',
            date: new Date().toLocaleDateString('sv-SE'),
            currency: 'EUR',
          }),
        }).catch(() => null);
        if (!deposit || !deposit.ok) {
          const data = deposit ? await deposit.json().catch(() => ({})) : {};
          onSuccess();
          setError(`Compte créé, mais le solde n’a pas pu être enregistré${data.message ? ` (${data.message})` : ''}. Ajoutez un versement depuis Transactions.`);
          return;
        }
      }

      resetForm();
      onSuccess();
      onClose();

      if (payload.at_cap) {
        limitReached.show({
          scope: 'accounts',
          current: payload.current,
          max: payload.limit,
          reason: 'reached',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 sm:mb-6">
          Ajouter un compte
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Nom du compte
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: PEA Boursorama"
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Type de compte
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {accountTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === 'AUTRE' && (
            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={autreSupportsPositions}
                onChange={(e) => setAutreSupportsPositions(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                  Ce compte peut détenir des positions
                </span>
                <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">
                  Activez cette option pour un compte titres non standard, un PER, ou une enveloppe similaire.
                </span>
              </span>
            </label>
          )}

          <div>
            <label htmlFor="account-initial-balance" className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Solde actuel <span className="font-normal text-zinc-500">(facultatif)</span>
            </label>
            <input
              id="account-initial-balance"
              type="text"
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Enregistré comme un versement daté d’aujourd’hui. Le solde se calcule ensuite à partir de vos opérations.
            </p>
          </div>

          {error && (
            <p className="text-xs sm:text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-ink flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
