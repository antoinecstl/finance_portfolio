'use client';

import { useEffect, useMemo, useState } from 'react';

import { 
  Wallet, 
  TrendingUp, 
  PiggyBank,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { getPortfolioMarketStatus } from '@/lib/market-status';
import type { Account, StockPosition, StockQuote } from '@/lib/types';
import type { AccountYearToDateStats } from '@/lib/account-stats';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: 'wallet' | 'trending' | 'piggy' | 'chart' | 'coins';
  variant?: 'default' | 'success' | 'danger';
  status?: {
    label: string;
    tone: 'open' | 'partial' | 'closed';
  };
  loading?: boolean;
}

const icons = {
  wallet: Wallet,
  trending: TrendingUp,
  piggy: PiggyBank,
  chart: BarChart3,
  coins: Coins,
};

function Skeleton({ className }: { className: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded bg-[color:var(--rule)] ${className}`}
      aria-hidden="true"
    />
  );
}

export function StatCard({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon,
  variant = 'default',
  status,
  loading = false,
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

  const statusDotColors = {
    open: 'bg-emerald-500',
    partial: 'bg-amber-500',
    closed: 'bg-zinc-400 dark:bg-zinc-500',
  };

  return (
    <div aria-busy={loading || undefined} className={`${loading ? bgColors.default : bgColors[variant]} rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 lg:p-6 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className={`${loading ? iconColors.default : iconColors[variant]} rounded-lg p-2 sm:p-3`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        </div>
        {!loading && change !== undefined && (
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
        <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {loading ? <Skeleton className="h-6 w-24 sm:h-7 sm:w-32 align-middle" /> : value}
        </p>
        {loading ? null : status ? (
          <p className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotColors[status.tone]}`}
              aria-hidden="true"
            />
            {status.label}
          </p>
        ) : changeLabel && (
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs lg:text-sm text-zinc-500 dark:text-zinc-400">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}

interface PortfolioStatsProps {
  totalPortfolioValue: number;
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  savingsTotal: number;
  positions: StockPosition[];
  accounts: Account[];
  quotes: Record<string, StockQuote>;
  // Statistiques consolidées depuis le 1er janvier (null tant qu'elles se calculent).
  yearToDate?: AccountYearToDateStats | null;
  loading?: boolean;
}

export function PortfolioStats({
  totalPortfolioValue,
  totalValue,
  totalGain,
  totalGainPercent,
  dayChange,
  dayChangePercent,
  savingsTotal,
  positions,
  accounts,
  quotes,
  yearToDate = null,
  loading = false,
}: PortfolioStatsProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const marketStatus = useMemo(
    () => getPortfolioMarketStatus(positions, accounts, quotes, now),
    [positions, accounts, quotes, now],
  );

  // Répartition du patrimoine : titres, liquidités des comptes titres, épargne.
  const cashTotal = Math.max(0, totalPortfolioValue - totalValue - savingsTotal);
  const composition = [
    { label: 'Actions', value: Math.max(0, totalValue), color: 'var(--chart-1)' },
    { label: 'Liquidités', value: cashTotal, color: 'var(--chart-3)' },
    { label: 'Épargne', value: Math.max(0, savingsTotal), color: 'var(--chart-2)' },
  ]
    .filter((part) => part.value > 0.005)
    // Du plus grand au plus petit, pour la barre comme pour la légende.
    .sort((a, b) => b.value - a.value);
  const compositionTotal = composition.reduce((sum, part) => sum + part.value, 0);

  const currentYear = yearToDate?.year ?? now.getFullYear();
  const ytdPositive = (yearToDate?.performance ?? 0) >= 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <section
        aria-label="Synthèse du patrimoine"
        aria-busy={loading || undefined}
        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <p className="mono text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[color:var(--ink-soft)]">
              Patrimoine total
            </p>
            <p className="display mt-1 text-4xl sm:text-5xl leading-none text-[color:var(--ink)] break-words">
              {loading ? <Skeleton className="h-10 w-56 sm:h-12 sm:w-72" /> : formatCurrency(totalPortfolioValue)}
            </p>
            <div className="mt-3 min-h-[1.25rem] text-xs sm:text-sm text-[color:var(--ink-soft)]">
              {loading ? (
                <Skeleton className="h-4 w-64" />
              ) : yearToDate ? (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span>Performance {currentYear} :</span>
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        ytdPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {ytdPositive ? (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {ytdPositive ? '+' : ''}
                      {formatCurrency(yearToDate.performance)} ({formatPercent(yearToDate.performancePercent)})
                    </span>
                  </p>
                  {Math.abs(yearToDate.netFlows) > 0.005 && (
                    <p className="mt-0.5 text-[11px] sm:text-xs">
                      Hors apports nets de {formatCurrency(yearToDate.netFlows)} depuis le 1er janvier
                    </p>
                  )}
                </>
              ) : (
                <p>Performance {currentYear} en cours de calcul…</p>
              )}
            </div>
          </div>

          {!loading && compositionTotal > 0 && (
            <div className="w-full lg:max-w-md xl:max-w-xl 2xl:max-w-2xl">
              <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 xl:h-3"
                role="img"
                aria-label={composition
                  .map((part) => `${part.label} ${Math.round((part.value / compositionTotal) * 100)} %`)
                  .join(', ')}
              >
                {composition.map((part) => (
                  <div
                    key={part.label}
                    className="h-full"
                    style={{ width: `${(part.value / compositionTotal) * 100}%`, backgroundColor: part.color }}
                  />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--ink-soft)]">
                {composition.map((part) => (
                  <li key={part.label} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: part.color }}
                      aria-hidden="true"
                    />
                    <span>{part.label}</span>
                    <span className="font-medium text-[color:var(--ink)]">
                      {Math.round((part.value / compositionTotal) * 100)} %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Portefeuille actions"
          value={formatCurrency(totalValue)}
          change={totalGainPercent}
          changeLabel={`${totalGain >= 0 ? '+' : ''}${formatCurrency(totalGain)} vs PRU`}
          icon="chart"
          variant={totalGain >= 0 ? 'success' : 'danger'}
          loading={loading}
        />
        <StatCard
          title="Variation du jour"
          value={formatCurrency(dayChange)}
          change={dayChangePercent}
          status={{
            label: marketStatus.label,
            tone: marketStatus.state === 'empty' ? 'closed' : marketStatus.state,
          }}
          icon="trending"
          variant={dayChange >= 0 ? 'success' : 'danger'}
          loading={loading}
        />
        <StatCard
          title="Épargne"
          value={formatCurrency(savingsTotal)}
          icon="piggy"
          loading={loading}
        />
        <StatCard
          title={`Revenus ${currentYear}`}
          value={yearToDate ? formatCurrency(yearToDate.income) : '—'}
          changeLabel="Dividendes et intérêts"
          icon="coins"
          loading={loading}
        />
      </div>
    </div>
  );
}
