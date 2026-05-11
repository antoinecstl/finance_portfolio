'use client';

import { useState } from 'react';
import { EnrichedAccount } from '@/lib/hooks';
import type { AccountType } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  accountSupportsPositions,
  canChangeAccountType,
  defaultSupportsPositions,
  formatCurrency,
  formatCurrencyBreakdown,
  formatDate,
  getAccountTypeLabel,
} from '@/lib/utils';
import {
  Building2,
  Landmark,
  PiggyBank,
  Briefcase,
  Shield,
  Home,
  MoreHorizontal,
  ChevronDown,
  Wallet,
  TrendingUp,
  Calendar,
  Trash2,
  AlertTriangle,
  Coins,
  Pencil,
} from 'lucide-react';
import { useToast } from './Toast';

const accountTypeValues: AccountType[] = [
  'PEA',
  'LIVRET_A',
  'LDDS',
  'CTO',
  'ASSURANCE_VIE',
  'PEL',
  'CRYPTO',
  'AUTRE',
];

const accountIcons: Record<string, typeof Building2> = {
  PEA: Briefcase,
  LIVRET_A: PiggyBank,
  LDDS: Landmark,
  CTO: Building2,
  ASSURANCE_VIE: Shield,
  PEL: Home,
  CRYPTO: Coins,
  AUTRE: MoreHorizontal,
};

const accountColors: Record<string, string> = {
  PEA: 'bg-blue-500',
  LIVRET_A: 'bg-emerald-500',
  LDDS: 'bg-teal-500',
  CTO: 'bg-violet-500',
  ASSURANCE_VIE: 'bg-amber-500',
  PEL: 'bg-rose-500',
  CRYPTO: 'bg-orange-500',
  AUTRE: 'bg-zinc-500',
};

interface AccountCardProps {
  account: EnrichedAccount;
  defaultExpanded?: boolean;
  onRequestEdit?: (account: EnrichedAccount) => void;
  onRequestDelete?: (account: EnrichedAccount) => void;
}

export function AccountCard({
  account,
  defaultExpanded = false,
  onRequestEdit,
  onRequestDelete,
}: AccountCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Icon = accountIcons[account.type] || MoreHorizontal;
  const bgColor = accountColors[account.type] || 'bg-zinc-500';
  const supportsPositions = accountSupportsPositions(account);
  const cashLabel = formatCurrencyBreakdown(account.calculatedCashByCurrency, account.currency);
  // Compte multi-devises (USDC + EUR sur Binance, par ex.) ou positions cotées
  // dans une autre devise que celle du compte → on affiche la valeur totale en
  // EUR (base) plutôt qu'une somme naïve qui mélange USDC et EUR à 1:1.
  const cashCurrencies = Object.keys(account.calculatedCashByCurrency ?? {});
  const isMultiCurrency = cashCurrencies.length > 1
    || cashCurrencies.some(c => c.toUpperCase() !== (account.currency ?? 'EUR').toUpperCase());
  const totalInBase = account.calculatedTotalValueInBase ?? account.calculatedTotalValue;
  const stocksValueInBase = account.calculatedStocksValueInBase ?? account.calculatedStocksValue ?? 0;
  const headlineValue =
    !supportsPositions || (account.calculatedStocksValue ?? 0) === 0
      ? cashLabel
      : isMultiCurrency
        ? formatCurrency(totalInBase, 'EUR')
        : formatCurrency(account.calculatedTotalValue, account.currency);

  return (
    <div className="w-full max-w-full overflow-hidden bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full text-left p-3 sm:p-4 lg:p-5 hover:border-blue-300 dark:hover:border-blue-700"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`${bgColor} rounded-lg p-2 sm:p-3 text-white flex-shrink-0`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
              {account.name}
            </p>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {getAccountTypeLabel(account.type)}
            </p>
          </div>
          <div className="text-right flex-shrink-0 max-w-[42%]">
            <p className="font-bold text-sm sm:text-base lg:text-lg text-zinc-900 dark:text-zinc-100 truncate">
              {headlineValue}
            </p>
            {supportsPositions && (
              <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                Valeur totale
              </p>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 flex-shrink-0 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5 border-t border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            {supportsPositions && account.calculatedCash !== undefined && (
              <>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-zinc-500 dark:text-zinc-400">Liquidités</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {cashLabel}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-zinc-500 dark:text-zinc-400">Actions</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {isMultiCurrency
                        ? formatCurrency(stocksValueInBase, 'EUR')
                        : formatCurrency(account.calculatedStocksValue || 0, account.currency)}
                    </dd>
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-500 flex-shrink-0" />
              <div className="min-w-0">
                <dt className="text-zinc-500 dark:text-zinc-400">Ouvert le</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {formatDate(account.created_at)}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-bold text-zinc-500 flex-shrink-0">
                {account.currency}
              </span>
              <div className="min-w-0">
                <dt className="text-zinc-500 dark:text-zinc-400">Devise</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {account.currency}
                </dd>
              </div>
            </div>
          </dl>

          {(onRequestEdit || onRequestDelete) && (
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3">
              {onRequestEdit && (
                <button
                  type="button"
                  onClick={() => onRequestEdit(account)}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier ce compte
                </button>
              )}
              {onRequestDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(account)}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer ce compte
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditAccountDialog({
  account,
  busy,
  error,
  name,
  setName,
  type,
  setType,
  supportsPositions,
  setSupportsPositions,
  hasPositionActivity,
  onCancel,
  onConfirm,
}: {
  account: EnrichedAccount;
  busy: boolean;
  error: string | null;
  name: string;
  setName: (v: string) => void;
  type: AccountType;
  setType: (v: AccountType) => void;
  supportsPositions: boolean;
  setSupportsPositions: (v: boolean) => void;
  hasPositionActivity: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const availableTypes = accountTypeValues.filter((value) => {
    if (!canChangeAccountType(account.type, value)) return false;
    if (!hasPositionActivity) return true;
    return value === account.type || value === 'AUTRE' || defaultSupportsPositions(value);
  });
  const nextSupportsPositions = type === 'AUTRE' ? supportsPositions : defaultSupportsPositions(type);
  const canSubmit =
    name.trim().length > 0
    && canChangeAccountType(account.type, type)
    && (!hasPositionActivity || nextSupportsPositions)
    && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onCancel} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Modifier le compte
        </h3>

        <form
          className="space-y-3 sm:space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Nom du compte
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Type de compte
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              disabled={busy}
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {availableTypes.map((value) => (
                <option key={value} value={value}>
                  {getAccountTypeLabel(value)}
                </option>
              ))}
            </select>
          </div>

          {hasPositionActivity && (
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-2 sm:p-3 rounded-lg">
              Ce compte contient déjà une activité titres. Seuls les types compatibles avec les positions sont disponibles.
            </p>
          )}

          {type === 'AUTRE' && (
            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={supportsPositions}
                onChange={(e) => setSupportsPositions(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                  Ce compte peut d&eacute;tenir des positions
                </span>
                <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">
                  Activez cette option pour un compte titres non standard.
                </span>
              </span>
            </label>
          )}

          {error && (
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteAccountDialog({
  account,
  busy,
  error,
  confirmName,
  setConfirmName,
  onCancel,
  onConfirm,
}: {
  account: EnrichedAccount;
  busy: boolean;
  error: string | null;
  confirmName: string;
  setConfirmName: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canSubmit = confirmName.trim() === account.name && !busy;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onCancel} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full p-2 bg-red-100 dark:bg-red-900/30 text-red-600 flex-shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Supprimer « {account.name} » ?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Toutes les transactions et positions de ce compte seront définitivement
              supprimées. Cette action est irréversible.
            </p>
          </div>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Tapez <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{account.name}</span> pour confirmer
        </label>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          disabled={busy}
          className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
          placeholder={account.name}
          autoFocus
        />

        {error && (
          <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccountListProps {
  accounts: EnrichedAccount[];
  positionActivityAccountIds?: ReadonlySet<string>;
  onChanged?: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
}

export function AccountList({
  accounts,
  positionActivityAccountIds,
  onChanged,
  onDeleted,
}: AccountListProps) {
  const onMutated = onChanged ?? onDeleted;
  const [pendingEdit, setPendingEdit] = useState<EnrichedAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('LIVRET_A');
  const [editSupportsPositions, setEditSupportsPositions] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EnrichedAccount | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const toast = useToast();

  const openEdit = (acc: EnrichedAccount) => {
    setPendingEdit(acc);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditSupportsPositions(accountSupportsPositions(acc));
    setEditError(null);
  };

  const cancelEdit = () => {
    if (editBusy) return;
    setPendingEdit(null);
    setEditName('');
    setEditType('LIVRET_A');
    setEditSupportsPositions(false);
    setEditError(null);
  };

  const openDelete = (acc: EnrichedAccount) => {
    setPendingDelete(acc);
    setConfirmName('');
    setDeleteError(null);
  };

  const cancelDelete = () => {
    if (deleteBusy) return;
    setPendingDelete(null);
    setConfirmName('');
    setDeleteError(null);
  };

  const confirmEdit = async () => {
    if (!pendingEdit) return;

    const nextName = editName.trim();
    const hasPositionActivity = positionActivityAccountIds?.has(pendingEdit.id) ?? false;
    const nextSupportsPositions = editType === 'AUTRE'
      ? editSupportsPositions
      : defaultSupportsPositions(editType);
    if (!nextName) {
      setEditError('Nom requis.');
      return;
    }
    if (!canChangeAccountType(pendingEdit.type, editType)) {
      setEditError('Un compte Crypto ne peut pas être transformé en compte classique, et inversement.');
      return;
    }

    if (hasPositionActivity && !nextSupportsPositions) {
      setEditError('Ce compte contient déjà une activité titres. Choisissez un type compatible avec les positions.');
      return;
    }

    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/accounts/${pendingEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          type: editType,
          supports_positions: editType === 'AUTRE' ? editSupportsPositions : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(getApiErrorMessage(data, 'Erreur lors de la modification du compte.', res.status));
        return;
      }
      toast.show({ kind: 'success', message: 'Compte modifié.' });
      setPendingEdit(null);
      await onMutated?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/accounts/${pendingDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: confirmName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(getApiErrorMessage(data, 'Erreur lors de la suppression du compte.', res.status));
        return;
      }
      toast.show({ kind: 'success', message: 'Compte supprimé.' });
      setPendingDelete(null);
      setConfirmName('');
      await onMutated?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <PiggyBank className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
        <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucun compte
        </h3>
        <p className="mt-1 sm:mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ajoutez votre premier compte pour commencer
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-2 sm:space-y-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onRequestEdit={onMutated ? openEdit : undefined}
          onRequestDelete={onMutated ? openDelete : undefined}
        />
      ))}
      {pendingEdit && (
        <EditAccountDialog
          account={pendingEdit}
          busy={editBusy}
          error={editError}
          name={editName}
          setName={setEditName}
          type={editType}
          setType={setEditType}
          supportsPositions={editSupportsPositions}
          setSupportsPositions={setEditSupportsPositions}
          hasPositionActivity={positionActivityAccountIds?.has(pendingEdit.id) ?? false}
          onCancel={cancelEdit}
          onConfirm={confirmEdit}
        />
      )}
      {pendingDelete && (
        <DeleteAccountDialog
          account={pendingDelete}
          busy={deleteBusy}
          error={deleteError}
          confirmName={confirmName}
          setConfirmName={setConfirmName}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
