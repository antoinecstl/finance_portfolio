'use client';

import { useState, useMemo } from 'react';
import { Transaction, Account } from '@/lib/types';
import {
  formatCurrency,
  formatDate,
  getAccountTypeLabel,
  getTransactionTypeLabel,
} from '@/lib/utils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Banknote,
  Coins,
  Receipt,
  History,
  Filter,
  X,
  Percent,
  Trash2,
  Pencil,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { useToast } from './Toast';
import { EditTransactionModal } from './EditTransactionModal';

type TxStyle = {
  Icon: typeof ArrowDownLeft;
  tone: string;
  sign: '+' | '-';
};

const TX_STYLE: Record<string, TxStyle> = {
  DEPOSIT:    { Icon: ArrowDownLeft, tone: 'emerald', sign: '+' },
  WITHDRAWAL: { Icon: ArrowUpRight,  tone: 'red',     sign: '-' },
  BUY:        { Icon: ShoppingCart,  tone: 'blue',    sign: '-' },
  SELL:       { Icon: Banknote,      tone: 'violet',  sign: '+' },
  DIVIDEND:   { Icon: Coins,         tone: 'emerald', sign: '+' },
  INTEREST:   { Icon: Percent,       tone: 'emerald', sign: '+' },
  FEE:        { Icon: Receipt,       tone: 'red',     sign: '-' },
};

// Static Tailwind classes per tone (JIT needs literal strings).
const TONE_CLASSES: Record<string, { chip: string; amount: string }> = {
  emerald: {
    chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
    amount: 'text-emerald-600',
  },
  red: {
    chip: 'bg-red-100 dark:bg-red-900/30 text-red-600',
    amount: 'text-red-600',
  },
  blue: {
    chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    amount: 'text-blue-600',
  },
  violet: {
    chip: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600',
    amount: 'text-violet-600',
  },
};

function getTxStyle(type: string): TxStyle {
  return TX_STYLE[type] ?? { Icon: Receipt, tone: 'red', sign: '-' };
}

const transactionTypes = [
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'WITHDRAWAL', label: 'Retrait' },
  { value: 'BUY', label: 'Achat' },
  { value: 'SELL', label: 'Vente' },
  { value: 'DIVIDEND', label: 'Dividende' },
  { value: 'INTEREST', label: 'Intérêts' },
  { value: 'FEE', label: 'Frais' },
];

interface TransactionRowProps {
  transaction: Transaction;
  account?: Account;
  feesAmount?: number;
  isSelected: boolean;
  canMutate: boolean;
  canEdit: boolean;
  onToggleSelect: (id: string) => void;
  onDeleteClick: (tx: Transaction) => void;
  onEditClick: (tx: Transaction) => void;
}

function TransactionRow({
  transaction,
  account,
  feesAmount = 0,
  isSelected,
  canMutate,
  canEdit,
  onToggleSelect,
  onDeleteClick,
  onEditClick,
}: TransactionRowProps) {
  const { Icon, tone, sign } = getTxStyle(transaction.type);
  const classes = TONE_CLASSES[tone];

  return (
    <div
      role={canMutate ? 'button' : undefined}
      tabIndex={canMutate ? 0 : undefined}
      onClick={canMutate ? () => onToggleSelect(transaction.id) : undefined}
      onKeyDown={
        canMutate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelect(transaction.id);
              }
            }
          : undefined
      }
      className={`flex items-center gap-2 sm:gap-4 py-3 sm:py-4 px-2 -mx-2 rounded-lg border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors ${
        canMutate ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''
      } ${isSelected ? 'bg-zinc-50 dark:bg-zinc-800/60' : ''}`}
    >
      <div className={`rounded-full p-1.5 sm:p-2 flex-shrink-0 ${classes.chip}`}>
        <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${classes.chip}`}>
            {getTransactionTypeLabel(transaction.type)}
          </span>
          {transaction.stock_symbol && (
            <span className="text-[10px] sm:text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded-full">
              {transaction.stock_symbol}
            </span>
          )}
          {account && (
            <span
              className="inline-flex max-w-[12rem] sm:max-w-[16rem] items-center gap-1 text-[10px] sm:text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded-full"
              title={`${account.name} - ${getAccountTypeLabel(account.type)}`}
            >
              <Wallet className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{account.name}</span>
              <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                {getAccountTypeLabel(account.type)}
              </span>
            </span>
          )}
          {feesAmount > 0 && (
            <span className="text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <Receipt className="h-2.5 w-2.5" />
              Frais {formatCurrency(feesAmount)}
            </span>
          )}
        </div>
        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 truncate">
          {transaction.description}
        </p>
        {transaction.quantity && transaction.price_per_unit && (
          <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500">
            {transaction.quantity} × {formatCurrency(transaction.price_per_unit)}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0 max-w-[38%]">
        <p className={`text-sm sm:text-base font-semibold ${classes.amount}`}>
          {sign}{formatCurrency(Math.abs(transaction.amount))}
        </p>
        <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(transaction.date)}
        </p>
      </div>
      {canMutate && isSelected && (
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditClick(transaction);
              }}
              className="p-1.5 rounded-md border border-[color:var(--rule)] bg-[color:var(--paper-2)] text-[color:var(--ink)] hover:bg-[color:var(--paper-3)] transition-colors"
              aria-label="Modifier la transaction"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(transaction);
            }}
            className="p-1.5 rounded-md text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors"
            aria-label="Supprimer la transaction"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  transaction,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  transaction: Transaction;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
              Supprimer cette transaction ?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {getTransactionTypeLabel(transaction.type)} du {formatDate(transaction.date)} — {formatCurrency(transaction.amount)}
              {transaction.stock_symbol ? ` · ${transaction.stock_symbol}` : ''}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              La suppression est refusée si elle rend invalide une transaction ultérieure
              (ex. vente sans titres disponibles, solde négatif).
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 sm:gap-3">
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
            disabled={busy}
            className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TransactionsListProps {
  transactions: Transaction[];
  accounts?: Account[];
  limit?: number;
  showFilters?: boolean;
  onDeleted?: () => void | Promise<void>;
  onEdited?: () => void | Promise<void>;
}

export function TransactionsList({
  transactions,
  accounts = [],
  limit,
  showFilters = false,
  onDeleted,
  onEdited,
}: TransactionsListProps) {
  const [filterType, setFilterType] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const toast = useToast();
  const canEdit = Boolean(onEdited);

  // IDs des lignes FEE référencées par une autre transaction : on les masque
  // de la liste (elles apparaissent comme chip "Frais X €" sur leur parent).
  // Map inverse feeId → montant pour afficher le chip sur la transaction principale.
  const { linkedFeeIds, feesByParentId } = useMemo(() => {
    const linked = new Set<string>();
    const amountByFeeId = new Map<string, number>();
    for (const t of transactions) {
      if (t.fee_transaction_id) linked.add(t.fee_transaction_id);
    }
    for (const t of transactions) {
      if (linked.has(t.id)) amountByFeeId.set(t.id, Number(t.amount) || 0);
    }
    const byParent = new Map<string, number>();
    for (const t of transactions) {
      if (t.fee_transaction_id && amountByFeeId.has(t.fee_transaction_id)) {
        byParent.set(t.id, amountByFeeId.get(t.fee_transaction_id) ?? 0);
      }
    }
    return { linkedFeeIds: linked, feesByParentId: byParent };
  }, [transactions]);

  const accountsById = useMemo(() => {
    const map = new Map<string, Account>();
    for (const account of accounts) {
      map.set(account.id, account);
    }
    return map;
  }, [accounts]);

  const handleToggleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleRequestDelete = (tx: Transaction) => {
    setPendingDelete(tx);
    setDeleteError(null);
  };

  const handleRequestEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
  };

  const handleEditSuccess = async () => {
    toast.show({ kind: 'success', message: 'Transaction modifiée.' });
    setEditingTransaction(null);
    setSelectedId(null);
    await onEdited?.();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/transactions/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.reason ?? 'Suppression impossible : elle créerait un état invalide.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? 'Erreur lors de la suppression.');
        return;
      }
      toast.show({ kind: 'success', message: 'Transaction supprimée.' });
      setPendingDelete(null);
      setSelectedId(null);
      await onDeleted?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleteBusy) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  // Extraire les symboles uniques
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set<string>();
    transactions.forEach(t => {
      if (t.stock_symbol) symbols.add(t.stock_symbol.toUpperCase());
    });
    return Array.from(symbols).sort();
  }, [transactions]);

  // Filtrer les transactions — on masque les lignes FEE rattachées à une autre
  // transaction (affichées à la place comme chip "Frais X €" sur la principale).
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (linkedFeeIds.has(t.id)) return false;
      if (filterType && t.type !== filterType) return false;
      if (filterAccount && t.account_id !== filterAccount) return false;
      if (filterSymbol && t.stock_symbol?.toUpperCase() !== filterSymbol) return false;
      if (filterDateFrom && t.date < filterDateFrom) return false;
      if (filterDateTo && t.date > filterDateTo) return false;
      return true;
    });
  }, [transactions, linkedFeeIds, filterType, filterAccount, filterSymbol, filterDateFrom, filterDateTo]);

  const displayedTransactions = limit ? filteredTransactions.slice(0, limit) : filteredTransactions;

  const hasActiveFilters = filterType || filterAccount || filterSymbol || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterType('');
    setFilterAccount('');
    setFilterSymbol('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <History className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
        <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucune transaction
        </h3>
        <p className="mt-1 sm:mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Vos transactions apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-3 sm:space-y-4">
      {/* Filtres */}
      {showFilters && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <Filter className="h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                  Actifs
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
                Effacer
              </button>
            )}
          </div>

          {showFilterPanel && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              {/* Filtre par type */}
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full text-xs sm:text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Tous</option>
                  {transactionTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Filtre par compte */}
              {accounts.length > 0 && (
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Compte</label>
                  <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="w-full text-xs sm:text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Tous</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtre par action */}
              {uniqueSymbols.length > 0 && (
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Action</label>
                  <select
                    value={filterSymbol}
                    onChange={(e) => setFilterSymbol(e.target.value)}
                    className="w-full text-xs sm:text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Toutes</option>
                    {uniqueSymbols.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtre date début */}
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Du</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full text-xs sm:text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Filtre date fin */}
              <div>
                <label className="block text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Au</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full text-xs sm:text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          {/* Résumé des résultats */}
          {hasActiveFilters && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm text-zinc-500">
              {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''} trouvée{filteredTransactions.length > 1 ? 's' : ''}
              {filteredTransactions.length > 0 && (
                <span className="ml-2">
                  • Total: {formatCurrency(
                    filteredTransactions.reduce((sum, t) => {
                      const { sign } = getTxStyle(t.type);
                      return sum + (sign === '-' ? -Math.abs(t.amount) : Math.abs(t.amount));
                    }, 0)
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {pendingDelete && (
        <DeleteConfirmDialog
          transaction={pendingDelete}
          busy={deleteBusy}
          error={deleteError}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      )}

      {canEdit && (
        <EditTransactionModal
          isOpen={editingTransaction !== null}
          onClose={() => setEditingTransaction(null)}
          onSuccess={handleEditSuccess}
          accounts={accounts}
          transactions={transactions}
          transaction={editingTransaction}
        />
      )}

      {/* Liste des transactions */}
      <div className="w-full max-w-full overflow-hidden bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        {displayedTransactions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Aucune transaction ne correspond aux filtres
          </div>
        ) : (
          <>
            {displayedTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                account={accountsById.get(transaction.account_id)}
                feesAmount={feesByParentId.get(transaction.id) ?? 0}
                isSelected={selectedId === transaction.id}
                canMutate={Boolean(onDeleted) || canEdit}
                canEdit={canEdit}
                onToggleSelect={handleToggleSelect}
                onDeleteClick={handleRequestDelete}
                onEditClick={handleRequestEdit}
              />
            ))}
            {limit && filteredTransactions.length > limit && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 pt-4">
                +{filteredTransactions.length - limit} autres transactions
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
