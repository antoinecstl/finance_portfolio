'use client';

import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildNiceYAxisScale } from '@/lib/chart-axis';
import { useEvenXTicks } from '@/lib/use-even-x-ticks';
import { alignToTimeline, simpleMovingAverage, toRelativeChange } from '@/lib/market/analytics';
import type { MarketPoint } from '@/lib/market/chart-data';
import { movingAverageWindow, type ChartInterval, type ChartPeriod } from '@/lib/market/periods';
import type { Transaction } from '@/lib/types';
import { fmtCompact, fmtPct, fmtPrice } from './format';

export const MOVING_AVERAGES = [
  { days: 20, color: 'var(--chart-6)' },
  { days: 50, color: 'var(--chart-3)' },
  { days: 200, color: 'var(--chart-5)' },
] as const;

export const COMPARE_COLORS = ['var(--chart-10)', 'var(--chart-7)', 'var(--chart-2)'] as const;

export interface CompareSeries {
  symbol: string;
  label: string;
  points: MarketPoint[];
}

type MarkerType = 'BUY' | 'SELL' | 'DIVIDEND';
const MARKER = {
  BUY: { glyph: '▲', color: 'var(--gain)', label: 'Achat' },
  SELL: { glyph: '▼', color: 'var(--loss)', label: 'Vente' },
  DIVIDEND: { glyph: '◆', color: 'var(--chart-3)', label: 'Dividende' },
} as const;

interface Row {
  key: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  range: [number, number];
  up: boolean;
  [series: string]: number | boolean | string | [number, number] | null | undefined;
}

const DAY = 86_400;

function dateFormatter(period: ChartPeriod, timezone: string, forTooltip: boolean) {
  const base: Intl.DateTimeFormatOptions = { timeZone: timezone };
  if (forTooltip) {
    return new Intl.DateTimeFormat('fr-FR', period === '1J' || period === '5J'
      ? { ...base, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { ...base, day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (period === '1J') return new Intl.DateTimeFormat('fr-FR', { ...base, hour: '2-digit', minute: '2-digit' });
  if (period === '5J') return new Intl.DateTimeFormat('fr-FR', { ...base, weekday: 'short', day: 'numeric' });
  if (period === '5A' || period === 'MAX') return new Intl.DateTimeFormat('fr-FR', { ...base, month: 'short', year: '2-digit' });
  return new Intl.DateTimeFormat('fr-FR', { ...base, day: 'numeric', month: 'short' });
}

// Jour calendaire d'un instant dans le fuseau de la place de cotation.
function dayInZone(t: number, timezone: string): string {
  return new Date(t * 1000).toLocaleDateString('sv-SE', { timeZone: timezone });
}

export function MarketChart({
  points,
  displayFrom,
  period,
  interval,
  intraday,
  timezone,
  currency,
  mode,
  movingAverages,
  compare,
  transactions,
  previousClose,
  symbolLabel,
}: {
  points: MarketPoint[];
  displayFrom: number | null;
  period: ChartPeriod;
  interval: ChartInterval;
  intraday: boolean;
  timezone: string;
  currency: string;
  mode: 'line' | 'candles';
  movingAverages: number[];
  compare: CompareSeries[];
  transactions: Transaction[];
  previousClose: number | null;
  symbolLabel: string;
}) {
  const comparing = compare.length > 0 && !intraday;
  const tickFormat = useMemo(() => dateFormatter(period, timezone, false), [period, timezone]);
  const tooltipFormat = useMemo(() => dateFormatter(period, timezone, true), [period, timezone]);

  const { rows, markersCount } = useMemo(() => {
    const start = Math.max(0, points.findIndex((p) => p.t >= (displayFrom ?? 0)));
    const shown = points.slice(start);
    const closes = points.map((p) => p.c);
    const smas = intraday
      ? []
      : movingAverages.map((days) => ({ days, values: simpleMovingAverage(closes, movingAverageWindow(days, interval)) }));

    const out: Row[] = shown.map((p, k) => {
      const row: Row = { key: p.t, o: p.o, h: p.h, l: p.l, c: p.c, v: p.v, range: [p.l, p.h], up: p.c >= p.o };
      for (const s of smas) row[`sma${s.days}`] = s.values[start + k];
      return row;
    });

    if (comparing) {
      const timeline = shown.map((p) => p.t);
      const tolerance = interval === '1d' ? DAY / 2 : 3 * DAY;
      const main = toRelativeChange(shown.map((p) => p.c));
      out.forEach((row, i) => { row.pct_main = main[i]; });
      compare.forEach((series, n) => {
        const rel = toRelativeChange(alignToTimeline(timeline, series.points, tolerance));
        out.forEach((row, i) => { row[`pct_${n}`] = rel[i]; });
      });
    }

    // Vos opérations : rattachées à la première cotation du jour ou après.
    let count = 0;
    if (!intraday && !comparing && out.length > 0) {
      const days = out.map((r) => dayInZone(r.key, timezone));
      const relevant = transactions
        .filter((t): t is Transaction & { type: MarkerType } => t.type === 'BUY' || t.type === 'SELL' || t.type === 'DIVIDEND')
        .filter((t) => t.date >= days[0] && t.date <= days[days.length - 1])
        .sort((a, b) => a.date.localeCompare(b.date));
      for (const tx of relevant) {
        const index = days.findIndex((d) => d >= tx.date);
        if (index < 0) continue;
        const row = out[index];
        count++;
        if (row.markerType) {
          row.markerExtra = Number(row.markerExtra ?? 0) + 1;
          continue;
        }
        row.markerPrice = row.c;
        row.markerType = tx.type;
      }
    }
    return { rows: out, markersCount: count };
  }, [points, displayFrom, intraday, movingAverages, interval, comparing, compare, transactions, timezone]);

  const ticks = useEvenXTicks(useMemo(() => rows.map((r) => r.key), [rows]), period === '5J' ? 64 : 72);

  const yScale = useMemo(() => {
    if (comparing) {
      const values: number[] = [];
      for (const r of rows) {
        for (const k of ['pct_main', ...compare.map((_, n) => `pct_${n}`)]) {
          const v = r[k];
          if (typeof v === 'number') values.push(v);
        }
      }
      return buildNiceYAxisScale(values.length ? values : [0], { includeZero: true });
    }
    const values: number[] = [];
    for (const r of rows) {
      if (mode === 'candles') values.push(r.l, r.h);
      else values.push(r.c);
      for (const days of movingAverages) {
        const v = r[`sma${days}`];
        if (typeof v === 'number') values.push(v);
      }
    }
    if (period === '1J' && previousClose) values.push(previousClose);
    return buildNiceYAxisScale(values, { includeZero: false });
  }, [rows, comparing, compare, mode, movingAverages, period, previousClose]);

  const maxVolume = useMemo(() => Math.max(0, ...rows.map((r) => r.v)), [rows]);
  const priceDecimals = yScale.step >= 10 ? 0 : yScale.step >= 1 ? 1 : yScale.step >= 0.1 ? 2 : 3;

  if (rows.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Aucune cotation sur cette période.
      </div>
    );
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const high = Math.max(...rows.map((r) => r.h));
  const low = Math.min(...rows.map((r) => r.l));
  const summary = `${symbolLabel} : de ${fmtPrice(first.c, currency)} à ${fmtPrice(last.c, currency)} sur la période (${fmtPct(last.c / first.c - 1)}), plus haut ${fmtPrice(high, currency)}, plus bas ${fmtPrice(low, currency)}.`;

  return (
    <div>
      <p className="sr-only">{summary}</p>
      <div className="h-[320px] sm:h-[400px]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" onResize={ticks.onResize}>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 18, bottom: 0 }} barCategoryGap={rows.length > 150 ? 0 : '15%'}>
            <defs>
              <linearGradient id="marketAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.14} />
                <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="key"
              ticks={ticks.ticks}
              interval={0}
              tickFormatter={(t) => tickFormat.format(new Date(Number(t) * 1000))}
              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
              stroke="var(--chart-grid)"
              minTickGap={8}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              domain={yScale.domain}
              ticks={yScale.ticks}
              width={56}
              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
              stroke="var(--chart-grid)"
              tickFormatter={(v) =>
                comparing
                  ? fmtPct(Number(v), 0)
                  : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals }).format(Number(v))
              }
            />
            <YAxis yAxisId="volume" hide domain={[0, maxVolume * 4 || 1]} />

            <Tooltip
              cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                return (
                  <div className="rounded-lg border border-[color:var(--chart-tooltip-br)] bg-[color:var(--chart-tooltip-bg)] px-3 py-2 text-xs text-[color:var(--chart-tooltip-fg)] shadow-sm">
                    <p className="mb-1 font-semibold">{tooltipFormat.format(new Date(row.key * 1000))}</p>
                    {comparing ? (
                      <>
                        <p><span style={{ color: 'var(--chart-primary)' }}>●</span> {symbolLabel} : {fmtPct(row.pct_main as number | null)}</p>
                        {compare.map((s, n) => (
                          <p key={s.symbol}><span style={{ color: COMPARE_COLORS[n] }}>●</span> {s.label} : {fmtPct(row[`pct_${n}`] as number | null)}</p>
                        ))}
                      </>
                    ) : (
                      <>
                        <p className="tabular-nums">Clôture : <span className="font-medium">{fmtPrice(row.c, currency)}</span></p>
                        <p className="tabular-nums text-[color:var(--chart-axis)]">
                          O {fmtPrice(row.o, currency)} · H {fmtPrice(row.h, currency)} · B {fmtPrice(row.l, currency)}
                        </p>
                        {row.v > 0 && <p className="tabular-nums text-[color:var(--chart-axis)]">Volume : {fmtCompact(row.v)}</p>}
                        {movingAverages.map((days) => {
                          const v = row[`sma${days}`];
                          return typeof v === 'number' ? (
                            <p key={days} className="tabular-nums">
                              <span style={{ color: MOVING_AVERAGES.find((m) => m.days === days)?.color }}>━</span> MM {days} j : {fmtPrice(v, currency)}
                            </p>
                          ) : null;
                        })}
                        {row.markerType && (
                          <p className="mt-1 font-medium" style={{ color: MARKER[row.markerType as MarkerType].color }}>
                            {MARKER[row.markerType as MarkerType].glyph} {MARKER[row.markerType as MarkerType].label}
                            {row.markerExtra ? ` + ${row.markerExtra} autre(s)` : ''}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              }}
            />

            {!comparing && maxVolume > 0 && (
              <Bar yAxisId="volume" dataKey="v" fill="var(--chart-axis)" fillOpacity={0.22} isAnimationActive={false} />
            )}

            {period === '1J' && previousClose && !comparing && (
              <ReferenceLine
                yAxisId="price"
                y={previousClose}
                stroke="var(--chart-axis)"
                strokeDasharray="4 4"
                label={{ value: 'Clôture veille', position: 'insideTopLeft', fontSize: 10, fill: 'var(--chart-axis)' }}
              />
            )}

            {comparing ? (
              <>
                <Line yAxisId="price" dataKey="pct_main" stroke="var(--chart-primary)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                {compare.map((s, n) => (
                  <Line key={s.symbol} yAxisId="price" dataKey={`pct_${n}`} stroke={COMPARE_COLORS[n]} strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />
                ))}
              </>
            ) : mode === 'candles' ? (
              <Bar yAxisId="price" dataKey="range" isAnimationActive={false} shape={CandleShape} />
            ) : (
              <Area yAxisId="price" dataKey="c" stroke="var(--chart-primary)" strokeWidth={2} fill="url(#marketAreaFill)" dot={false} isAnimationActive={false} />
            )}

            {!comparing && !intraday && MOVING_AVERAGES.filter((m) => movingAverages.includes(m.days)).map((m) => (
              <Line key={m.days} yAxisId="price" dataKey={`sma${m.days}`} stroke={m.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            ))}

            {!comparing && markersCount > 0 && (
              <Scatter
                yAxisId="price"
                dataKey="markerPrice"
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: Row };
                  const type = payload?.markerType as MarkerType | undefined;
                  if (cx == null || cy == null || !type) return <g />;
                  const offset = type === 'SELL' ? -12 : 16;
                  return (
                    <text x={cx} y={cy + offset} textAnchor="middle" fontSize={13} fill={MARKER[type].color}>
                      {MARKER[type].glyph}
                    </text>
                  );
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {(markersCount > 0 || comparing || (!intraday && movingAverages.length > 0)) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {comparing && (
            <>
              <span><span style={{ color: 'var(--chart-primary)' }}>━</span> {symbolLabel}</span>
              {compare.map((s, n) => <span key={s.symbol}><span style={{ color: COMPARE_COLORS[n] }}>━</span> {s.label}</span>)}
            </>
          )}
          {!comparing && !intraday && MOVING_AVERAGES.filter((m) => movingAverages.includes(m.days)).map((m) => (
            <span key={m.days}><span style={{ color: m.color }}>━</span> Moyenne mobile {m.days} jours</span>
          ))}
          {!comparing && markersCount > 0 && (
            <>
              {(['BUY', 'SELL', 'DIVIDEND'] as const).map((type) => (
                <span key={type}><span style={{ color: MARKER[type].color }}>{MARKER[type].glyph}</span> {MARKER[type].label}</span>
              ))}
              <span>({markersCount} opération{markersCount > 1 ? 's' : ''} sur la période)</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Chandelier dessiné dans la barre [plus bas, plus haut] fournie par Recharts :
// la mèche couvre toute la barre, le corps va de l'ouverture à la clôture.
function CandleShape(props: unknown) {
  const { x, y, width, height, payload } = props as { x?: number; y?: number; width?: number; height?: number; payload?: Row };
  if (x == null || y == null || width == null || height == null || !payload) return <g />;
  const { o, c, h, l, up } = payload;
  const span = h - l || 1;
  const yOf = (value: number) => y + ((h - value) / span) * height;
  const bodyTop = yOf(Math.max(o, c));
  const bodyHeight = Math.max(1, yOf(Math.min(o, c)) - bodyTop);
  const color = up ? 'var(--gain)' : 'var(--loss)';
  const cx = x + width / 2;
  const bodyWidth = Math.max(1, width * 0.7);
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  );
}
