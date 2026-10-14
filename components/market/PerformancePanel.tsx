'use client';

// Onglet Performance (docs/specs/explorateur-marches-v2.md §4.1) : tout actif.

import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  return (
    <Panel
      id="perf-key"
      title="Chiffres clés"
      description={data.totalReturnAvailable ? 'Croissance du cours ; entre parenthèses, avec les dividendes réinvestis.' : 'Croissance annuelle moyenne du cours.'}
    >
      {growth.length > 0 && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {growth.map((g) => (
            <Figure
              key={g.key}
              label={`${growthLabel(g.key, g.since)}, par an`}
              value={<span className={changeClass(g.price)}>{fmtPct(g.price, 1)}</span>}
              detail={g.total !== null ? `(${fmtPct(g.total, 1)} dividendes réinvestis)` : undefined}
            />
          ))}
        </dl>
      )}
      <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stats.allTimeHigh && (
          <Figure
            label="Plus haut historique"
            value={fmtPrice(stats.allTimeHigh.value, data.currency)}
            detail={`le ${fmtDate(stats.allTimeHigh.date)}${stats.allTimeHigh.distance !== null ? ` · cours actuel ${fmtPct(stats.allTimeHigh.distance, 1)}` : ''}`}
          />
        )}
        {dd && (
          <Figure
            label="Pire baisse sur 10 ans"
            value={<span className={changeClass(dd.value)}>{fmtPct(dd.value, 1)}</span>}
            detail={`du ${fmtDate(dd.peakDate)} au ${fmtDate(dd.troughDate)}`}
            hint={dd.value < 0 ? (dd.recoveryDate ? `Plus haut retrouvé le ${fmtDate(dd.recoveryDate)}.` : 'Ce plus haut n’a pas encore été retrouvé.') : undefined}
          />
        )}
        {stats.linearity !== null && (
          <Figure
            label="Régularité de la tendance (10 ans)"
            value={`${Math.round(stats.linearity * 100)} / 100`}
            hint="Proximité du cours avec une progression régulière. 100 : croissance sans à-coups ; près de 0 : pas de tendance."
          />
        )}
        {stats.volatility3y !== null && (
          <Figure
            label="Volatilité sur 3 ans"
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
            hint="Durée la plus longue passée sous un ancien plus haut, sur 10 ans."
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
  if (rows.length < 2) return null;
  return (
    <Panel
      id="perf-years"
      title="Performance par année civile"
      description="Barres claires : année incomplète (première cotation ou année en cours)."
      actions={data.totalReturnAvailable ? (
        <Toggle label="Base de calcul" value={basis} onChange={setBasis} options={[{ value: 'price', label: 'Cours seul' }, { value: 'total', label: 'Dividendes réinvestis' }]} />
      ) : undefined}
    >
      <div className="h-[240px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={pctAxis} tick={chartStyle.tick} axisLine={false} tickLine={false} width={44} />
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
                <Cell key={r.year} fill={r.value >= 0 ? 'var(--gain)' : 'var(--loss)'} fillOpacity={r.partial ? 0.4 : 1} />
              ))}
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

function Seasonality({ data }: { data: PerformanceResponse }) {
  const { monthly } = data;
  if (monthly.years.length < 2) return null;
  return (
    <Panel id="perf-season" title="Saisonnalité" description="Variation du cours chaque mois, en %. Les deux dernières lignes résument les années affichées.">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[11px] tabular-nums sm:text-xs">
          <thead>
            <tr className="text-zinc-500 dark:text-zinc-400">
              <th scope="col" className="sticky left-0 z-10 bg-white px-1.5 py-1 text-left font-normal dark:bg-zinc-900">Année</th>
              {MONTHS.map((m) => <th key={m} scope="col" className="px-1 py-1 text-center font-normal">{m}</th>)}
              <th scope="col" className="px-1.5 py-1 text-right font-medium text-zinc-700 dark:text-zinc-300">Année</th>
            </tr>
          </thead>
          <tbody>
            {monthly.years.map((y) => (
              <tr key={y.year}>
                <th scope="row" className="sticky left-0 z-10 bg-white px-1.5 py-1 text-left font-normal text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{y.year}</th>
                {y.months.map((v, i) => (
                  <td key={i} className="rounded px-1 py-1 text-center text-zinc-900 dark:text-zinc-100" style={heatStyle(v)} title={v === null ? undefined : `${MONTHS[i]} ${y.year} : ${fmtPct(v, 1)}`}>
                    {cellPct(v)}
                  </td>
                ))}
                <td className={`px-1.5 py-1 text-right font-medium ${changeClass(y.total)}`}>{cellPct(y.total)}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 dark:border-zinc-700">
              <th scope="row" className="sticky left-0 z-10 bg-white px-1.5 pb-1 pt-2 text-left font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">Moyenne</th>
              {monthly.average.map((v, i) => (
                <td key={i} className="rounded px-1 py-1 text-center font-medium text-zinc-900 dark:text-zinc-100" style={heatStyle(v)}>{cellPct(v)}</td>
              ))}
              <td />
            </tr>
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-white px-1.5 py-1 text-left font-normal text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">Mois positifs</th>
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
            <YAxis tickFormatter={pctAxis} tick={chartStyle.tick} axisLine={false} tickLine={false} width={44} domain={['dataMin', 0]} />
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
