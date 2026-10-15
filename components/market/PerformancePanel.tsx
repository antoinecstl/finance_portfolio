'use client';

// Onglet Performance (docs/specs/explorateur-marches-v2.md §4.1) : tout actif.

import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AssetClass } from '@/lib/market/asset-class';
import type { PerformanceReport } from '@/lib/market/performance';
import { changeClass, fmtPct, fmtPrice } from './format';
import { chartStyle, Figure, fmtDate, Panel, PanelError, PanelSkeleton, StaleNotice, Toggle, yearTicks } from './ui';
import { useJson } from './useJson';

type PerformanceResponse = PerformanceReport & {
  symbol: string;
  currency: string;
  assetClass: AssetClass;
  timezone: string;
  asOf: string;
  stale: boolean;
};

const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

// Espace fine insécable : « −20 % » ne passe jamais à la ligne sur l'axe.
const pctAxis = (v: number) => `${Math.round(v * 100)}\u202f%`;

/** Largeur d'axe suffisante pour « 2000 % » (crypto) sans gaspiller la place ailleurs. */
const axisWidth = (ticks: number[]) => Math.max(44, ...ticks.map((t) => pctAxis(t).length * 7 + 4));

/** Graduations régulières incluant 0 : pas de 1, 2, 5, 10, 20, 25, 50 ou 100 %, cinq intervalles au plus. */
function pctTicks(min: number, max: number): number[] {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  const span = Math.max(hi - lo, 0.01);
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find((s) => span / s <= 5) ?? Math.ceil(span / 5);
  const ticks: number[] = [];
  for (let k = Math.floor(lo / step + 1e-9); k <= Math.ceil(hi / step - 1e-9); k += 1) ticks.push(Math.round(k * step * 1e6) / 1e6 || 0);
  return ticks;
}

export function PerformancePanel({ symbol }: { symbol: string }) {
  const perf = useJson<PerformanceResponse>(`/api/market/performance?symbol=${encodeURIComponent(symbol)}`);

  if (perf.error) {
    return <PanelError title="Performance" message={perf.error === 'not_found' ? 'Historique de cours indisponible pour ce titre.' : perf.error} onRetry={perf.reload} />;
  }
  if (!perf.data) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PanelSkeleton title="Chiffres clés" height={180} />
        <PanelSkeleton title="Performance par année civile" height={240} />
      </div>
    );
  }
  const data = perf.data;
  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleNotice asOf={data.asOf} stale={data.stale} />
      <KeyFigures data={data} />
      <AnnualReturnsChart data={data} />
      <Seasonality data={data} />
      <DrawdownChart data={data} />
    </div>
  );
}

function KeyFigures({ data }: { data: PerformanceResponse }) {
  const { stats } = data;
  const growthLabel = (key: string, since: string | null) =>
    key === '5A' ? 'Sur 5 ans' : key === '10A' ? 'Sur 10 ans' : `Depuis ${since ? since.slice(0, 4) : 'l’origine'}`;
  const growth = stats.growth.filter((g) => g.price !== null);
  const dd = stats.maxDrawdown;
  // Fenêtres de 3 et 10 ans : « depuis 2024 » quand l'historique coté est plus court.
  const first = data.drawdown[0]?.t;
  const last = data.drawdown[data.drawdown.length - 1]?.t;
  const coverage = (years: number) =>
    first !== undefined && last !== undefined && last - first < (years - 0.1) * 365.25 * 86_400
      ? `depuis ${new Date(first * 1000).getUTCFullYear()}`
      : `sur ${years} ans`;
  return (
    <Panel
      id="perf-key"
      title="Chiffres clés"
      description={data.totalReturnAvailable ? 'Croissance du cours ; entre parenthèses, avec les dividendes réinvestis.' : 'Croissance annuelle moyenne du cours.'}
    >
      {/* Une seule grille : les croissances en tête, puis les autres chiffres, sans case vide quand l'historique est court. */}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {growth.map((g) => (
          <Figure
            key={g.key}
            label={`${growthLabel(g.key, g.since)}, par an`}
            value={<span className={changeClass(g.price)}>{fmtPct(g.price, 1)}</span>}
            detail={g.total !== null ? `(${fmtPct(g.total, 1)} dividendes réinvestis)` : undefined}
          />
        ))}
        {stats.allTimeHigh && (
          <Figure
            label="Plus haut historique"
            value={fmtPrice(stats.allTimeHigh.value, data.currency)}
            detail={`le ${fmtDate(stats.allTimeHigh.date)}${stats.allTimeHigh.distance !== null ? ` · cours actuel ${fmtPct(stats.allTimeHigh.distance, 1)}` : ''}`}
          />
        )}
        {dd && (
          <Figure
            label={`Pire baisse ${coverage(10)}`}
            value={<span className={changeClass(dd.value)}>{fmtPct(dd.value, 1)}</span>}
            detail={`du ${fmtDate(dd.peakDate)} au ${fmtDate(dd.troughDate)}`}
            hint={dd.value < 0 ? (dd.recoveryDate ? `Plus haut retrouvé le ${fmtDate(dd.recoveryDate)}.` : 'Ce plus haut n’a pas encore été retrouvé.') : undefined}
          />
        )}
        {stats.linearity !== null && (
          <Figure
            label={`Régularité de la tendance (${coverage(10).replace('sur ', '')})`}
            value={`${Math.round(stats.linearity * 100)} / 100`}
            hint="Proximité du cours avec une progression régulière. 100 : croissance sans à-coups ; près de 0 : pas de tendance."
          />
        )}
        {stats.volatility3y !== null && (
          <Figure
            label={`Volatilité ${coverage(3)}`}
            value={fmtPct(stats.volatility3y, 1).replace('+', '')}
            hint="Amplitude habituelle des variations sur un an. Plus elle est élevée, plus le cours bouge."
          />
        )}
        {stats.positiveYears && (
          <Figure
            label="Années en hausse"
            value={`${stats.positiveYears.count} sur ${stats.positiveYears.of}`}
            detail={[
              stats.bestYear ? `meilleure : ${stats.bestYear.year} (${fmtPct(stats.bestYear.value, 0)})` : null,
              stats.worstYear ? `pire : ${stats.worstYear.year} (${fmtPct(stats.worstYear.value, 0)})` : null,
            ].filter(Boolean).join(' · ')}
          />
        )}
        {dd && dd.longestUnderwaterDays > 0 && (
          <Figure
            label="Plus longue attente d’un nouveau plus haut"
            value={dd.longestUnderwaterDays >= 365 ? `${(dd.longestUnderwaterDays / 365).toFixed(1).replace('.', ',')} ans` : `${Math.round(dd.longestUnderwaterDays / 30)} mois`}
            hint={`Durée la plus longue passée sous un ancien plus haut, ${coverage(10)}.`}
          />
        )}
      </dl>
    </Panel>
  );
}

function AnnualReturnsChart({ data }: { data: PerformanceResponse }) {
  const [basis, setBasis] = useState<'price' | 'total'>('price');
  const useTotal = basis === 'total' && data.totalReturnAvailable;
  const rows = useMemo(
    () => data.annualReturns
      .map((a) => ({ year: String(a.year), value: useTotal ? a.total : a.price, partial: a.partial }))
      .filter((a): a is { year: string; value: number; partial: boolean } => a.value !== null)
      .slice(-20),
    [data.annualReturns, useTotal]
  );
  const yTicks = useMemo(() => pctTicks(Math.min(...rows.map((r) => r.value)), Math.max(...rows.map((r) => r.value))), [rows]);
  if (rows.length < 2) return null;
  return (
    <Panel
      id="perf-years"
      title="Performance par année civile"
      description="Barres en pointillés : année incomplète (première cotation ou année en cours)."
      actions={data.totalReturnAvailable ? (
        <Toggle label="Base de calcul" value={basis} onChange={setBasis} options={[{ value: 'price', label: 'Cours seul' }, { value: 'total', label: 'Dividendes réinvestis' }]} />
      ) : undefined}
    >
      <div className="h-[240px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: rows.length <= 8 ? 18 : 8, right: 4, bottom: rows.length <= 8 ? 10 : 0, left: 0 }}>
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={pctAxis} tick={chartStyle.tick} axisLine={false} tickLine={false} domain={[yTicks[0], yTicks[yTicks.length - 1]]} ticks={yTicks} interval={0} width={axisWidth(yTicks)} />
            <ReferenceLine y={0} stroke="var(--rule-strong)" />
            <Tooltip
              cursor={chartStyle.cursor}
              contentStyle={chartStyle.tooltip}
              formatter={(value, _name, item) => [
                `${fmtPct(Number(value), 1)}${(item?.payload as { partial?: boolean })?.partial ? ' (année incomplète)' : ''}`,
                useTotal ? 'Dividendes réinvestis' : 'Cours',
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={24} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell
                  key={r.year}
                  fill={r.value >= 0 ? 'var(--gain)' : 'var(--loss)'}
                  fillOpacity={r.partial ? 0.15 : 1}
                  stroke={r.partial ? (r.value >= 0 ? 'var(--gain)' : 'var(--loss)') : undefined}
                  strokeWidth={r.partial ? 1.5 : 0}
                  strokeDasharray={r.partial ? '3 2' : undefined}
                />
              ))}
              {rows.length <= 8 && (
                // Peu d'années : la valeur s'écrit au bout de chaque barre.
                <LabelList
                  dataKey="value"
                  content={({ x, y, width, height, value }) => {
                    if (typeof value !== 'number' || x === undefined || y === undefined || width === undefined || height === undefined) return null;
                    const top = Number(y) + (value < 0 ? Number(height) + 12 : -5);
                    return (
                      <text x={Number(x) + Number(width) / 2} y={top} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">
                        {fmtPct(value, 1)}
                      </text>
                    );
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/** Couleur d'une case : vert ou rouge, d'autant plus soutenu que la variation est forte (plafond ±8 %). */
function heatStyle(value: number | null): React.CSSProperties {
  if (value === null) return {};
  const strength = Math.min(Math.abs(value) / 0.08, 1);
  const color = value >= 0 ? '4, 120, 87' : '185, 28, 28';
  return { backgroundColor: `rgba(${color}, ${0.08 + strength * 0.5})` };
}

const cellPct = (v: number | null) =>
  v === null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v * 100))}`;

// Colonne « Année » figée : fond de la carte, et un liseré de même couleur qui masque
// les cases défilant dans l'espacement entre cellules.
const STICKY = 'sticky left-0 z-10 w-px whitespace-nowrap bg-white shadow-[0_0_0_2px_var(--ui-white)] dark:bg-zinc-900 dark:shadow-[0_0_0_2px_var(--ui-neutral-900)]';

function Seasonality({ data }: { data: PerformanceResponse }) {
  const { monthly } = data;
  if (monthly.years.length < 2) return null;
  return (
    <Panel id="perf-season" title="Saisonnalité" description="Variation du cours chaque mois, en %. Les deux dernières lignes résument les années affichées.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[11px] tabular-nums sm:text-xs">
          <thead>
            <tr className="text-zinc-500 dark:text-zinc-400">
              <th scope="col" className={`${STICKY} px-1.5 py-1 text-left font-normal`}>Année</th>
              {MONTHS.map((m) => <th key={m} scope="col" className="px-1 py-1 text-center font-normal">{m}</th>)}
              <th scope="col" className="px-1.5 py-1 text-right font-medium text-zinc-700 dark:text-zinc-300">Année</th>
            </tr>
          </thead>
          <tbody>
            {monthly.years.map((y) => (
              <tr key={y.year}>
                <th scope="row" className={`${STICKY} px-1.5 py-1 text-left font-normal text-zinc-600 dark:text-zinc-300`}>{y.year}</th>
                {y.months.map((v, i) => (
                  <td key={i} className="rounded px-1 py-1 text-center text-zinc-900 dark:text-zinc-100" style={heatStyle(v)} title={v === null ? undefined : `${MONTHS[i]} ${y.year} : ${fmtPct(v, 1)}`}>
                    {cellPct(v)}
                  </td>
                ))}
                <td className={`px-1.5 py-1 text-right font-medium ${changeClass(y.total)}`}>{cellPct(y.total)}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <th scope="row" className={`${STICKY} px-1.5 pb-1 pt-2 text-left font-medium text-zinc-700 dark:text-zinc-300`}>Moyenne</th>
              {monthly.average.map((v, i) => (
                <td key={i} className="rounded px-1 py-1 text-center font-medium text-zinc-900 dark:text-zinc-100" style={heatStyle(v)}>{cellPct(v)}</td>
              ))}
              <td />
            </tr>
            <tr>
              <th scope="row" className={`${STICKY} px-1.5 py-1 text-left font-normal leading-tight text-zinc-500 dark:text-zinc-400`}>Mois<br />positifs</th>
              {monthly.positiveShare.map((v, i) => (
                <td key={i} className="px-1 py-1 text-center text-zinc-600 dark:text-zinc-300">{v === null ? '' : `${Math.round(v * 100)} %`}</td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function DrawdownChart({ data }: { data: PerformanceResponse }) {
  const rows = useMemo(() => data.drawdown.map((p) => ({ t: p.t * 1000, dd: p.dd })), [data.drawdown]);
  if (rows.length < 10) return null;
  const dd = data.stats.maxDrawdown;
  const yTicks = pctTicks(Math.min(...rows.map((r) => r.dd)), 0);
  return (
    <Panel
      id="perf-drawdown"
      title="Pertes depuis le plus haut"
      description={`Écart du cours avec le plus haut atteint jusque-là${dd ? ` ; pire moment : ${fmtPct(dd.value, 1)} le ${fmtDate(dd.troughDate)}` : ''}.`}
    >
      <div className="h-[200px] sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              ticks={yearTicks(rows[0].t, rows[rows.length - 1].t)}
              tickFormatter={(t: number) => String(new Date(t).getUTCFullYear())}
              tick={chartStyle.tick}
              stroke="var(--rule)"
              tickLine={false}
              minTickGap={16}
            />
            <YAxis tickFormatter={pctAxis} tick={chartStyle.tick} axisLine={false} tickLine={false} width={44} domain={[yTicks[0], 0]} ticks={yTicks} interval={0} />
            <Tooltip
              contentStyle={chartStyle.tooltip}
              labelFormatter={(t) => new Date(Number(t)).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
              formatter={(value) => [fmtPct(Number(value), 1), 'Sous le plus haut']}
            />
            <Area type="monotone" dataKey="dd" stroke="var(--loss)" strokeWidth={2} fill="var(--loss)" fillOpacity={0.12} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
