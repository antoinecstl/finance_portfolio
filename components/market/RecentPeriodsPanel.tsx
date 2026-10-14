'use client';

// Derniers trimestres (ou semestres) publiés : l'année en cours face aux mêmes
// périodes de l'an dernier, avec la variation de chacune et le cumul de l'année.

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { QUARTER_METRICS, yearToDate, type MetricPeriods, type QuarterMetric, type RecentPeriods } from '@/lib/market/quarters';
import { changeClass, fmtMoneyCompact, fmtPct, fmtPrice } from './format';
import { chartStyle, Panel } from './ui';

/** Couleur de l'année en cours : celle de la famille du poste dans l'onglet Finances. */
const METRIC_COLORS: Record<QuarterMetric, string> = {
  revenue: 'var(--series-2)',
  operatingIncome: 'var(--series-2)',
  netIncome: 'var(--series-1)',
  eps: 'var(--series-1)',
  freeCashFlow: 'var(--series-3)',
};
const PREVIOUS_COLOR = 'var(--ink-soft)';

const compactAxis = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

type Row = { slot: string; current: number | null; previous: number | null; yoy: number | null; currentLabel: string | null; previousLabel: string | null };

function rowsOf(periods: MetricPeriods): { rows: Row[]; year: number } {
  const last = periods.points[periods.points.length - 1];
  const slots = periods.kind === 'quarter' ? [1, 2, 3, 4] : [1, 2];
  const prefix = periods.kind === 'quarter' ? 'T' : 'S';
  const at = (year: number, index: number) => periods.points.find((p) => p.year === year && p.index === index);
  const rows = slots.map((index) => {
    const cur = at(last.year, index);
    const prev = at(last.year - 1, index);
    return {
      slot: `${prefix}${index}`,
      current: cur?.value ?? null,
      previous: prev?.value ?? null,
      yoy: cur?.yoy ?? null,
      currentLabel: cur?.label ?? null,
      previousLabel: prev?.label ?? null,
    };
  });
  return { rows: rows.filter((r) => r.current !== null || r.previous !== null), year: last.year };
}

export function RecentPeriodsPanel({ periods, currency }: { periods: RecentPeriods; currency: string }) {
  const metrics = QUARTER_METRICS.filter((m) => periods[m.key]);
  const [selected, setSelected] = useState<QuarterMetric | null>(null);
  const active = metrics.find((m) => m.key === selected) ?? metrics[0];
  if (!active) return null;
  const data = periods[active.key] as MetricPeriods;
  const { rows, year } = rowsOf(data);
  const hasPrevious = rows.some((r) => r.previous !== null);
  const latest = data.points[data.points.length - 1];
  const ytd = yearToDate(data);
  const unit = data.kind === 'quarter' ? 'trimestre' : 'semestre';
  const format = (v: number | null | undefined) => (active.perShare ? fmtPrice(v, currency) : fmtMoneyCompact(v, currency));
  const color = METRIC_COLORS[active.key];

  return (
    <Panel
      id="recent-periods"
      title={data.kind === 'quarter' ? 'Derniers trimestres' : 'Derniers semestres'}
      description={
        <>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{latest.label} : {format(latest.value)}</span>
          {latest.yoy !== null && <span className={`ml-1 ${changeClass(latest.yoy)}`}>{fmtPct(latest.yoy, 1)} sur un an</span>}
          {ytd && ytd.through > 1 && (
            <span className="block">
              Cumul {ytd.year} ({data.kind === 'quarter' ? `T1 à T${ytd.through}` : 'S1 et S2'}) : {format(ytd.value)}
              {ytd.change !== null && <span className={`ml-1 ${changeClass(ytd.change)}`}>{fmtPct(ytd.change, 1)} sur un an</span>}
            </span>
          )}
        </>
      }
    >
      {metrics.length > 1 && (
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1" role="group" aria-label="Poste affiché">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === active.key}
              onClick={() => setSelected(m.key)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition-colors sm:text-sm ${m.key === active.key ? 'btn-ink' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 h-[220px] sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis dataKey="slot" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} />
            <YAxis tickFormatter={(v: number) => (active.perShare ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v) : compactAxis.format(v))} tick={chartStyle.tick} axisLine={false} tickLine={false} width={48} />
            <ReferenceLine y={0} stroke="var(--rule-strong)" />
            <Tooltip
              cursor={chartStyle.cursor}
              contentStyle={chartStyle.tooltip}
              content={({ active: shown, payload }) => {
                const row = shown && payload?.[0] ? (payload[0].payload as Row) : null;
                if (!row) return null;
                return (
                  <div style={chartStyle.tooltip} className="px-3 py-2">
                    {row.currentLabel && <p>{row.currentLabel} : <strong>{format(row.current)}</strong></p>}
                    {row.previousLabel && <p>{row.previousLabel} : {format(row.previous)}</p>}
                    {row.yoy !== null && <p className={changeClass(row.yoy)}>{fmtPct(row.yoy, 1)} sur un an</p>}
                  </div>
                );
              }}
            />
            {hasPrevious && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
            {hasPrevious && (
              <Bar dataKey="previous" name={String(year - 1)} fill={PREVIOUS_COLOR} fillOpacity={0.4} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            )}
            <Bar dataKey="current" name={String(year)} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.slot} fill={r.current !== null && r.current < 0 ? 'var(--loss)' : color} />)}
              <LabelList
                dataKey="yoy"
                position="top"
                content={({ x, y, width, value }) => {
                  if (typeof value !== 'number' || x === undefined || y === undefined || width === undefined) return null;
                  return (
                    <text x={Number(x) + Number(width) / 2} y={Number(y) - 5} textAnchor="middle" fontSize={10} fill={value >= 0 ? 'var(--gain)' : 'var(--loss)'}>
                      {fmtPct(value, 0)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Chaque {unit} {year} face au même {unit} {year - 1}{hasPrevious ? ' ; au-dessus des barres, la variation sur un an' : ''}. Touchez une barre pour le détail.
      </p>
    </Panel>
  );
}
