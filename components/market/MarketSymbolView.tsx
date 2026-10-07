'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useAccounts, usePositionsWithCalculatedValues, useTransactions } from '@/lib/hooks';
import { PERFORMANCE_KEYS, rangePosition, type PerformanceKey } from '@/lib/market/analytics';
import type { MarketDividend, MarketPoint, MarketSplit } from '@/lib/market/chart-data';
import { CHART_PERIODS, DEFAULT_CHART_PERIOD, isChartPeriod, type ChartInterval, type ChartPeriod } from '@/lib/market/periods';
import { pushRecent } from '@/lib/market/recents';
import { PageHeader } from '../app-shell/PageLayout';
import { COMPARE_COLORS, MOVING_AVERAGES, MarketChart, type CompareSeries } from './MarketChart';
import { MarketSearch } from './MarketSearch';
import { changeClass, fmtCompact, fmtPct, fmtPrice, instrumentLabel } from './format';
import { MarketFundamentals } from './MarketFundamentals';
import { MarketNews } from './MarketNews';
import { useJson } from './useJson';

interface Overview {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  instrumentType: string;
  timezone: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  regularMarketStart: number | null;
  regularMarketEnd: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  averageVolume3M: number | null;
  performance: Record<PerformanceKey, number | null>;
  volatility1Y: number | null;
  maxDrawdown1Y: number | null;
  dividends: MarketDividend[];
  dividendsByYear: Array<{ year: number; total: number; count: number }>;
  trailingYield: number | null;
  splits: MarketSplit[];
}

interface ChartResponse {
  symbol: string;
  period: ChartPeriod;
  interval: ChartInterval;
  intraday: boolean;
  currency: string;
  timezone: string;
  displayFrom: number | null;
  points: MarketPoint[];
}

const QUICK_COMPARE = [
  { symbol: '^FCHI', label: 'CAC 40' },
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: 'URTH', label: 'MSCI World' },
];

function useCompareCharts(symbols: string[], period: ChartPeriod): Record<string, MarketPoint[]> {
  const key = `${symbols.join(',')}|${period}`;
  const [state, setState] = useState<{ key: string; data: Record<string, MarketPoint[]> }>({ key: '', data: {} });
  useEffect(() => {
    if (symbols.length === 0) return;
    const controller = new AbortController();
    Promise.all(
      symbols.map((symbol) =>
        fetch(`/api/market/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: ChartResponse | null) => [symbol, json?.points ?? []] as const)
          .catch(() => [symbol, [] as MarketPoint[]] as const)
      )
    ).then((entries) => {
      if (!controller.signal.aborted) setState({ key, data: Object.fromEntries(entries) });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` résume symbols + period
  }, [key]);
  return state.key === key ? state.data : {};
}

const PERF_LABELS: Record<PerformanceKey, string> = {
  '1S': '1 sem.', '1M': '1 mois', '3M': '3 mois', '6M': '6 mois', YTD: 'Depuis le 1er janv.', '1A': '1 an', '3A': '3 ans', '5A': '5 ans',
};

const segmentClass = (active: boolean) =>
  `px-2.5 py-1.5 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
    active ? 'btn-ink' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
  }`;

const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

export function MarketSymbolView({ symbol }: { symbol: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const periodParam = searchParams.get('p');
  const period: ChartPeriod = isChartPeriod(periodParam) ? periodParam : DEFAULT_CHART_PERIOD;

  const [mode, setMode] = useState<'line' | 'candles'>('line');
  const [movingAverages, setMovingAverages] = useState<number[]>([50, 200]);
  const [compare, setCompare] = useState<Array<{ symbol: string; label: string }>>([]);
  const [picking, setPicking] = useState(false);

  const overview = useJson<Overview>(`/api/market/overview?symbol=${encodeURIComponent(symbol)}`);
  const chart = useJson<ChartResponse>(`/api/market/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`);
  const compareSymbols = useMemo(() => compare.map((c) => c.symbol), [compare]);
  const comparePoints = useCompareCharts(chart.data?.intraday ? [] : compareSymbols, period);

  const { transactions } = useTransactions();
  const { accounts } = useAccounts();
  const positions = usePositionsWithCalculatedValues(transactions);
  const symbolUpper = symbol.toUpperCase();
  const holdings = useMemo(() => positions.filter((p) => p.symbol.toUpperCase() === symbolUpper), [positions, symbolUpper]);
  const symbolTransactions = useMemo(
    () => transactions.filter((t) => t.stock_symbol?.toUpperCase() === symbolUpper),
    [transactions, symbolUpper]
  );

  const data = overview.data;
  // Fiche ouverte : ajoutée aux recherches récentes.
  useEffect(() => {
    if (data?.symbol) pushRecent({ symbol: data.symbol, name: data.name });
  }, [data?.symbol, data?.name]);

  const setPeriod = (next: ChartPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_CHART_PERIOD) params.delete('p');
    else params.set('p', next);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  const toggleAverage = (days: number) =>
    setMovingAverages((prev) => (prev.includes(days) ? prev.filter((d) => d !== days) : [...prev, days].sort((a, b) => a - b)));

  const addCompare = (pick: { symbol: string; name: string }) => {
    setPicking(false);
    setCompare((prev) =>
      prev.length >= 3 || prev.some((c) => c.symbol === pick.symbol) || pick.symbol.toUpperCase() === symbolUpper
        ? prev
        : [...prev, { symbol: pick.symbol, label: pick.name }]
    );
  };

  if (overview.error === 'not_found') {
    return (
      <div className={`${card} mx-auto max-w-xl p-6 text-center sm:p-8`}>
        <h1 className="display text-3xl text-[color:var(--ink)]">Titre introuvable</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Aucune cotation pour « {symbol} ». Vérifiez le symbole ou cherchez par nom.
        </p>
        <div className="mt-5 text-left"><MarketSearch autoFocus /></div>
      </div>
    );
  }

  const currency = data?.currency ?? chart.data?.currency ?? '';
  const isCrypto = data?.instrumentType === 'CRYPTOCURRENCY';
  const marketOpen = isCrypto || (data?.regularMarketStart && data.regularMarketEnd
    ? overview.fetchedAt / 1000 >= data.regularMarketStart && overview.fetchedAt / 1000 < data.regularMarketEnd
    : false);
  const comparing = compare.length > 0 && !chart.data?.intraday;
  const compareSeries: CompareSeries[] = compare.map((c) => ({ ...c, points: comparePoints[c.symbol] ?? [] }));
  const position52 = data ? rangePosition(data.price, data.fiftyTwoWeekLow, data.fiftyTwoWeekHigh) : null;

  return (
    <>
      <PageHeader
        title={data?.name ?? symbolUpper}
        description={
          data ? [data.symbol, data.exchange, data.currency, instrumentLabel(data.instrumentType)].filter(Boolean).join(' · ') : 'Chargement…'
        }
        actions={<div className="w-full sm:w-72"><MarketSearch size="sm" placeholder="Autre titre…" /></div>}
      />

      {overview.error && overview.error !== 'not_found' && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {overview.error}</span>
          <button type="button" onClick={() => { overview.reload(); chart.reload(); }} className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        {/* Cours et séance */}
        <section className={`${card} p-4 sm:p-5`} aria-label="Cours">
          {data ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-4xl">{fmtPrice(data.price, currency)}</p>
                <p className={`mt-1 text-sm tabular-nums ${changeClass(data.change)}`}>
                  {data.change !== null ? `${data.change > 0 ? '+' : ''}${fmtPrice(data.change, currency)} (${fmtPct((data.changePercent ?? 0) / 100)})` : '—'}
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                    {isCrypto ? 'Marché ouvert 24 h/24' : marketOpen ? 'Séance en cours' : 'Fermé · dernière séance'}
                  </span>
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Plus haut du jour</dt>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Plus bas du jour</dt>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Volume</dt>
                <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{fmtPrice(data.dayHigh, currency)}</dd>
                <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{fmtPrice(data.dayLow, currency)}</dd>
                <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{fmtCompact(data.volume)}</dd>
              </dl>
            </div>
          ) : (
            <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          )}
        </section>

        {/* Dans votre patrimoine */}
        {data && holdings.length > 0 && (
          <section className={`${card} p-4 sm:p-5`} aria-labelledby="holding-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="holding-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Dans votre patrimoine</h2>
              <Link href="/dashboard?tab=positions" className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Voir dans Positions
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {holdings.map((p) => {
                const sameCurrency = (p.currency || '').toUpperCase() === currency.toUpperCase();
                const value = sameCurrency ? p.quantity * data.price : null;
                const gain = value !== null ? value - p.quantity * p.average_price : null;
                const accountName = accounts.find((a) => a.id === p.account_id)?.name ?? 'Compte';
                return (
                  <li key={p.id} className="grid grid-cols-2 gap-2 py-2 text-sm sm:grid-cols-4">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{accountName}</span>
                    <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                      {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 }).format(p.quantity)} × PRU {fmtPrice(p.average_price, p.currency)}
                    </span>
                    <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{value !== null ? fmtPrice(value, currency) : '—'}</span>
                    <span className={`tabular-nums ${changeClass(gain)}`}>
                      {gain !== null ? `${gain > 0 ? '+' : ''}${fmtPrice(gain, currency)} (${fmtPct(data.price / p.average_price - 1)})` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Graphique */}
        <section className={`${card} p-3 sm:p-5`} aria-label="Graphique du cours">
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="-mx-1 flex max-w-full overflow-x-auto px-1" role="group" aria-label="Période">
              {CHART_PERIODS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPeriod(p.id)} aria-current={p.id === period ? 'true' : undefined} className={segmentClass(p.id === period)}>
                  {p.label}
                </button>
              ))}
            </div>
            {!comparing && (
              <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700" role="group" aria-label="Affichage">
                <button type="button" aria-pressed={mode === 'line'} onClick={() => setMode('line')} className={segmentClass(mode === 'line')}>Ligne</button>
                <button type="button" aria-pressed={mode === 'candles'} onClick={() => setMode('candles')} className={segmentClass(mode === 'candles')}>Chandeliers</button>
              </div>
            )}
            {!comparing && !chart.data?.intraday && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Moyennes mobiles">
                {MOVING_AVERAGES.map((m) => {
                  const on = movingAverages.includes(m.days);
                  return (
                    <button
                      key={m.days}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAverage(m.days)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${on ? 'border-zinc-400 text-zinc-900 dark:border-zinc-500 dark:text-zinc-100' : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'}`}
                    >
                      <span style={{ color: m.color }}>━</span> MM {m.days}
                    </button>
                  );
                })}
              </div>
            )}
            {chart.loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Chargement" />}
          </div>

          {/* Comparaison */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            {compare.map((c, n) => (
              <span key={c.symbol} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-2.5 pr-1 dark:border-zinc-700">
                <span style={{ color: COMPARE_COLORS[n] }}>━</span>
                <span className="text-zinc-700 dark:text-zinc-300">{c.label}</span>
                <button type="button" onClick={() => setCompare((prev) => prev.filter((x) => x.symbol !== c.symbol))} aria-label={`Retirer ${c.label} de la comparaison`} className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {chart.data?.intraday ? (
              compare.length > 0 && <span className="text-zinc-500 dark:text-zinc-400">Comparaison disponible à partir de 1M.</span>
            ) : compare.length < 3 && (
              picking ? (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  {QUICK_COMPARE.filter((q) => !compareSymbols.includes(q.symbol) && q.symbol !== symbolUpper).map((q) => (
                    <button key={q.symbol} type="button" onClick={() => addCompare({ symbol: q.symbol, name: q.label })} className="rounded-full border border-zinc-200 px-2.5 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      {q.label}
                    </button>
                  ))}
                  <div className="w-full sm:w-56"><MarketSearch size="sm" autoFocus onSelect={addCompare} placeholder="Autre titre ou indice…" /></div>
                  <button type="button" onClick={() => setPicking(false)} className="text-zinc-500 underline underline-offset-4">Annuler</button>
                </div>
              ) : (
                <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                  <Plus className="h-3.5 w-3.5" /> Comparer
                </button>
              )
            )}
          </div>

          {chart.error ? (
            <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              {chart.error === 'not_found' ? 'Aucune cotation sur cette période.' : chart.error}
              <button type="button" onClick={chart.reload} className="inline-flex items-center gap-1.5 underline underline-offset-4"><RefreshCw className="h-4 w-4" /> Réessayer</button>
            </div>
          ) : chart.data ? (
            <div className={chart.loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
              <MarketChart
                points={chart.data.points}
                displayFrom={chart.data.displayFrom}
                period={chart.data.period}
                interval={chart.data.interval}
                intraday={chart.data.intraday}
                timezone={chart.data.timezone || 'UTC'}
                currency={currency}
                mode={mode}
                movingAverages={movingAverages}
                compare={comparing ? compareSeries : []}
                transactions={symbolTransactions}
                previousClose={data?.previousClose ?? null}
                symbolLabel={data?.name ?? symbolUpper}
              />
            </div>
          ) : (
            <div className="h-[320px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800 sm:h-[400px]" />
          )}
        </section>

        {data && (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* Statistiques */}
            <section className={`${card} p-4 sm:p-5`} aria-labelledby="stats-title">
              <h2 id="stats-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Statistiques</h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Performance du cours, hors dividendes.</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PERFORMANCE_KEYS.map((key) => (
                  <div key={key} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">{PERF_LABELS[key]}</dt>
                    <dd className={`text-sm font-medium tabular-nums ${changeClass(data.performance[key])}`}>{fmtPct(data.performance[key])}</dd>
                  </div>
                ))}
              </dl>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Volatilité sur 1 an : <span className="tabular-nums">{fmtPct(data.volatility1Y, 1).replace('+', '')}</span></dt>
                  <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Amplitude habituelle des variations, ramenée à une année. Plus elle est élevée, plus le cours bouge.</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Pire baisse sur 1 an : <span className="tabular-nums">{fmtPct(data.maxDrawdown1Y, 1)}</span></dt>
                  <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Plus forte chute depuis un plus haut au cours de l’année écoulée.</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Fourchette sur 52 semaines</dt>
                  <dd className="mt-2">
                    <div className="relative h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      {position52 !== null && (
                        <span className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--ink)]" style={{ left: `${position52 * 100}%` }} />
                      )}
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      <span>{fmtPrice(data.fiftyTwoWeekLow, currency)}</span>
                      <span>
                        {data.fiftyTwoWeekHigh ? `${fmtPct(data.price / data.fiftyTwoWeekHigh - 1, 1)} du plus haut` : ''}
                      </span>
                      <span>{fmtPrice(data.fiftyTwoWeekHigh, currency)}</span>
                    </div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Volume moyen sur 3 mois : <span className="tabular-nums">{fmtCompact(data.averageVolume3M)}</span></dt>
                  <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Titres échangés par séance, en moyenne.</dd>
                </div>
              </dl>
            </section>

            {/* Dividendes */}
            <section className={`${card} p-4 sm:p-5`} aria-labelledby="div-title">
              <h2 id="div-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Dividendes</h2>
              {data.dividends.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Aucun dividende versé ces cinq dernières années.</p>
              ) : (
                <>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Rendement sur 12 mois : <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{fmtPct(data.trailingYield).replace('+', '')}</span> (dividendes des 12 derniers mois / cours actuel)
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {(() => {
                      const max = Math.max(...data.dividendsByYear.map((y) => y.total), 0);
                      return data.dividendsByYear.map((y) => (
                        <li key={y.year} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                          <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{y.year}</span>
                          <span className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <span className="block h-2 rounded-full bg-[color:var(--chart-3)]" style={{ width: max > 0 ? `${(y.total / max) * 100}%` : 0 }} />
                          </span>
                          <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{y.total > 0 ? fmtPrice(y.total, currency) : '—'}</span>
                        </li>
                      ));
                    })()}
                  </ul>
                  <h3 className="mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">Derniers versements (par titre)</h3>
                  <ul className="mt-1 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                    {data.dividends.slice(0, 5).map((d) => (
                      <li key={d.date} className="flex justify-between py-1.5 tabular-nums">
                        <span className="text-zinc-600 dark:text-zinc-300">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</span>
                        <span className="text-zinc-900 dark:text-zinc-100">{fmtPrice(d.amount, currency)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.splits.length > 0 && (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Divisions d’action : {data.splits.map((s) => `${s.ratio} le ${new Date(`${s.date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`).join(' · ')}
                </p>
              )}
            </section>
          </div>
        )}

        {/* Fondamentaux (actions seulement) puis actualités */}
        {data?.instrumentType === 'EQUITY' && (
          <MarketFundamentals symbol={data.symbol} price={data.price} priceCurrency={currency} />
        )}
        {data && <MarketNews symbol={data.symbol} name={data.name} />}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Données de marché fournies à titre informatif, parfois différées selon la place de cotation. Fi-Hub ne donne pas de conseil en investissement.
        </p>
      </div>
    </>
  );
}
