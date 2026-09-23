'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, Sparkles, TrendingUp } from 'lucide-react';
import type { PortfolioHistoryPoint } from '@/lib/portfolio-calculator';
import type { Transaction } from '@/lib/types';
import type { FxRateMap } from '@/lib/fx';
import { buildPerformanceProjection } from '@/lib/performance-projection';
import { buildNiceYAxisScale } from '@/lib/chart-axis';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface PerformanceProjectionChartProps {
  history: PortfolioHistoryPoint[];
  transactions: Transaction[];
  loading?: boolean;
  fxRates?: FxRateMap;
}

const HORIZONS = [1, 3, 5] as const;

export function PerformanceProjectionChart({
  history,
  transactions,
  loading = false,
  fxRates = {},
}: PerformanceProjectionChartProps) {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(3);
  const projection = useMemo(
    () => buildPerformanceProjection(history, transactions, horizon, fxRates),
    [history, transactions, horizon, fxRates]
  );
  const chartData = useMemo(() => projection?.points.map(point => ({
    ...point,
    label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    fullDate: new Date(`${point.date}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  })) ?? [], [projection]);
  const yAxis = useMemo(
    () => buildNiceYAxisScale(chartData.flatMap(point => [point.actual, point.projected]).filter((value): value is number => value !== null)),
    [chartData]
  );

  if (loading) {
    return <ChartShell><div className="flex items-center justify-center py-20 text-sm text-zinc-500"><Loader2 className="mr-2 h-6 w-6 animate-spin text-violet-600" />Calcul de la projection…</div></ChartShell>;
  }

  if (!projection) {
    return <ChartShell><div className="py-16 text-center"><TrendingUp className="mx-auto h-10 w-10 text-zinc-400" /><p className="mt-3 text-sm text-zinc-500">Deux points d’historique sont nécessaires pour établir une projection.</p></div></ChartShell>;
  }

  return (
    <ChartShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Projection du patrimoine</h3>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Estimation fondée sur la performance historique du compte, hors futurs apports.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800" aria-label="Horizon de projection">
          {HORIZONS.map(years => <button key={years} type="button" onClick={() => setHorizon(years)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${horizon === years ? 'bg-white text-violet-700 shadow-sm dark:bg-zinc-700 dark:text-violet-300' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>{years} an{years > 1 ? 's' : ''}</button>)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Valeur actuelle" value={formatCurrency(projection.currentValue)} />
        <Metric label={`Estimation à ${horizon} an${horizon > 1 ? 's' : ''}`} value={formatCurrency(projection.projectedValue)} accent />
        <Metric label="Rendement estimé / an" value={formatPercent(projection.annualRate * 100)} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs><linearGradient id="projectionActualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.18} /><stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--ink-soft)" tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={value => formatCurrency(value).replace('€', '').trim()} tick={{ fontSize: 10 }} stroke="var(--ink-soft)" width={62} domain={yAxis.domain} ticks={yAxis.ticks} />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name === 'Historique' ? 'Historique' : 'Projection estimée']} labelFormatter={(_, payload) => payload?.[0]?.payload.fullDate ?? ''} contentStyle={{ backgroundColor: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--ink)' }} />
            <Area type="monotone" dataKey="actual" name="Historique" stroke="var(--chart-primary)" strokeWidth={2.5} fill="url(#projectionActualFill)" connectNulls={false} />
            <Line type="monotone" dataKey="projected" name="Projection estimée" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="7 5" dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-700">
        <span className="flex items-center gap-2 text-zinc-500"><span className="h-0.5 w-5 bg-[color:var(--chart-primary)]" />Historique</span>
        <span className="flex items-center gap-2 text-zinc-500"><span className="w-5 border-t-2 border-dashed border-violet-500" />Projection estimée</span>
        <span className="text-zinc-400">{projection.isAnnualized ? `Historique de ${projection.observedDays} jours annualisé` : `Rendement annualisé sur ${Math.floor(projection.observedDays / 365)} an(s)`} · estimation non garantie</span>
      </div>
    </ChartShell>
  );
}

function ChartShell({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">{children}</div>;
}

function Metric({ label, value, accent = false, className = '' }: { label: string; value: string; accent?: boolean; className?: string }) {
  return <div className={`rounded-lg p-3 ${accent ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-zinc-50 dark:bg-zinc-800/50'} ${className}`}><p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p><p className={`mt-1 text-base font-bold tabular-nums sm:text-lg ${accent ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</p></div>;
}
