'use client';

// Onglet Finances d'une action (docs/specs/explorateur-marches-v2.md §4.2) :
// l'histoire des comptes en petits graphiques à une seule échelle, un graphique
// personnalisé et le tableau des comptes.

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, X } from 'lucide-react';
import {
  availableMetrics,
  HISTORY_METRICS,
  indexTo100,
  metricGrowth,
  metricValues,
  type HistoryMetric,
  type HistoryRow,
  type MetricUnit,
} from '@/lib/market/history';
import type { StatementRow } from '@/lib/market/fundamentals';
import { AccountsTable, useFundamentals, type FundamentalsResponse } from './MarketFundamentals';
import { changeClass, fmtCompact, fmtMoneyCompact, fmtMultiple, fmtPct, fmtPrice, fmtShare } from './format';
import { RecentPeriodsPanel } from './RecentPeriodsPanel';
import { chartStyle, Panel, PanelError, PanelSkeleton, StaleNotice, Toggle } from './ui';

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

export function formatValue(unit: MetricUnit, value: number | null | undefined, currency: string): string {
  switch (unit) {
    case 'money': return fmtMoneyCompact(value, currency);
    case 'perShare': return fmtPrice(value, currency);
    case 'percent': return fmtShare(value, 1);
    case 'multiple': return fmtMultiple(value);
    case 'count': return fmtCompact(value);
  }
}

function axisFormatter(unit: MetricUnit): (v: number) => string {
  const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
  switch (unit) {
    case 'percent': return (v) => `${Math.round(v * 100)} %`;
    case 'multiple': return (v) => `${compact.format(v)}×`;
    case 'perShare': return (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
    default: return (v) => compact.format(v);
  }
}

type CardSeries = { key: HistoryMetric; label: string; color: string };

interface CardDef {
  id: string;
  title: string;
  unit: MetricUnit;
  kind: 'bar' | 'line';
  series: CardSeries[];
  /** Barres vertes / rouges selon le signe (résultats, flux). */
  signed?: boolean;
  growth?: HistoryMetric;
  /** Montant exprimé dans la devise de cotation (dividendes). */
  quoteCurrency?: boolean;
  note?: (history: HistoryRow[]) => string | null;
  /** Variation sur un an affichée au-dessus des barres (montants seulement). */
  yoyLabels?: boolean;
}

// Une couleur par famille de postes, dans l'ordre validé des séries :
// activité, résultats, trésorerie, actionnaires ; la dette reste à l'encre.
const FAMILY = {
  activity: 'var(--series-2)',
  results: 'var(--series-1)',
  cash: 'var(--series-3)',
  shareholders: 'var(--series-4)',
  debt: 'var(--chart-1)',
} as const;
/** Famille de chaque indicateur : la même couleur dans les petits graphiques et le graphique personnalisé. */
const FAMILY_OF: Partial<Record<HistoryMetric, keyof typeof FAMILY>> = {
  revenue: 'activity', grossProfit: 'activity', ebitda: 'activity', operatingIncome: 'activity',
  grossMargin: 'activity', operatingMargin: 'activity',
  netIncome: 'results', eps: 'results', netMargin: 'results', roe: 'results',
  operatingCashFlow: 'cash', freeCashFlow: 'cash', fcfPerShare: 'cash', fcfMargin: 'cash', cash: 'cash',
  dividendPerShare: 'shareholders', payoutRatio: 'shareholders', shares: 'shareholders', equity: 'shareholders',
  totalDebt: 'debt', netDebt: 'debt', netDebtToEbitda: 'debt',
};
const PICK_COLORS = [...SERIES_COLORS, FAMILY.debt];

/** Couleur d'un indicateur ajouté : celle de sa famille, sinon la première couleur libre. */
function colorFor(key: HistoryMetric, taken: string[]): string {
  const family = FAMILY_OF[key];
  const preferred = family ? FAMILY[family] : null;
  if (preferred && !taken.includes(preferred)) return preferred;
  return PICK_COLORS.find((c) => !taken.includes(c)) ?? SERIES_COLORS[0];
}

/** Exercices antérieurs au dernier : même couleur, atténuée. */
const PAST_OPACITY = 0.55;
/** Au-delà, la variation n'est écrite que sur le dernier exercice. */
const MAX_YOY_LABELS = 8;

const CARDS: CardDef[] = [
  { id: 'revenue', title: 'Chiffre d’affaires', unit: 'money', kind: 'bar', series: [{ key: 'revenue', label: 'Chiffre d’affaires', color: FAMILY.activity }], growth: 'revenue', yoyLabels: true },
  {
    id: 'margins',
    title: 'Marges',
    unit: 'percent',
    kind: 'line',
    series: [
      { key: 'grossMargin', label: 'Brute', color: SERIES_COLORS[0] },
      { key: 'operatingMargin', label: 'Opérationnelle', color: SERIES_COLORS[1] },
      { key: 'netMargin', label: 'Nette', color: SERIES_COLORS[2] },
    ],
  },
  { id: 'net', title: 'Résultat net', unit: 'money', kind: 'bar', signed: true, series: [{ key: 'netIncome', label: 'Résultat net', color: FAMILY.results }], growth: 'netIncome', yoyLabels: true },
  { id: 'eps', title: 'Bénéfice par action (dilué)', unit: 'perShare', kind: 'bar', signed: true, series: [{ key: 'eps', label: 'BPA', color: FAMILY.results }], growth: 'eps', yoyLabels: true },
  {
    id: 'fcf',
    title: 'Free cash flow',
    unit: 'money',
    kind: 'bar',
    signed: true,
    series: [{ key: 'freeCashFlow', label: 'Free cash flow', color: FAMILY.cash }],
    growth: 'freeCashFlow',
    yoyLabels: true,
    note: (h) => {
      const last = [...h].reverse().find((r) => r.values.fcfMargin !== null);
      return last ? `Marge FCF ${last.year} : ${fmtShare(last.values.fcfMargin, 1)} du chiffre d’affaires.` : null;
    },
  },
  {
    id: 'cash-debt',
    title: 'Trésorerie et dette',
    unit: 'money',
    kind: 'bar',
    series: [
      { key: 'cash', label: 'Trésorerie', color: FAMILY.cash },
      { key: 'totalDebt', label: 'Dette financière', color: FAMILY.debt },
    ],
  },
  {
    id: 'leverage',
    title: 'Dette nette / EBITDA',
    unit: 'multiple',
    kind: 'bar',
    series: [{ key: 'netDebtToEbitda', label: 'Dette nette / EBITDA', color: FAMILY.debt }],
    note: () => 'Années d’EBITDA pour rembourser la dette nette. Négatif : plus de trésorerie que de dette.',
  },
  { id: 'dps', title: 'Dividende par action', unit: 'perShare', kind: 'bar', quoteCurrency: true, series: [{ key: 'dividendPerShare', label: 'Dividende', color: FAMILY.shareholders }], growth: 'dividendPerShare', yoyLabels: true, note: () => 'Versements de l’année civile.' },
  { id: 'payout', title: 'Taux de distribution', unit: 'percent', kind: 'bar', series: [{ key: 'payoutRatio', label: 'Distribution / bénéfice', color: FAMILY.shareholders }], note: () => 'Dividendes versés / résultat net.' },
  {
    id: 'shares',
    title: 'Nombre d’actions',
    unit: 'count',
    kind: 'bar',
    series: [{ key: 'shares', label: 'Actions', color: FAMILY.shareholders }],
    note: (h) => {
      const values = h.map((r) => r.values.shares ?? r.values.dilutedShares).filter((v): v is number => v !== null && v > 0);
      if (values.length < 2) return null;
      const change = values[values.length - 1] / values[0] - 1;
      if (Math.abs(change) < 0.01) return 'Stable sur la période.';
      return change < 0 ? `${fmtPct(change, 1)} sur la période : rachats d’actions.` : `${fmtPct(change, 1)} sur la période : dilution.`;
    },
  },
  { id: 'roe', title: 'Rentabilité des capitaux propres (ROE)', unit: 'percent', kind: 'bar', signed: true, series: [{ key: 'roe', label: 'ROE', color: FAMILY.results }], note: () => 'Résultat net / capitaux propres.' },
];

export function FinancesPanel({ symbol, priceCurrency }: { symbol: string; priceCurrency: string }) {
  const fundamentals = useFundamentals(symbol);
  if (fundamentals.error) {
    return <PanelError title="Finances" message="Données financières momentanément indisponibles." onRetry={fundamentals.reload} />;
  }
  if (!fundamentals.data) {
    return (
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <PanelSkeleton title="Chiffre d’affaires" height={180} />
        <PanelSkeleton title="Marges" height={180} />
      </div>
    );
  }
  const data = fundamentals.data;
  if (!data.available || !data.history || data.history.length === 0) {
    return <PanelError title="Finances" message="Pas de comptes publiés disponibles pour ce titre." />;
  }
  return <FinancesContent data={data} priceCurrency={priceCurrency} />;
}

function FinancesContent({ data, priceCurrency }: { data: FundamentalsResponse; priceCurrency: string }) {
  const history = data.history;
  const first = history[0]?.year;
  const last = history[history.length - 1]?.year;
  const cards = CARDS.filter((c) => c.series.some((s) => metricValues(history, s.key).filter((v) => v !== null).length >= 2));
  const tableRows = useMemo(
    () => history.map((h) => ({ date: h.date, ...h.values }) as unknown as StatementRow),
    [history]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleNotice asOf={data.asOf} stale={data.stale} />
      {data.periods && Object.keys(data.periods).length > 0 && <RecentPeriodsPanel periods={data.periods} currency={data.currency} />}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {history.length} exercice{history.length > 1 ? 's' : ''} publié{history.length > 1 ? 's' : ''} ({first}–{last}), en {data.currency}.
        {data.sources?.official ? ' Comptes annuels officiels déposés auprès du régulateur boursier américain, complétés si besoin.' : ''}
      </p>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {cards.map((card, i) => (
          // Nombre impair de graphiques : le dernier prend toute la largeur (pas de trou dans la grille).
          <div key={card.id} className={`[&>section]:h-full ${cards.length % 2 === 1 && i === cards.length - 1 ? 'lg:col-span-2' : ''}`}>
            <MetricCard card={card} history={history} currency={card.quoteCurrency ? priceCurrency : data.currency} />
          </div>
        ))}
      </div>
      <CustomChart history={history} currency={data.currency} />
      <Panel id="accounts" title={`Comptes annuels (${data.currency})`} description="Vue tableau des graphiques ci-dessus ; « 12 mois » : derniers trimestres publiés.">
        <AccountsTable rows={tableRows} ttm={data.ttm} currency={data.currency} />
      </Panel>
    </div>
  );
}

/** Variation d'un exercice au précédent, si la base est positive. */
function yearOverYear(values: Array<number | null>): Array<number | null> {
  return values.map((v, i) => {
    const prev = i > 0 ? values[i - 1] : null;
    return v !== null && prev !== null && prev > 0 ? v / prev - 1 : null;
  });
}

function MetricCard({ card, history, currency }: { card: CardDef; history: HistoryRow[]; currency: string }) {
  const main = card.series[0];
  const single = card.series.length === 1;
  const yoy = yearOverYear(metricValues(history, main.key));
  const lastIndex = history.reduce((acc, h, i) => (h.values[main.key] !== null ? i : acc), -1);
  const rows = history.map((h, i) => {
    const row: Record<string, number | string | null> = { year: String(h.year) };
    for (const s of card.series) row[s.key] = h.values[s.key];
    // Variation écrite au-dessus des barres : toutes si elles sont peu nombreuses, sinon la dernière.
    row.__yoy = card.yoyLabels && (history.length <= MAX_YOY_LABELS || i === lastIndex) ? yoy[i] : null;
    return row;
  });
  const latest = [...history].reverse().find((h) => h.values[main.key] !== null);
  const growth = card.growth ? metricGrowth(history, card.growth) : null;
  const note = card.note?.(history) ?? null;
  const format = (v: number | null | undefined) => formatValue(card.unit, v, currency);

  return (
    <Panel
      id={`fin-${card.id}`}
      title={card.title}
      description={
        <>
          {card.series.length === 1 && latest ? <span className="font-medium text-zinc-900 dark:text-zinc-100">{format(latest.values[main.key])} en {latest.year}</span> : null}
          {growth ? <span className={`ml-1 ${changeClass(growth.rate)}`}>{fmtPct(growth.rate, 1)} par an sur {growth.years} ans</span> : null}
          {note ? <span className="block">{note}</span> : null}
        </>
      }
    >
      <div className="h-[170px] sm:h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          {card.kind === 'bar' ? (
            <BarChart data={rows} margin={{ top: card.yoyLabels ? 16 : 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid vertical={false} {...chartStyle.grid} />
              <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={6} />
              <YAxis tickFormatter={axisFormatter(card.unit)} tick={chartStyle.tick} axisLine={false} tickLine={false} width={48} />
              <ReferenceLine y={0} stroke="var(--rule-strong)" />
              <Tooltip
                cursor={chartStyle.cursor}
                contentStyle={chartStyle.tooltip}
                formatter={(v, name, item) => {
                  const change = single ? yoy[history.findIndex((h) => String(h.year) === (item?.payload as { year?: string })?.year)] : null;
                  return [`${format(Number(v))}${card.yoyLabels && change != null ? ` (${fmtPct(change, 1)} sur un an)` : ''}`, String(name)];
                }}
              />
              {!single && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              {card.series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                  {rows.map((r, i) => {
                    const v = r[s.key] as number | null;
                    return (
                      <Cell
                        key={String(r.year)}
                        fill={card.signed && v !== null && v < 0 ? 'var(--loss)' : s.color}
                        // Le dernier exercice ressort ; les précédents gardent la couleur, atténuée.
                        fillOpacity={single && i !== lastIndex ? PAST_OPACITY : 1}
                      />
                    );
                  })}
                  {single && card.yoyLabels && (
                    <LabelList
                      dataKey="__yoy"
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
                  )}
                </Bar>
              ))}
            </BarChart>
          ) : (
            <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} {...chartStyle.grid} />
              <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={6} />
              <YAxis tickFormatter={axisFormatter(card.unit)} tick={chartStyle.tick} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={chartStyle.tooltip} formatter={(v, name) => [format(Number(v)), String(name)]} />
              <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 12 }} />
              {card.series.map((s, i) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={i === 1 ? '6 3' : i === 2 ? '2 3' : undefined}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const INDEXABLE: MetricUnit[] = ['money', 'perShare', 'count'];

/** Graphique personnalisé : jusqu'à 4 indicateurs ; une couleur reste attachée à son indicateur. */
function CustomChart({ history, currency }: { history: HistoryRow[]; currency: string }) {
  const available = useMemo(() => availableMetrics(history), [history]);
  const [picked, setPicked] = useState<Array<{ key: HistoryMetric; color: string }>>(() =>
    (['revenue', 'netIncome', 'freeCashFlow'] as HistoryMetric[])
      .filter((k) => available.some((m) => m.key === k))
      .reduce<Array<{ key: HistoryMetric; color: string }>>((acc, key) => [...acc, { key, color: colorFor(key, acc.map((p) => p.color)) }], [])
  );
  const [mode, setMode] = useState<'values' | 'index'>('values');
  const [adding, setAdding] = useState(false);

  if (available.length === 0) return null;
  const defOf = (key: HistoryMetric) => HISTORY_METRICS.find((m) => m.key === key) as (typeof HISTORY_METRICS)[number];
  const add = (key: HistoryMetric) => {
    setAdding(false);
    setPicked((prev) => {
      if (prev.length >= 4 || prev.some((p) => p.key === key)) return prev;
      return [...prev, { key, color: colorFor(key, prev.map((p) => p.color)) }];
    });
  };
  const remove = (key: HistoryMetric) => setPicked((prev) => prev.filter((p) => p.key !== key));

  const years = history.map((h) => String(h.year));
  const shown = mode === 'index' ? picked.filter((p) => INDEXABLE.includes(defOf(p.key).unit)) : picked;
  const excluded = mode === 'index' ? picked.filter((p) => !INDEXABLE.includes(defOf(p.key).unit)) : [];

  // Mode valeurs : un graphique par unité (une seule échelle chacun).
  const groups = mode === 'values'
    ? [...new Set(shown.map((p) => defOf(p.key).unit))].map((unit) => ({ unit, series: shown.filter((p) => defOf(p.key).unit === unit) }))
    : [];
  const indexRows = mode === 'index'
    ? years.map((year, i) => {
      const row: Record<string, string | number | null> = { year };
      for (const p of shown) row[p.key] = indexTo100(metricValues(history, p.key))[i];
      return row;
    })
    : [];

  return (
    <Panel
      id="custom-chart"
      title="Graphique personnalisé"
      description="Choisissez jusqu’à 4 indicateurs. En base 100, chaque série part de 100 à son premier exercice positif pour comparer les croissances."
      actions={<Toggle label="Affichage" value={mode} onChange={setMode} options={[{ value: 'values', label: 'Valeurs' }, { value: 'index', label: 'Base 100' }]} />}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {picked.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-2.5 pr-1 dark:border-zinc-700">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
            <span className="text-zinc-700 dark:text-zinc-300">{defOf(p.key).label}</span>
            <button type="button" onClick={() => remove(p.key)} aria-label={`Retirer ${defOf(p.key).label}`} className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {picked.length < 4 && (
          adding ? (
            <select
              autoFocus
              aria-label="Indicateur à ajouter"
              defaultValue=""
              onChange={(e) => e.target.value && add(e.target.value as HistoryMetric)}
              onBlur={() => setAdding(false)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="" disabled>Choisir un indicateur…</option>
              {available.filter((m) => !picked.some((p) => p.key === m.key)).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          )
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {excluded.length > 0 ? 'Les ratios et pourcentages ne se mettent pas en base 100 : affichez-les en valeurs.' : 'Ajoutez un indicateur.'}
        </p>
      ) : mode === 'index' ? (
        <>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={indexRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} {...chartStyle.grid} />
                <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={6} />
                <YAxis tick={chartStyle.tick} axisLine={false} tickLine={false} width={40} />
                <ReferenceLine y={100} stroke="var(--rule-strong)" />
                <Tooltip contentStyle={chartStyle.tooltip} formatter={(v, name) => [new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v)), String(name)]} />
                <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 12 }} />
                {shown.map((p) => (
                  <Line key={p.key} dataKey={p.key} name={defOf(p.key).label} stroke={p.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: p.color }} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {excluded.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Non affichés en base 100 : {excluded.map((p) => defOf(p.key).label).join(', ')} (ratios).
            </p>
          )}
        </>
      ) : (
        <div className={`mt-4 grid gap-4 ${groups.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {groups.map((group) => {
            const rows = years.map((year, i) => {
              const row: Record<string, string | number | null> = { year };
              for (const p of group.series) row[p.key] = history[i].values[p.key];
              return row;
            });
            const lines = group.unit === 'percent' || group.unit === 'multiple';
            const format = (v: number) => formatValue(group.unit, v, currency);
            return (
              <div key={group.unit} className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  {lines ? (
                    <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} {...chartStyle.grid} />
                      <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={6} />
                      <YAxis tickFormatter={axisFormatter(group.unit)} tick={chartStyle.tick} axisLine={false} tickLine={false} width={48} />
                      <Tooltip contentStyle={chartStyle.tooltip} formatter={(v, name) => [format(Number(v)), String(name)]} />
                      <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 12 }} />
                      {group.series.map((p) => (
                        <Line key={p.key} dataKey={p.key} name={defOf(p.key).label} stroke={p.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: p.color }} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
                      <CartesianGrid vertical={false} {...chartStyle.grid} />
                      <XAxis dataKey="year" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={6} />
                      <YAxis tickFormatter={axisFormatter(group.unit)} tick={chartStyle.tick} axisLine={false} tickLine={false} width={48} />
                      <ReferenceLine y={0} stroke="var(--rule-strong)" />
                      <Tooltip cursor={chartStyle.cursor} contentStyle={chartStyle.tooltip} formatter={(v, name) => [format(Number(v)), String(name)]} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      {group.series.map((p) => (
                        <Bar key={p.key} dataKey={p.key} name={defOf(p.key).label} fill={p.color} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
