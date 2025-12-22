'use client';

import { Account } from '@/lib/types';
import { EnrichedAccount } from '@/lib/hooks';
import { formatCurrency, getAccountTypeLabel } from '@/lib/utils';
import { 
  Building2, 
  Landmark, 
  PiggyBank, 
  Briefcase, 
  Shield, 
  Home,
  MoreHorizontal 
} from 'lucide-react';

const accountIcons: Record<string, typeof Building2> = {
  PEA: Briefcase,
  LIVRET_A: PiggyBank,
  LDDS: Landmark,
  CTO: Building2,
  ASSURANCE_VIE: Shield,
  PEL: Home,
  AUTRE: MoreHorizontal,
};

const accountColors: Record<string, string> = {
  PEA: 'bg-blue-500',
  LIVRET_A: 'bg-emerald-500',
  LDDS: 'bg-teal-500',
  CTO: 'bg-violet-500',
  ASSURANCE_VIE: 'bg-amber-500',
  PEL: 'bg-rose-500',
  AUTRE: 'bg-zinc-500',
};

interface AccountCardProps {
  account: EnrichedAccount;
  onClick?: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const Icon = accountIcons[account.type] || MoreHorizontal;
  const bgColor = accountColors[account.type] || 'bg-zinc-500';
  const isPeaCto = ['PEA', 'CTO'].includes(account.type);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-all hover:border-blue-300 dark:hover:border-blue-700"
    >
      <div className="flex items-center gap-4">
        <div className={`${bgColor} rounded-lg p-3 text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {account.name}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {getAccountTypeLabel(account.type)}
          </p>
          {/* Détails pour PEA/CTO */}
          {isPeaCto && account.calculatedCash !== undefined && (
            <div className="flex gap-4 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>💵 Cash: {formatCurrency(account.calculatedCash, account.currency)}</span>
              <span>📈 Actions: {formatCurrency(account.calculatedStocksValue || 0, account.currency)}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
            {formatCurrency(account.balance, account.currency)}
          </p>
          {isPeaCto && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Valeur totale
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

interface AccountListProps {
  accounts: EnrichedAccount[];
  onAccountClick?: (account: EnrichedAccount) => void;
}

export function AccountList({ accounts, onAccountClick }: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <PiggyBank className="mx-auto h-12 w-12 text-zinc-400" />
        <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucun compte
        </h3>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Ajoutez votre premier compte pour commencer
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onClick={() => onAccountClick?.(account)}
        />
      ))}
    </div>
  );
}
