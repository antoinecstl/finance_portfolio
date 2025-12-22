'use client';

import { Transaction } from '@/lib/types';
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
  History
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
  limit?: number;
}

export function TransactionsList({ transactions, limit }: TransactionsListProps) {
  const displayedTransactions = limit ? transactions.slice(0, limit) : transactions;

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
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      {displayedTransactions.map((transaction) => (
        <TransactionRow key={transaction.id} transaction={transaction} />
      ))}
      {limit && transactions.length > limit && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 pt-4">
          +{transactions.length - limit} autres transactions
        </p>
      )}
    </div>
  );
}
