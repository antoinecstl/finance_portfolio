'use client';

import { useState, useMemo } from 'react';
import { Transaction, Account } from '@/lib/types';
import { 
  formatCurrency, 
  formatDate, 
  getTransactionTypeLabel, 
  getTransactionColor 
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
  X
} from 'lucide-react';

const transactionIcons: Record<string, typeof ArrowDownLeft> = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAWAL: ArrowUpRight,
  BUY: ShoppingCart,
  SELL: Banknote,
  DIVIDEND: Coins,
  INTEREST: Coins,
  FEE: Receipt,
};

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
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const Icon = transactionIcons[transaction.type] || Receipt;
  const colorClass = getTransactionColor(transaction.type);
  const isDebit = ['WITHDRAWAL', 'BUY', 'FEE'].includes(transaction.type);

  return (
    <div className="flex items-center gap-4 py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className={`rounded-full p-2 ${
        isDebit 
          ? 'bg-red-100 dark:bg-red-900/30 text-red-600' 
          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isDebit 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600' 
              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
          }`}>
            {getTransactionTypeLabel(transaction.type)}
          </span>
          {transaction.stock_symbol && (
            <span className="text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
              {transaction.stock_symbol}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 truncate">
          {transaction.description}
        </p>
        {transaction.quantity && transaction.price_per_unit && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {transaction.quantity} × {formatCurrency(transaction.price_per_unit)}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className={`font-semibold ${colorClass}`}>
          {isDebit ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(transaction.date)}
        </p>
      </div>
    </div>
  );
}

interface TransactionsListProps {
  transactions: Transaction[];
  accounts?: Account[];
  limit?: number;
  showFilters?: boolean;
}

export function TransactionsList({ 
  transactions, 
  accounts = [],
  limit, 
  showFilters = false 
}: TransactionsListProps) {
  const [filterType, setFilterType] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Extraire les symboles uniques
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set<string>();
    transactions.forEach(t => {
      if (t.stock_symbol) symbols.add(t.stock_symbol.toUpperCase());
    });
    return Array.from(symbols).sort();
  }, [transactions]);

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterType && t.type !== filterType) return false;
      if (filterAccount && t.account_id !== filterAccount) return false;
      if (filterSymbol && t.stock_symbol?.toUpperCase() !== filterSymbol) return false;
      if (filterDateFrom && t.date < filterDateFrom) return false;
      if (filterDateTo && t.date > filterDateTo) return false;
      return true;
    });
  }, [transactions, filterType, filterAccount, filterSymbol, filterDateFrom, filterDateTo]);

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
      <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <History className="mx-auto h-12 w-12 text-zinc-400" />
        <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucune transaction
        </h3>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Vos transactions apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      {showFilters && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <Filter className="h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs px-2 py-0.5 rounded-full">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              {/* Filtre par type */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
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
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Compte</label>
                  <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="w-full text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
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
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Action</label>
                  <select
                    value={filterSymbol}
                    onChange={(e) => setFilterSymbol(e.target.value)}
                    className="w-full text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-500 mb-1">Du</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Filtre date fin */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Au</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          {/* Résumé des résultats */}
          {hasActiveFilters && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500">
              {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? 's' : ''} trouvée{filteredTransactions.length > 1 ? 's' : ''}
              {filteredTransactions.length > 0 && (
                <span className="ml-2">
                  • Total: {formatCurrency(
                    filteredTransactions.reduce((sum, t) => {
                      const isDebit = ['WITHDRAWAL', 'BUY', 'FEE'].includes(t.type);
                      return sum + (isDebit ? -t.amount : t.amount);
                    }, 0)
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Liste des transactions */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        {displayedTransactions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Aucune transaction ne correspond aux filtres
          </div>
        ) : (
          <>
            {displayedTransactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
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
