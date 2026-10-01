'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Coins, Lock, Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import type { Account, StockPosition, StockQuote, Transaction } from '@/lib/types';
import { formatAxisCurrency, formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import {
  buildDividendEvents,
  dividendSeries,
  dividendYears,
  filterDividendsByYear,
  summarizeDividendKpis,
  summarizeDividendsByPosition,
  type DividendYearFilter,
} from '@/lib/dividends';
import { useFxRates } from '@/lib/hooks';
import { useSubscription } from '@/lib/subscription-client';
import { ProBlur } from './ProBlur';

interface DividendsTableProps {
  transactions: Transaction[];
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
  accounts?: Account[];
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const cardClass = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

function Kpi({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-sm">
        <span className="text-[color:var(--ink-soft)]" aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 truncate text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-2xl">{value}</p>
      {detail && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</div>}
    </div>
  );
}

function ProValue({ locked, children }: { locked: boolean; children: ReactNode }) {
  return <span className={locked ? 'select-none blur-sm' : ''}>{children}</span>;
}

export function DividendsTable({ transactions, quotes, accounts = [] }: DividendsTableProps) {
  const [year, setYear] = useState<DividendYearFilter>('all');
  const { hasFeature } = useSubscription();
  const isPro = hasFeature('dividends_module');

  const dividendTransactions = useMemo(() => transactions.filter((tx) => tx.type === 'DIVIDEND'), [transactions]);
  const currencies = useMemo(
    () => Array.from(new Set(dividendTransactions.map((tx) => (tx.currency ?? 'EUR').toUpperCase()))),
    [dividendTransactions]
  );
  const firstDate = useMemo(
    () => dividendTransactions.reduce<string | null>((min, tx) => (min === null || tx.date < min ? tx.date : min), null),
    [dividendTransactions]
  );
  const fxRates = useFxRates(currencies, firstDate);
  const hasForeignCurrency = currencies.some((currency) => currency !== 'EUR');

  const events = useMemo(() => buildDividendEvents(transactions, fxRates), [transactions, fxRates]);
  const years = useMemo(() => dividendYears(events), [events]);
  const selectedYear: DividendYearFilter = year !== 'all' && !years.includes(year) ? 'all' : year;
  const today = todayIso();

  const kpis = useMemo(() => summarizeDividendKpis(events, selectedYear, today), [events, selectedYear, today]);
  const periodEvents = useMemo(() => filterDividendsByYear(events, selectedYear), [events, selectedYear]);
  const byPosition = useMemo(() => summarizeDividendsByPosition(periodEvents), [periodEvents]);
  const series = useMemo(() => dividendSeries(events, selectedYear), [events, selectedYear]);

  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name;
  const positionName = (symbol: string | null) => (symbol ? quotes[symbol]?.name || symbol : 'Non attribué');

  if (events.length === 0) {
    return (
      <div className={`${cardClass} px-6 py-12 text-center`}>
        <Coins className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-4 text-base font-medium text-zinc-900 dark:text-zinc-100">Aucun dividende enregistré</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ajoutez une transaction de type « Dividende » pour suivre vos revenus.
        </p>
      </div>
    );
  }

  const best = byPosition[0];
  const periodLabel = selectedYear === 'all' ? 'au total' : `en ${selectedYear}`;
  const ytdUp = (kpis.ytdChangePercent ?? 0) >= 0;
  const approx = hasForeignCurrency ? '≈ ' : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filtre d'année */}
      <div role="group" aria-label="Période" className="flex flex-wrap items-center gap-1.5">
        {(['all', ...years] as DividendYearFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setYear(option)}
            aria-pressed={selectedYear === option}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedYear === option
                ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            {option === 'all' ? 'Tout' : option}
          </button>
        ))}
        {hasForeignCurrency && (
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            Totaux convertis en EUR au taux du jour de chaque versement
          </span>
        )}
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          label={`Reçus ${periodLabel}`}
          icon={<Coins className="h-4 w-4" />}
          value={`${approx}${formatCurrency(kpis.periodTotalEur)}`}
          detail={`${kpis.periodCount} versement${kpis.periodCount > 1 ? 's' : ''} · ${kpis.payingPositions} ligne${kpis.payingPositions > 1 ? 's' : ''}`}
        />
        <Kpi
          label="12 derniers mois"
          icon={<CalendarDays className="h-4 w-4" />}
          value={`${approx}${formatCurrency(kpis.trailing12mEur)}`}
          detail={`soit ${formatCurrency(kpis.monthlyAverageEur)} par mois en moyenne`}
        />
        <Kpi
          label={`${kpis.currentYear} à date`}
          icon={ytdUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          value={`${approx}${formatCurrency(kpis.ytdEur)}`}
          detail={
            kpis.ytdChangePercent === null ? (
              `Rien sur la même période en ${kpis.currentYear - 1}`
            ) : (
              <>
                <span className={`font-medium ${ytdUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPercent(kpis.ytdChangePercent)}
                </span>{' '}
                vs même période {kpis.currentYear - 1}
              </>
            )
          }
        />
        <Kpi
          label={`Meilleure ligne ${periodLabel}`}
          icon={<Trophy className="h-4 w-4" />}
          value={best ? best.symbol ?? 'Non attribué' : '—'}
          detail={
            best
              ? `${formatCurrency(best.total, best.currency)} · ${formatNumber(best.sharePercent, 0)} % du total`
              : undefined
          }
        />
      </div>

      {/* Revenus dans le temps */}
      <ProBlur feature="dividends_module" label="Revenus de dividendes dans le temps — Pro">
        <section className={`${cardClass} p-4 sm:p-6`}>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base">
            {selectedYear === 'all' ? 'Revenus par année' : `Revenus par mois en ${selectedYear}`}
          </h3>
          <div className="mt-4 h-[220px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--rule)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
                  stroke="var(--rule)"
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tickFormatter={formatAxisCurrency}
                  tick={{ fontSize: 10, fill: 'var(--ink-soft)' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'var(--paper-2)' }}
                  formatter={(value) => [`${approx}${formatCurrency(Number(value) || 0)}`, 'Dividendes']}
                  contentStyle={{
                    backgroundColor: 'var(--paper-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                    color: 'var(--ink)',
                  }}
                />
                <Bar dataKey="amountEur" fill="var(--gain)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </ProBlur>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        {/* Par position */}
        <section className={`${cardClass} @container p-4 sm:p-6`}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base">Par position</h3>
            {!isPro && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Lock className="h-3 w-3" /> Moyennes par action : Pro
              </span>
            )}
          </div>

          <table className="mt-3 hidden w-full text-sm tabular-nums @2xl:table">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="py-2 pr-2 text-left font-medium">Position</th>
                <th className="px-2 py-2 text-right font-medium">Reçu</th>
                <th className="px-2 py-2 text-left font-medium">Part</th>
                <th className="px-2 py-2 text-right font-medium">Versements</th>
                <th className="px-2 py-2 text-right font-medium">Moy. / action</th>
                <th className="px-2 py-2 text-right font-medium">Rdt / coût</th>
                <th className="py-2 pl-2 text-right font-medium">Dernier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {byPosition.map((position) => (
                <tr key={position.key}>
                  <td className="max-w-[14rem] py-2.5 pr-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{position.symbol ?? 'Non attribué'}</p>
                    {positionName(position.symbol) !== position.symbol && (
                      <p className="truncate text-xs text-zinc-500">{positionName(position.symbol)}</p>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(position.total, position.currency)}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full rounded-full bg-[color:var(--gain)]" style={{ width: `${position.sharePercent}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500">{formatNumber(position.sharePercent, 0)} %</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right text-zinc-700 dark:text-zinc-300">{position.count}</td>
                  <td className="px-2 py-2.5 text-right text-zinc-700 dark:text-zinc-300">
                    {position.avgPerShare === null ? '—' : (
                      <ProValue locked={!isPro}>{formatCurrency(position.avgPerShare, position.currency)}</ProValue>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right text-zinc-700 dark:text-zinc-300">
                    {position.avgYieldOnCost === null ? '—' : (
                      <ProValue locked={!isPro}>{formatNumber(position.avgYieldOnCost, 2)} %</ProValue>
                    )}
                  </td>
                  <td className="py-2.5 pl-2 text-right text-xs text-zinc-500">{formatDate(position.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Carte étroite : une ligne compacte par position */}
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800 @2xl:hidden">
            {byPosition.map((position) => (
              <li key={position.key} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{position.symbol ?? 'Non attribué'}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {position.count} versement{position.count > 1 ? 's' : ''} · dernier le {formatDate(position.lastDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(position.total, position.currency)}
                    </p>
                    <p className="text-xs text-zinc-500">{formatNumber(position.sharePercent, 0)} % du total</p>
                  </div>
                </div>
                {(position.avgPerShare !== null || position.avgYieldOnCost !== null) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Moy. / action{' '}
                    <ProValue locked={!isPro}>
                      {position.avgPerShare === null ? '—' : formatCurrency(position.avgPerShare, position.currency)}
                    </ProValue>
                    {' · '}Rdt / coût{' '}
                    <ProValue locked={!isPro}>
                      {position.avgYieldOnCost === null ? '—' : `${formatNumber(position.avgYieldOnCost, 2)} %`}
                    </ProValue>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Versements de la période, toujours visibles */}
        <section className={`${cardClass} flex flex-col p-4 sm:p-6`}>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base">
            Versements <span className="font-normal text-zinc-500">({periodEvents.length})</span>
          </h3>
          <ul className="mt-3 max-h-[28rem] flex-1 divide-y divide-zinc-100 overflow-y-auto pr-1 dark:divide-zinc-800">
            {periodEvents.map((event) => {
              const account = accountName(event.accountId);
              return (
                <li key={event.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {event.symbol ?? 'Non attribué'}
                      {account && <span className="ml-1.5 text-xs font-normal text-zinc-500">· {account}</span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(event.date)}
                      {event.perShare !== null && (
                        <>
                          {' · '}
                          {formatNumber(event.quantity, event.quantity % 1 === 0 ? 0 : 4)} × {formatCurrency(event.perShare, event.currency)}
                        </>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(event.amount, event.currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
