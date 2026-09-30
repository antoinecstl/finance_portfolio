'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import type { Account } from '@/lib/types';
import type { PortfolioHistoryPoint } from '@/lib/portfolio-calculator';
import { buildAccountHistorySeries, type AccountHistorySeries } from '@/lib/account-history';
import { buildNiceYAxisScale } from '@/lib/chart-axis';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

const MS_PER_DAY = 86_400_000;

const DEFAULT_YTD_DAYS = (() => {
  const now = new Date();
  return Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / MS_PER_DAY);
})();

const PERIODS = [
  { label: '1S', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'YTD', days: DEFAULT_YTD_DAYS },
  { label: '1A', days: 365 },
  { label: 'Max', days: 3650 },
];

type ViewMode = 'accounts' | 'total';

interface PortfolioHistoryChartProps {
  history: PortfolioHistoryPoint[];
  accounts: Account[];
  loading?: boolean;
  onPeriodChange?: (days: number) => void;
  selectedPeriod?: number;
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000, value % 1000 === 0 ? 0 : 1)}k€`;
  }
  return `${value.toFixed(0)}€`;
}

function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatLongDate(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      {children}
    </div>
  );
}

function ChartTitle() {
  return (
    <div className="flex items-center gap-2">
      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-[color:var(--ink-soft)]" aria-hidden="true" />
      <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
        Évolution du patrimoine
      </h3>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5"
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs rounded-md transition-colors whitespace-nowrap ${
            value === option.value
              ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function HistoryTooltip({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  series: AccountHistorySeries[] | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as Record<string, number | string>;

  return (
    <div className="min-w-[200px] rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper-2)] px-3 py-2 text-xs text-[color:var(--ink)] shadow-md">
      <p className="mb-1.5 font-semibold">{formatLongDate(String(row.date))}</p>
      {series && (
        <ul className="space-y-1 mb-1.5">
          {/* Du haut vers le bas de la pile, comme à l'écran. */}
          {[...series].reverse().map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[color:var(--ink-soft)]">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="tabular-nums">{formatCurrency(Number(row[s.key]) || 0)}</span>
            </li>
          ))}
        </ul>
      )}
      <p
        className={`flex items-center justify-between gap-4 font-semibold ${
          series ? 'border-t border-[color:var(--rule)] pt-1.5' : ''
        }`}
      >
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(Number(row.total) || 0)}</span>
      </p>
    </div>
  );
}

export function PortfolioHistoryChart({
  history,
  accounts,
  loading = false,
  onPeriodChange,
  selectedPeriod = 30,
}: PortfolioHistoryChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('accounts');

  const accountHistory = useMemo(() => buildAccountHistorySeries(history, accounts), [history, accounts]);
  // La vue par compte n'a de sens qu'avec des valeurs par compte.
  const effectiveMode: ViewMode = accountHistory && accountHistory.series.length > 0 ? viewMode : 'total';

  const rows = useMemo(
    () => accountHistory?.rows ?? history.map((point) => ({ date: point.date, total: point.totalValue })),
    [accountHistory, history]
  );

  if (loading && history.length === 0) {
    return (
      <ChartCard>
        <ChartTitle />
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-[color:var(--ink-soft)] animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Chargement...</span>
        </div>
      </ChartCard>
    );
  }

  if (rows.length === 0) {
    return (
      <ChartCard>
        <ChartTitle />
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution
          </p>
        </div>
      </ChartCard>
    );
  }

  const firstValue = rows[0].total;
  const lastValue = rows[rows.length - 1].total;
  const periodChange = lastValue - firstValue;
  const periodChangePercent = firstValue > 0 ? (periodChange / firstValue) * 100 : 0;
  const isUp = periodChange >= 0;

  // Vue empilée : l'axe part de 0 pour que chaque bande reste proportionnelle.
  // Vue total : l'axe se resserre sur la plage de valeurs pour lire les variations.
  const yAxis = buildNiceYAxisScale(
    rows.map((row) => row.total),
    { includeZero: effectiveMode === 'accounts' }
  );
  const series = effectiveMode === 'accounts' ? accountHistory!.series : null;

  return (
    <ChartCard>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-3 sm:mb-4">
        <ChartTitle />
        <div className="flex flex-wrap items-center gap-2">
          {accountHistory && accountHistory.series.length > 0 && (
            <SegmentedControl
              label="Type de vue"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { label: 'Par compte', value: 'accounts' },
                { label: 'Total', value: 'total' },
              ]}
            />
          )}
          {onPeriodChange && (
            <SegmentedControl
              label="Période"
              value={selectedPeriod}
              onChange={onPeriodChange}
              options={PERIODS.map((period) => ({ label: period.label, value: period.days }))}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3 sm:mb-4 text-xs sm:text-sm">
        <p>
          <span className="text-zinc-500 dark:text-zinc-400">Début : </span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(firstValue)}</span>
        </p>
        <p>
          <span className="text-zinc-500 dark:text-zinc-400">Fin : </span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(lastValue)}</span>
        </p>
        <p title="Cette variation inclut les apports et retraits, ce n'est pas un rendement">
          <span className="text-zinc-500 dark:text-zinc-400">Variation : </span>
          <span className={`font-medium ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {isUp ? '+' : ''}
            {formatCurrency(periodChange)} ({formatPercent(periodChangePercent)})
          </span>
          <span className="ml-1 text-[10px] text-zinc-400">apports inclus</span>
        </p>
        {loading && <Loader2 className="h-3.5 w-3.5 self-center text-zinc-400 animate-spin" aria-label="Mise à jour" />}
      </div>

      <div className="h-[240px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="historyTotalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--rule)" strokeOpacity={0.6} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 10, fill: 'var(--ink-soft)' }}
              stroke="var(--rule)"
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={yAxis.domain}
              ticks={yAxis.ticks}
              allowDataOverflow
              tickFormatter={formatAxisValue}
              tick={{ fontSize: 10, fill: 'var(--ink-soft)' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload }) => <HistoryTooltip active={active} payload={payload} series={series} />}
              cursor={{ stroke: 'var(--ink-soft)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            {series ? (
              series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stackId="accounts"
                  stroke="var(--paper)"
                  strokeWidth={1}
                  fill={s.color}
                  fillOpacity={0.85}
                  activeDot={false}
                />
              ))
            ) : (
              <Area
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="var(--chart-primary)"
                strokeWidth={2}
                fill="url(#historyTotalFill)"
                baseValue={yAxis.domain[0]}
                activeDot={{ r: 4, stroke: 'var(--paper)', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {series && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400" aria-label="Légende">
          {series.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <span className="truncate max-w-[160px]">{s.label}</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                {formatCurrency(s.latestValue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
