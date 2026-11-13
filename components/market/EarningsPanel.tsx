'use client';

// Résultats trimestriels (onglet Finances) : BPA publié face au consensus,
// chiffre d'affaires et résultat net par trimestre, prévisions des analystes.
// Chaque bloc n'apparaît que si ses données existent.

import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  beatCount,
  netMargin,
  quarterOfPeriod,
  type EarningsSummary,
  type ForwardPeriod,
  type QuarterlyFinancial,
} from '@/lib/market/earnings';
import { changeClass, fmtMoneyCompact, fmtPct, fmtPrice, fmtShare } from './format';
import { chartStyle, fmtDate, Panel } from './ui';

const REVENUE_COLOR = 'var(--series-2)';
const NET_COLOR = 'var(--series-1)';
const ESTIMATE_COLOR = 'var(--ink-soft)';
const compactAxis = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const epsAxis = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

interface EpsRow {
  label: string;
  actual: number | null;
  estimate: number | null;
  surprise: number | null;
  upcoming: boolean;
}

/** Trimestres publiés + trimestre en cours (consensus seul) s'il n'est pas encore publié. */
function epsRows(earnings: EarningsSummary): EpsRow[] {
  const rows: EpsRow[] = earnings.history.map((h) => ({ label: h.label, actual: h.actual, estimate: h.estimate, surprise: h.surprise, upcoming: false }));
  const current = earnings.forward.find((f) => f.key === '0q');
  const lastDate = earnings.history.at(-1)?.date ?? '';
  if (current?.endDate && current.endDate > lastDate && current.eps.avg !== null) {
    rows.push({ label: quarterOfPeriod(current.endDate).label, actual: null, estimate: current.eps.avg, surprise: null, upcoming: true });
  }
  return rows;
}

// Points du graphique : rond creux = attendu, rond plein = publié (vert au-dessus du consensus, rouge en dessous).
type DotProps = { cx?: number; cy?: number; index?: number; payload?: EpsRow; value?: number | null };
const hidden = (key: string) => <g key={key} />;
function EstimateDot({ cx, cy, index, payload, value }: DotProps) {
  if (cx === undefined || cy === undefined || value === null || value === undefined) return hidden(`e${index}`);
  return <circle key={`e${index}`} cx={cx} cy={cy} r={7} fill="var(--paper)" stroke={ESTIMATE_COLOR} strokeWidth={2} strokeDasharray={payload?.upcoming ? '3 2' : undefined} />;
}
function ActualDot({ cx, cy, index, payload, value }: DotProps) {
  if (cx === undefined || cy === undefined || value === null || value === undefined) return hidden(`a${index}`);
  const beat = (payload?.surprise ?? 0) >= 0;
  return <circle key={`a${index}`} cx={cx} cy={cy} r={7} fill={beat ? 'var(--gain)' : 'var(--loss)'} stroke="var(--paper)" strokeWidth={1.5} />;
}

function EpsTick({ x, y, payload, rows }: { x?: number; y?: number; payload?: { value: string }; rows: EpsRow[] }) {
  const row = rows.find((r) => r.label === payload?.value);
  if (x === undefined || y === undefined || !row) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">{row.label}</text>
      <text dy={26} textAnchor="middle" fontSize={11} fontWeight={600} fill={row.upcoming ? 'var(--ink-soft)' : row.surprise === null ? 'var(--ink-soft)' : row.surprise >= 0 ? 'var(--gain)' : 'var(--loss)'}>
        {row.upcoming ? 'à venir' : row.surprise === null ? '—' : fmtPct(row.surprise, 1)}
      </text>
    </g>
  );
}

function EpsVsConsensus({ earnings, currency }: { earnings: EarningsSummary; currency: string }) {
  const rows = epsRows(earnings);
  if (rows.filter((r) => r.actual !== null).length < 2) return null;
  const { beats, total } = beatCount(earnings.history);
  const latest = earnings.history.at(-1);
  const legend = (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-[color:var(--ink-soft)]" aria-hidden="true" />Attendu (consensus)</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[color:var(--gain)]" aria-hidden="true" />Publié, au-dessus</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[color:var(--loss)]" aria-hidden="true" />Publié, en dessous</span>
    </div>
  );
  return (
    <Panel
      id="eps-surprise"
      title="Bénéfice par action : publié face au consensus"
      description={
        <>
          {latest && latest.actual !== null && (
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {latest.label} : {fmtPrice(latest.actual, currency)}
              {latest.estimate !== null && <> pour {fmtPrice(latest.estimate, currency)} attendus</>}
            </span>
          )}
          {latest?.surprise !== null && latest?.surprise !== undefined && (
            <span className={`ml-1 ${changeClass(latest.surprise)}`}>({fmtPct(latest.surprise, 1)})</span>
          )}
          {total > 1 && <span className="block">Au-dessus du consensus {beats} fois sur les {total} derniers trimestres.</span>}
        </>
      }
    >
      <div className="h-[230px] sm:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis dataKey="label" tick={(props) => <EpsTick {...props} rows={rows} />} height={36} stroke="var(--rule)" tickLine={false} interval={0} padding={{ left: 24, right: 24 }} />
            <YAxis tickFormatter={(v: number) => epsAxis.format(v)} tick={chartStyle.tick} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: 'var(--rule)' }}
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as EpsRow) : null;
                if (!row) return null;
                return (
                  <div style={chartStyle.tooltip} className="px-3 py-2">
                    <p className="font-medium">{row.label}{row.upcoming ? ' (à venir)' : ''}</p>
                    <p>Attendu : {fmtPrice(row.estimate, currency)}</p>
                    {!row.upcoming && <p>Publié : <strong>{fmtPrice(row.actual, currency)}</strong></p>}
                    {row.surprise !== null && <p className={changeClass(row.surprise)}>Écart : {fmtPct(row.surprise, 1)}</p>}
                  </div>
                );
              }}
            />
            <Line dataKey="estimate" name="Attendu" stroke="none" isAnimationActive={false} dot={EstimateDot} activeDot={false} />
            <Line dataKey="actual" name="Publié" stroke="none" isAnimationActive={false} dot={ActualDot} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {legend}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">Voir le tableau</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-right tabular-nums">
            <thead>
              <tr className="text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-1.5 pr-3 text-left font-medium">Trimestre</th>
                <th className="py-1.5 px-2 font-medium">Attendu</th>
                <th className="py-1.5 px-2 font-medium">Publié</th>
                <th className="py-1.5 pl-2 font-medium">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-1.5 pr-3 text-left text-zinc-700 dark:text-zinc-300">{r.label}{r.upcoming ? ' (à venir)' : ''}</td>
                  <td className="py-1.5 px-2 text-zinc-700 dark:text-zinc-300">{fmtPrice(r.estimate, currency)}</td>
                  <td className="py-1.5 px-2 text-zinc-900 dark:text-zinc-100">{r.upcoming ? '—' : fmtPrice(r.actual, currency)}</td>
                  <td className={`py-1.5 pl-2 ${changeClass(r.surprise)}`}>{fmtPct(r.surprise, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}

function RevenueVsEarnings({ quarters, currency }: { quarters: QuarterlyFinancial[]; currency: string }) {
  if (quarters.length < 2) return null;
  const rows = quarters.map((q) => ({ ...q, margin: netMargin(q) }));
  const latest = rows.at(-1)!;
  // Variation sur un an : même trimestre l'année précédente, s'il est présent.
  const [quarterTag, year] = latest.label.split(' ');
  const yearAgo = rows.find((r) => r.label === `${quarterTag} ${Number(year) - 1}`);
  const revenueYoy = yearAgo?.revenue && yearAgo.revenue > 0 && latest.revenue !== null ? latest.revenue / yearAgo.revenue - 1 : null;
  const hasNet = rows.some((r) => r.netIncome !== null);
  return (
    <Panel
      id="quarterly-financials"
      title={hasNet ? 'Chiffre d’affaires et résultat net par trimestre' : 'Chiffre d’affaires par trimestre'}
      description={
        <>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {latest.label} : CA {fmtMoneyCompact(latest.revenue, currency)}
          </span>
          {revenueYoy !== null && <span className={`ml-1 ${changeClass(revenueYoy)}`}>{fmtPct(revenueYoy, 1)} sur un an</span>}
          {latest.netIncome !== null && (
            <span className="block">
              Résultat net {fmtMoneyCompact(latest.netIncome, currency)}
              {latest.margin !== null && <> · marge nette {fmtShare(latest.margin)}</>}
            </span>
          )}
        </>
      }
    >
      <div className="h-[230px] sm:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
            <CartesianGrid vertical={false} {...chartStyle.grid} />
            <XAxis dataKey="label" tick={chartStyle.tick} stroke="var(--rule)" tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickFormatter={(v: number) => compactAxis.format(v)} tick={chartStyle.tick} axisLine={false} tickLine={false} width={48} />
            <ReferenceLine y={0} stroke="var(--rule-strong)" />
            <Tooltip
              cursor={chartStyle.cursor}
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as (typeof rows)[number]) : null;
                if (!row) return null;
                return (
                  <div style={chartStyle.tooltip} className="px-3 py-2">
                    <p className="font-medium">{row.label}</p>
                    <p>Chiffre d’affaires : <strong>{fmtMoneyCompact(row.revenue, currency)}</strong></p>
                    {row.netIncome !== null && <p>Résultat net : <strong>{fmtMoneyCompact(row.netIncome, currency)}</strong></p>}
                    {row.margin !== null && <p>Marge nette : {fmtShare(row.margin)}</p>}
                  </div>
                );
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Chiffre d’affaires" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            {hasNet && <Bar dataKey="netIncome" name="Résultat net" fill={NET_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Trimestres civils (T1 = janvier-mars).
        {hasNet
          ? ' L’écart entre les deux barres, c’est ce que coûtent l’activité, les intérêts et les impôts.'
          : ' Le résultat net n’est publié que par semestre : il figure dans les comptes annuels plus bas.'}
      </p>
    </Panel>
  );
}

const FORWARD_TITLES: Record<ForwardPeriod['key'], string> = {
  '0q': 'Trimestre en cours',
  '+1q': 'Trimestre suivant',
  '0y': 'Exercice en cours',
  '+1y': 'Exercice suivant',
};

function periodSubtitle(f: ForwardPeriod): string | null {
  if (!f.endDate) return null;
  if (f.key === '0q' || f.key === '+1q') return quarterOfPeriod(f.endDate).label;
  return `clos fin ${fmtDate(f.endDate, { month: 'long', year: 'numeric' })}`;
}

function ForwardCard({ f, currency }: { f: ForwardPeriod; currency: string }) {
  const epsGrowth = f.eps.growth ?? (f.eps.avg !== null && f.eps.yearAgo ? f.eps.avg / f.eps.yearAgo - 1 : null);
  const revenueGrowth = f.revenue.growth ?? (f.revenue.avg !== null && f.revenue.yearAgo ? f.revenue.avg / f.revenue.yearAgo - 1 : null);
  const trend = f.epsTrend.days90 !== null && f.epsTrend.current !== null && f.epsTrend.days90 !== 0 ? f.epsTrend.current / f.epsTrend.days90 - 1 : null;
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{FORWARD_TITLES[f.key]}</p>
      {periodSubtitle(f) && <p className="text-xs text-zinc-500 dark:text-zinc-400">{periodSubtitle(f)}</p>}
      <dl className="mt-2 space-y-2 text-sm">
        {f.eps.avg !== null && (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">BPA attendu</dt>
            <dd className="tabular-nums">
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{fmtPrice(f.eps.avg, currency)}</span>
              {epsGrowth !== null && <span className={`ml-1.5 inline-block whitespace-nowrap text-xs ${changeClass(epsGrowth)}`}>{fmtPct(epsGrowth, 1)} sur un an</span>}
              {f.eps.low !== null && f.eps.high !== null && (
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">de {fmtPrice(f.eps.low, currency)} à {fmtPrice(f.eps.high, currency)}</span>
              )}
            </dd>
          </div>
        )}
        {f.revenue.avg !== null && (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Chiffre d’affaires attendu</dt>
            <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {fmtMoneyCompact(f.revenue.avg, currency)}
              {revenueGrowth !== null && <span className={`ml-1.5 text-xs ${changeClass(revenueGrowth)}`}>{fmtPct(revenueGrowth, 1)}</span>}
            </dd>
          </div>
        )}
        {(trend !== null || f.revisions.up30 !== null) && (
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Révisions</dt>
            <dd className="text-xs text-zinc-700 dark:text-zinc-300">
              {trend !== null && <span className="block">BPA attendu <span className={changeClass(trend)}>{fmtPct(trend, 1)}</span> en 90 jours</span>}
              {f.revisions.up30 !== null && f.revisions.down30 !== null && (
                <span className="block">{f.revisions.up30} en hausse, {f.revisions.down30} en baisse sur 30 jours</span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {f.eps.analysts !== null && (
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{f.eps.analysts} analyste{f.eps.analysts > 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

function Estimates({ earnings, currency }: { earnings: EarningsSummary; currency: string }) {
  if (earnings.forward.length === 0) return null;
  return (
    <Panel
      id="estimates"
      title="Prévisions des analystes"
      description="Moyenne des prévisions publiées (consensus), comparée à la même période un an plus tôt. Ce sont des estimations, pas des résultats."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {earnings.forward.map((f) => <ForwardCard key={f.key} f={f} currency={currency} />)}
      </div>
    </Panel>
  );
}

/** Bandeau « Prochains résultats » : date annoncée (ou estimée) et BPA attendu. */
function NextEarnings({ earnings, currency, asOf }: { earnings: EarningsSummary; currency: string; asOf: string }) {
  if (!earnings.nextDate || earnings.nextDate < asOf.slice(0, 10)) return null;
  const current = earnings.forward.find((f) => f.key === '0q');
  return (
    <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
      Prochains résultats le <span className="font-medium text-zinc-900 dark:text-zinc-100">{fmtDate(earnings.nextDate, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      {earnings.nextDateEstimated ? ' (date estimée)' : ''}
      {current?.eps.avg !== null && current?.eps.avg !== undefined && <> · BPA attendu {fmtPrice(current.eps.avg, currency)}</>}
    </p>
  );
}

export function EarningsSection({
  earnings,
  quarterly,
  statementCurrency,
  asOf,
}: {
  earnings: EarningsSummary | null | undefined;
  quarterly: QuarterlyFinancial[] | undefined;
  statementCurrency: string;
  asOf: string;
}) {
  const epsCurrency = earnings?.currency ?? statementCurrency;
  const quarters = quarterly && quarterly.length >= 2 ? quarterly : null;
  const hasEps = Boolean(earnings && earnings.history.filter((h) => h.actual !== null).length >= 2);
  if (!earnings && !quarters) return null;
  // Un seul des deux graphiques : il prend toute la largeur.
  const both = hasEps && quarters !== null;
  return (
    <>
      {earnings && <NextEarnings earnings={earnings} currency={epsCurrency} asOf={asOf} />}
      {(hasEps || quarters) && (
        <div className={`grid gap-4 sm:gap-6 ${both ? 'lg:grid-cols-2' : ''}`}>
          {earnings && hasEps && <EpsVsConsensus earnings={earnings} currency={epsCurrency} />}
          {quarters && <RevenueVsEarnings quarters={quarters} currency={statementCurrency} />}
        </div>
      )}
      {earnings && <Estimates earnings={earnings} currency={epsCurrency} />}
    </>
  );
}
