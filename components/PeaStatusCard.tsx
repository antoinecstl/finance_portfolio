'use client';

// Bloc propre aux PEA dans la carte d'un compte : plafond de versements et
// échéance des 5 ans (lib/pea.ts). La date d'ouverture est déclarée ici.

import { useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-errors';
import { computePeaStatus, formatMonthsRemaining } from '@/lib/pea';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Account } from '@/lib/types';

interface Props {
  account: Pick<Account, 'id' | 'name' | 'type' | 'supports_positions' | 'opened_on'>;
  /** Cumul des versements saisis sur ce compte. */
  deposits: number;
  /** Rechargement des comptes après enregistrement de la date. */
  onSaved?: () => void | Promise<void>;
}

const todayLocal = () => new Date().toLocaleDateString('sv-SE');
const noSubscription = () => () => {};

export function PeaStatusCard({ account, deposits, onSaved }: Props) {
  const today = useSyncExternalStore(noSubscription, todayLocal, () => '');
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState(account.opened_on ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = computePeaStatus({ deposits, openedOn: account.opened_on, today: today || '9999-12-31' });
  const showForm = editing || (!status.openedOn && Boolean(onSaved));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateInput) {
      setError('Indiquez la date d’ouverture.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: account.name,
          type: account.type,
          supports_positions: account.supports_positions ?? null,
          opened_on: dateInput,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(getApiErrorMessage(data, 'La date n’a pas pu être enregistrée.', res.status));
        return;
      }
      setEditing(false);
      await onSaved?.();
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="Suivi du PEA"
      className="mt-4 rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper-2)] p-3 text-xs sm:text-sm"
    >
      <h4 className="font-semibold text-[color:var(--ink)]">Suivi du PEA</h4>

      {/* Plafond de versements */}
      <div className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[color:var(--ink-soft)]">Versements</span>
          <span className="font-medium tabular-nums text-[color:var(--ink)]">
            {formatCurrency(status.deposits, 'EUR')} sur {formatCurrency(status.cap, 'EUR')}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Part du plafond de versements utilisée"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(status.capUsedPercent)}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color:var(--rule)]"
        >
          <div
            className={`h-full rounded-full ${status.capReached ? 'bg-[color:var(--loss)]' : 'bg-[color:var(--ink)]'}`}
            style={{ width: `${Math.max(status.deposits > 0 ? 2 : 0, status.capUsedPercent)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[color:var(--ink-soft)]">
          {status.capReached
            ? 'Plafond de versements atteint : le plan ne peut plus recevoir de versement.'
            : `Il reste ${formatCurrency(status.remaining, 'EUR')} de versements possibles.`}{' '}
          Calculé sur les versements saisis dans Fi-Hub ; un retrait ne redonne pas de capacité.
        </p>
      </div>

      {/* Antériorité fiscale */}
      <div className="mt-3 border-t border-[color:var(--rule)] pt-3">
        {status.openedOn && status.fiveYearDate && !showForm ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[color:var(--ink-soft)]">Ouvert le {formatDate(status.openedOn)}</span>
              <span className="font-medium text-[color:var(--ink)]">
                {status.fiveYearsReached
                  ? 'Plus de 5 ans'
                  : `5 ans le ${formatDate(status.fiveYearDate)}${
                      status.monthsToFiveYears !== null ? ` (${formatMonthsRemaining(status.monthsToFiveYears)})` : ''
                    }`}
              </span>
            </div>
            <p className="mt-1.5 text-[color:var(--ink-soft)]">
              {status.fiveYearsReached
                ? 'Les retraits ne clôturent plus le plan et les gains sont exonérés d’impôt sur le revenu (les prélèvements sociaux restent dus).'
                : 'Avant cette date, un retrait entraîne en principe la clôture du plan et l’imposition des gains.'}
            </p>
            {onSaved && (
              <button
                type="button"
                onClick={() => {
                  setDateInput(status.openedOn ?? '');
                  setEditing(true);
                }}
                className="mt-1.5 text-[color:var(--ink-soft)] underline underline-offset-4 hover:text-[color:var(--ink)]"
              >
                Corriger la date d’ouverture
              </button>
            )}
          </>
        ) : showForm ? (
          <form onSubmit={save}>
            <label htmlFor={`pea-opened-${account.id}`} className="block font-medium text-[color:var(--ink)]">
              Date d’ouverture du PEA
            </label>
            <p className="mt-0.5 text-[color:var(--ink-soft)]">
              Elle figure sur votre contrat ou vos relevés. Elle fixe l’échéance des 5 ans, à partir de laquelle
              les retraits deviennent libres.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id={`pea-opened-${account.id}`}
                type="date"
                value={dateInput}
                max={today || undefined}
                onChange={(e) => setDateInput(e.target.value)}
                className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] px-3 py-2 text-[color:var(--ink)]"
              />
              <button
                type="submit"
                disabled={saving}
                className="btn-ink inline-flex items-center gap-2 rounded-lg px-3.5 py-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="text-[color:var(--ink-soft)] underline underline-offset-4 hover:text-[color:var(--ink)]"
                >
                  Annuler
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-2 text-[color:var(--loss)]">
                {error}
              </p>
            )}
          </form>
        ) : (
          <p className="text-[color:var(--ink-soft)]">Date d’ouverture non renseignée.</p>
        )}
      </div>
    </section>
  );
}
