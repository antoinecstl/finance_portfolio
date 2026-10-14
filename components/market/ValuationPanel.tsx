'use client';

// Onglet Valorisation d'une action (docs/specs/explorateur-marches-v2.md §4.3).

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MultipleKey, MultipleSeries, ValuationReference } from '@/lib/market/valuation';
import { Consensus, DcfSimulator, RatioGroups, RatiosGuide, useFundamentals } from './MarketFundamentals';
import { changeClass, fmtMultiple, fmtPct, fmtPrice, fmtShare } from './format';
import { chartStyle, Panel, PanelError, PanelSkeleton, StaleNotice, yearTicks } from './ui';
import { useJson } from './useJson';

type ValuationResponse =
  | { available: false; asOf: string; stale: boolean }
  | {
    available: true;
    currency: string;
    priceCurrency: string;
    price: number | null;
    multiples: Partial<Record<MultipleKey, MultipleSeries>>;
    references: ValuationReference[];
    asOf: string;
    stale: boolean;
  };

/** Arrondi supérieur « rond » (1, 2, 2,5, 5 × 10ⁿ) pour un axe lisible. */
function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 4, 5, 8, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

const ORDER: MultipleKey[] = ['per', 'priceToFcf', 'evToEbitda', 'priceToSales', 'priceToBook', 'dividendYield'];
const fmtMonth = (t: number) => new Date(t * 1000).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function ValuationPanel({ symbol, price, priceCurrency }: { symbol: string; price: number; priceCurrency: string }) {
  const fundamentals = useFundamentals(symbol);
  const valuation = useJson<ValuationResponse>(`/api/market/valuation?symbol=${encodeURIComponent(symbol)}`);
  const f = fundamentals.data;

  return (
    <div className="space-y-4 sm:space-y-6">
      {valuation.data && <StaleNotice asOf={valuation.data.asOf} stale={valuation.data.stale} />}
      {valuation.error ? (
        <PanelError title="Multiples dans le temps" message="Historique de valorisation momentanément indisponible." onRetry={valuation.reload} />
      ) : !valuation.data ? (
        <PanelSkeleton title="Multiples dans le temps" height={260} />
      ) : valuation.data.available && Object.keys(valuation.data.multiples).length > 0 ? (
        <>
          <MultiplesHistory data={valuation.data} />
          {valuation.data.references.length > 0 && (
            <References references={valuation.data.references} price={valuation.data.price ?? price} currency={priceCurrency} />
          )}
        </>
      ) : null}

      {fundamentals.error ? (
        <PanelError title="Ratios du jour" message="Données financières momentanément indisponibles." onRetry={fundamentals.reload} />
      ) : !f ? (
        <PanelSkeleton title="Ratios du jour" height={200} />
      ) : f.available ? (
        <>
          <Panel
            id="ratios"
            title="Ratios du jour"
            description={`Calculés par Fi-Hub au cours actuel${f.fxRate ? ` converti en ${f.currency}` : ''}, sur les comptes des 12 derniers mois. Survolez un ratio pour sa définition.`}
          >
            <RatioGroups ratios={f.ratios} currency={f.currency} />
          </Panel>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <DcfSimulator
              key={symbol}
              defaults={f.dcfDefaults}
              fcfPerShare={f.ratios.fcfPerShare}
              grahamNumber={f.ratios.grahamNumber}
              price={f.priceInStatementCurrency}
              currency={f.currency}
            />
            {f.summary && (
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:p-4">
                <Consensus summary={f.summary} price={price} priceCurrency={priceCurrency} />
              </div>
            )}
          </div>
          <RatiosGuide />
        </>
      ) : (
        <PanelError title="Ratios du jour" message="Pas de comptes publiés disponibles pour ce titre." />
      )}
    </div>
  );
}

function formatMultipleValue(key: MultipleKey, v: number | null | undefined) {
  return key === 'dividendYield' ? fmtShare(v, 2) : fmtMultiple(v);
}

function MultiplesHistory({ data }: { data: Extract<ValuationResponse, { available: true }> }) {
  const keys = ORDER.filter((k) => data.multiples[k]);
  const [selected, setSelected] = useState<MultipleKey>(keys[0]);
  const series = data.multiples[selected] ?? data.multiples[keys[0]];
  const rows = useMemo(() => series?.points.map((p) => ({ t: p.t * 1000, v: p.v })) ?? [], [series]);
  if (!series) return null;
  const key = series.key;
  const f = (v: number) => formatMultipleValue(key, v);
  // Les pics (bénéfice effondré) écrasent l'échelle : on plafonne l'axe, la valeur reste dans l'info-bulle.
  const top = Math.max(series.median * 2.5, series.current * 1.3);
  const domainTop = niceCeil(Math.min(series.high.v, top) * 1.05);
  const since = new Date(series.since * 1000).getUTCFullYear();
  const higher = Math.round(series.higherShare * 100);
  const yieldLike = key === 'dividendYield';

  return (
    <Panel
      id="multiples"
      title="Multiples dans le temps"
      description={`Chaque semaine depuis ${since}, sur les comptes publiés à cette date (cours converti en ${data.currency}).`}
    >
      <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1" role="group" aria-label="Multiple affiché">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === key}
            onClick={() => setSelected(k)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition-colors sm:text-sm ${k === key ? 'btn-ink' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
          >
            {data.multiples[k]?.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-zinc-900 dark:text-zinc-100">
        {series.label} actuel <span className="font-semibold">{f(series.current)}</span>
        <span className="text-zinc-600 dark:text-zinc-300">
          {' '}: {yieldLike ? `plus élevé que ${100 - higher} %` : `plus bas que ${higher} %`} des semaines depuis {since}.
        </span>
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-zinc-500 dark:text-zinc-400">Médiane</dt><dd className="font-medium text-zinc-900 dark:text-zinc-100">{f(series.median)}</dd></div>
        <div><dt className="text-zinc-500 dark:text-zinc-400">Plus haut</dt><dd className="font-medium text-zinc-900 dark:text-zinc-100">{f(series.high.v)} <span className="font-normal text-zinc-500">({fmtMonth(series.high.t)})</span></dd></div>
        <div><dt className="text-zinc-500 dark:text-zinc-400">Plus bas</dt><dd className="font-medium text-zinc-900 dark:text-zinc-100">{f(series.low.v)} <span className="font-normal text-zinc-500">({fmtMonth(series.low.t)})</span></dd></div>
      </dl>

      <div className="mt-3 h-[240px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={rows.length > 1 ? yearTicks(rows[0].t, rows[rows.length - 1].t) : undefined}
              tickFormatter={(t: number) => String(new Date(t).getUTCFullYear())}
              tick={chartStyle.tick}
              stroke="var(--rule)"
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              domain={[0, domainTop]}
              ticks={[0, domainTop / 4, domainTop / 2, (domainTop * 3) / 4, domainTop]}
              allowDataOverflow
              tickFormatter={(v: number) => (yieldLike ? `${(v * 100).toFixed(1).replace('.', ',')}\u202f%` : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v))}
              tick={chartStyle.tick}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine y={series.median} stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="6 4" />
            {series.high.v <= domainTop && <ReferenceLine y={series.high.v} stroke="var(--ink-soft)" strokeDasharray="2 4" />}
            <ReferenceLine y={series.low.v} stroke="var(--ink-soft)" strokeDasharray="2 4" />
            <Tooltip
              contentStyle={chartStyle.tooltip}
              labelFormatter={(t) => new Date(Number(t)).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}
              formatter={(v) => [f(Number(v)), series.label]}
            />
            <Line type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-[color:var(--chart-1)]" /> {series.label}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-[color:var(--chart-3)]" /> Médiane</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dotted border-[color:var(--ink-soft)]" /> Plus haut et plus bas</span>
      </p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {yieldLike
          ? 'Dividendes des 12 derniers mois / cours. Un rendement haut par rapport à l’historique accompagne souvent un cours bas, ou un dividende en hausse.'
          : 'Un multiple bas par rapport à son historique peut signaler un titre délaissé… ou des perspectives dégradées. À lire avec les comptes.'}
      </p>
    </Panel>
  );
}

function References({ references, price, currency }: { references: ValuationReference[]; price: number; currency: string }) {
  const values = [...references.map((r) => r.value), price].filter((v) => Number.isFinite(v) && v > 0);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.05;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <Panel
      id="references"
      title="Repères de valorisation"
      description="Ce que vaudrait l’action selon plusieurs méthodes simples. Des repères pour réfléchir, pas des objectifs ni un conseil."
    >
      <ul className="space-y-3">
        {references.map((r) => {
          const gap = r.value / price - 1;
          return (
            <li key={r.method}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="text-zinc-900 dark:text-zinc-100">{r.label}</span>
                <span className="tabular-nums">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{fmtPrice(r.value, currency)}</span>
                  <span className={`ml-1.5 text-xs ${changeClass(gap)}`}>{fmtPct(gap, 0)} vs cours</span>
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
                <span className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[color:var(--ink)]" style={{ left: `${pos(price)}%` }} />
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[color:var(--chart-3)] dark:border-zinc-900" style={{ left: `${pos(r.value)}%` }} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{r.detail}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Trait noir : cours actuel ({fmtPrice(price, currency)}) ; rond : repère.
      </p>
    </Panel>
  );
}
