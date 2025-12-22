'use client';

import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: 'wallet' | 'trending' | 'piggy' | 'chart';
  variant?: 'default' | 'success' | 'danger';
}

const icons = {
  wallet: Wallet,
  trending: TrendingUp,
  piggy: PiggyBank,
  chart: BarChart3,
};

export function StatCard({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon,
  variant = 'default' 
}: StatCardProps) {
  const Icon = icons[icon];
  const isPositive = change !== undefined && change >= 0;

  const bgColors = {
    default: 'bg-white dark:bg-zinc-900',
    success: 'bg-emerald-50 dark:bg-emerald-900/20',
    danger: 'bg-red-50 dark:bg-red-900/20',
  };

  const iconColors = {
    default: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    danger: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  return (
    <div className={`${bgColors[variant]} rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 lg:p-6 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className={`${iconColors[variant]} rounded-lg p-2 sm:p-3`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm font-medium ${
            isPositive ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <ArrowDownRight className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
            {formatPercent(change)}
          </div>
        )}
      </div>
      <div className="mt-2 sm:mt-3 lg:mt-4">
        <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
        {changeLabel && (
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs lg:text-sm text-zinc-500 dark:text-zinc-400">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}

interface PortfolioStatsProps {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  savingsTotal: number;
}

export function PortfolioStats({
  totalValue,
  totalInvested,
  totalGain,
  totalGainPercent,
  dayChange,
  dayChangePercent,
  savingsTotal,
}: PortfolioStatsProps) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Valeur Totale"
        value={formatCurrency(totalValue + savingsTotal)}
        icon="wallet"
      />
      <StatCard
        title="Portefeuille Actions"
        value={formatCurrency(totalValue)}
        change={totalGainPercent}
        changeLabel={`${formatCurrency(totalGain)} de gain`}
        icon="chart"
        variant={totalGain >= 0 ? 'success' : 'danger'}
      />
      <StatCard
        title="Variation du Jour"
        value={formatCurrency(dayChange)}
        change={dayChangePercent}
        icon="trending"
        variant={dayChange >= 0 ? 'success' : 'danger'}
      />
      <StatCard
        title="Épargne"
        value={formatCurrency(savingsTotal)}
        icon="piggy"
      />
    </div>
  );
}
