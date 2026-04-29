'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AccountType } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useLimitReached } from './LimitReachedModal';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'PEA', label: 'PEA' },
  { value: 'LIVRET_A', label: 'Livret A' },
  { value: 'LDDS', label: 'LDDS' },
  { value: 'CTO', label: 'Compte-Titres Ordinaire' },
  { value: 'ASSURANCE_VIE', label: 'Assurance Vie' },
  { value: 'PEL', label: 'PEL' },
  { value: 'AUTRE', label: 'Autre' },
];

export function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('LIVRET_A');
  const [autreSupportsPositions, setAutreSupportsPositions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const limitReached = useLimitReached();

  const resetForm = () => {
    setName('');
    setType('LIVRET_A');
    setAutreSupportsPositions(false);
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
        throw new Error(data.error ?? 'Erreur lors de la création');
      }

      const payload = await res.json().catch(() => ({}));

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

          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-2 sm:p-3 rounded-lg">
            💡 Le solde sera calculé à partir des transactions. Ajoutez un dépôt après création.
          </p>

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
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
