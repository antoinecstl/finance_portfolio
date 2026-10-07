'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import {
  RECOMMENDATION_LABELS,
  dcfValuePerShare,
  type FundamentalRatios,
  type QuoteSummaryData,
  type StatementItem,
  type StatementRow,
} from '@/lib/market/fundamentals';
import { changeClass, fmtMoneyCompact, fmtMultiple, fmtPct, fmtPrice, fmtShare } from './format';
import { useJson } from './useJson';

interface FundamentalsResponse {
  available: boolean;
  currency: string;
  priceCurrency: string;
  priceInStatementCurrency: number | null;
  fxRate: number | null;
  annual: StatementRow[];
  ttm: StatementRow | null;
  ratios: FundamentalRatios;
  summary: QuoteSummaryData | null;
  dcfDefaults: { growth: number; discountRate: number; terminalGrowth: number };
}

const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

type MetricDef = { key: keyof FundamentalRatios; label: string; hint: string; kind: 'multiple' | 'share' | 'growth' | 'money' | 'price' };

const GROUPS: Array<{ title: string; metrics: MetricDef[] }> = [
  {
    title: 'Valorisation',
    metrics: [
      { key: 'marketCap', label: 'Capitalisation', hint: 'Cours × nombre d’actions.', kind: 'money' },
      { key: 'enterpriseValue', label: 'Valeur d’entreprise', hint: 'Capitalisation + dette nette : le prix de toute l’entreprise.', kind: 'money' },
      { key: 'per', label: 'PER (12 mois)', hint: 'Cours / bénéfice par action des 12 derniers mois. Combien d’années de bénéfices paie-t-on.', kind: 'multiple' },
      { key: 'forwardPer', label: 'PER prévisionnel', hint: 'Cours / bénéfice par action attendu par les analystes sur 12 mois.', kind: 'multiple' },
      { key: 'peg', label: 'PEG (historique)', hint: 'PER / croissance annuelle moyenne du BPA publiée (en points). Autour de 1 : prix cohérent avec la croissance passée.', kind: 'multiple' },
      { key: 'forwardPeg', label: 'PEG prévisionnel', hint: 'PER / croissance attendue par les analystes sur 5 ans.', kind: 'multiple' },
      { key: 'priceToBook', label: 'Cours / actif net', hint: 'Capitalisation / capitaux propres (P/B).', kind: 'multiple' },
      { key: 'priceToSales', label: 'Cours / chiffre d’affaires', hint: 'Capitalisation / chiffre d’affaires des 12 derniers mois (P/S).', kind: 'multiple' },
      { key: 'evToEbitda', label: 'VE / EBITDA', hint: 'Valeur d’entreprise / excédent brut d’exploitation. Compare des sociétés plus ou moins endettées.', kind: 'multiple' },
      { key: 'priceToFcf', label: 'Cours / free cash flow', hint: 'Capitalisation / flux de trésorerie disponible des 12 derniers mois (P/FCF).', kind: 'multiple' },
      { key: 'fcfYield', label: 'Rendement FCF', hint: 'Free cash flow / capitalisation : la trésorerie produite pour 100 € investis.', kind: 'share' },
      { key: 'earningsYield', label: 'Rendement bénéficiaire', hint: 'BPA / cours, l’inverse du PER.', kind: 'share' },
    ],
  },
  {
    title: 'Rentabilité',
    metrics: [
      { key: 'grossMargin', label: 'Marge brute', hint: 'Marge brute / chiffre d’affaires.', kind: 'share' },
      { key: 'operatingMargin', label: 'Marge opérationnelle', hint: 'Résultat opérationnel / chiffre d’affaires.', kind: 'share' },
      { key: 'netMargin', label: 'Marge nette', hint: 'Résultat net / chiffre d’affaires.', kind: 'share' },
      { key: 'fcfMargin', label: 'Marge de free cash flow', hint: 'Free cash flow / chiffre d’affaires.', kind: 'share' },
      { key: 'roe', label: 'ROE', hint: 'Résultat net / capitaux propres : rentabilité de l’argent des actionnaires.', kind: 'share' },
      { key: 'roa', label: 'ROA', hint: 'Résultat net / total du bilan.', kind: 'share' },
    ],
  },
  {
    title: 'Solidité et distribution',
    metrics: [
      { key: 'netDebt', label: 'Dette nette', hint: 'Dette financière − trésorerie. Négative : la société a plus de cash que de dette.', kind: 'money' },
      { key: 'netDebtToEbitda', label: 'Dette nette / EBITDA', hint: 'Années d’EBITDA pour rembourser la dette nette. Au-delà de 3, la dette pèse.', kind: 'multiple' },
      { key: 'debtToEquity', label: 'Dette / capitaux propres', hint: 'Levier financier (gearing brut).', kind: 'share' },
      { key: 'payoutRatio', label: 'Distribution / bénéfice', hint: 'Dividendes versés / résultat net.', kind: 'share' },
      { key: 'fcfPayoutRatio', label: 'Distribution / FCF', hint: 'Dividendes versés / free cash flow. Au-delà de 100 %, le dividende n’est pas couvert par la trésorerie produite.', kind: 'share' },
    ],
  },
  {
    title: 'Croissance et par action',
    metrics: [
      { key: 'revenueGrowth', label: 'CA, dernier exercice', hint: 'Évolution du chiffre d’affaires sur le dernier exercice publié.', kind: 'growth' },
      { key: 'revenueCagr', label: 'CA, par an', hint: 'Croissance annuelle moyenne du chiffre d’affaires sur les exercices affichés.', kind: 'growth' },
      { key: 'epsCagr', label: 'BPA, par an', hint: 'Croissance annuelle moyenne du bénéfice par action.', kind: 'growth' },
      { key: 'fcfCagr', label: 'Free cash flow, par an', hint: 'Croissance annuelle moyenne du flux de trésorerie disponible.', kind: 'growth' },
      { key: 'eps', label: 'BPA (12 mois)', hint: 'Bénéfice net par action dilué.', kind: 'price' },
      { key: 'fcfPerShare', label: 'FCF par action', hint: 'Free cash flow / nombre d’actions.', kind: 'price' },
      { key: 'bookValuePerShare', label: 'Actif net par action', hint: 'Capitaux propres / nombre d’actions.', kind: 'price' },
    ],
  },
];

const ROWS: Array<{ key: StatementItem; label: string; perShare?: boolean }> = [
  { key: 'revenue', label: 'Chiffre d’affaires' },
  { key: 'grossProfit', label: 'Marge brute' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'operatingIncome', label: 'Résultat opérationnel' },
  { key: 'netIncome', label: 'Résultat net' },
  { key: 'eps', label: 'BPA dilué', perShare: true },
  { key: 'operatingCashFlow', label: 'Flux de trésorerie d’exploitation' },
  { key: 'capitalExpenditure', label: 'Investissements (capex)' },
  { key: 'freeCashFlow', label: 'Free cash flow' },
  { key: 'dividendsPaid', label: 'Dividendes versés' },
  { key: 'totalDebt', label: 'Dette financière' },
  { key: 'cash', label: 'Trésorerie' },
  { key: 'equity', label: 'Capitaux propres' },
];

function formatMetric(def: MetricDef, value: number | null, currency: string): string {
  switch (def.kind) {
    case 'multiple': return fmtMultiple(value);
    case 'share': return fmtShare(value);
    case 'growth': return fmtPct(value, 1);
    case 'money': return fmtMoneyCompact(value, currency);
    case 'price': return fmtPrice(value, currency);
  }
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function MarketFundamentals({ symbol, price, priceCurrency }: { symbol: string; price: number; priceCurrency: string }) {
  const { data, error, loading, reload } = useJson<FundamentalsResponse>(`/api/market/fundamentals?symbol=${encodeURIComponent(symbol)}`);

  if (loading && !data) {
    return (
      <section className={`${card} p-4 sm:p-5`} aria-busy="true">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Analyse fondamentale</h2>
        <div className="mt-3 h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className={`${card} p-4 sm:p-5`}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Analyse fondamentale</h2>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          Données financières momentanément indisponibles.
          <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 underline underline-offset-4"><RefreshCw className="h-4 w-4" /> Réessayer</button>
        </p>
      </section>
    );
  }
  if (!data.available) {
    return (
      <section className={`${card} p-4 sm:p-5`}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Analyse fondamentale</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Pas de comptes publiés disponibles pour ce titre.</p>
      </section>
    );
  }

  const { ratios, currency, summary } = data;
  const years = data.annual;
  const showTtm = data.ttm && (years.length === 0 || data.ttm.date > years[years.length - 1].date);

  return (
    <section className={`${card} p-4 sm:p-5`} aria-labelledby="fundamentals-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fundamentals-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Analyse fondamentale</h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Chargement" />}
      </div>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Comptes publiés en {currency}{data.ttm ? `, 12 derniers mois au ${fmtDate(data.ttm.date)}` : ''}. Ratios calculés par Fi-Hub au cours actuel
        {data.fxRate ? ` converti en ${currency} (1 ${priceCurrency.toUpperCase()} = ${data.fxRate.toFixed(4)} ${currency})` : ''}. Survolez un ratio pour sa définition.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{group.title}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.metrics.map((m) => {
                const value = ratios[m.key];
                return (
                  <div key={m.key} title={m.hint} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">{m.label}</dt>
                    <dd className={`text-sm font-medium tabular-nums ${m.kind === 'growth' ? changeClass(value) : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {formatMetric(m, value, currency)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {(years.length > 0 || showTtm) && (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Comptes annuels ({currency})</h3>
          <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th scope="col" className="sticky left-0 bg-white py-2 pr-3 text-left font-medium dark:bg-zinc-900">Exercice</th>
                  {years.map((y) => <th key={y.date} scope="col" className="px-2 py-2 text-right font-medium tabular-nums">{y.date.slice(0, 4)}</th>)}
                  {showTtm && <th scope="col" className="py-2 pl-2 text-right font-medium">12 mois</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {ROWS.filter((r) => years.some((y) => y[r.key] !== null) || (showTtm && data.ttm?.[r.key] != null)).map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="sticky left-0 bg-white py-1.5 pr-3 text-left font-normal text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{r.label}</th>
                    {years.map((y) => (
                      <td key={y.date} className="px-2 py-1.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {r.perShare ? fmtPrice(y[r.key], currency) : fmtMoneyCompact(y[r.key], currency)}
                      </td>
                    ))}
                    {showTtm && (
                      <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {r.perShare ? fmtPrice(data.ttm?.[r.key], currency) : fmtMoneyCompact(data.ttm?.[r.key], currency)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {summary && <Consensus summary={summary} price={price} priceCurrency={priceCurrency} />}
          {summary && <Profile summary={summary} />}
        </div>
        <DcfSimulator
          key={symbol}
          defaults={data.dcfDefaults}
          fcfPerShare={ratios.fcfPerShare}
          grahamNumber={ratios.grahamNumber}
          price={data.priceInStatementCurrency}
          currency={currency}
        />
      </div>

      <details className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">Comment lire ces ratios</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {GROUPS.flatMap((g) => g.metrics).map((m) => (
            <div key={m.key}>
              <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">{m.label} : </dt>
              <dd className="inline">{m.hint}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2">
          Les ratios d’une entreprise se comparent à ceux de son secteur et à leur propre historique ; aucun seuil n’est bon dans l’absolu.
          Banques et assurances se lisent autrement (pas d’EBITDA ni de dette nette au sens industriel).
        </p>
      </details>
    </section>
  );
}

function Consensus({ summary, price, priceCurrency }: { summary: QuoteSummaryData; price: number; priceCurrency: string }) {
  const a = summary.analysts;
  const s = summary.stats;
  const upside = a.targetMean && price > 0 ? a.targetMean / price - 1 : null;
  const span = a.targetHigh !== null && a.targetLow !== null ? a.targetHigh - a.targetLow : null;
  const pos = (v: number) => (span && span > 0 && a.targetLow !== null ? Math.min(Math.max((v - a.targetLow) / span, 0), 1) * 100 : 50);
  const facts: Array<[string, string]> = [
    ['Prochains résultats', fmtDate(s.nextEarningsDate)],
    ['Prochain détachement', fmtDate(s.exDividendDate)],
    ['Bêta', s.beta !== null ? s.beta.toFixed(2).replace('.', ',') : '—'],
    ['BPA attendu (12 mois)', s.forwardEps !== null ? fmtPrice(s.forwardEps, priceCurrency) : '—'],
    ['Croissance BPA attendue', fmtPct(s.earningsGrowthNextYear, 1)],
    ['Détenu par les institutionnels', fmtShare(s.heldByInstitutions)],
    ['Détenu par les dirigeants', fmtShare(s.heldByInsiders)],
    ['Vendu à découvert', fmtShare(s.shortPercentOfFloat)],
  ];

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Consensus des analystes</h3>
      {a.targetMean !== null ? (
        <div className="mt-2">
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            Objectif moyen <span className="font-semibold tabular-nums">{fmtPrice(a.targetMean, priceCurrency)}</span>
            {upside !== null && <span className={`ml-1 tabular-nums ${changeClass(upside)}`}>({fmtPct(upside, 1)} vs cours)</span>}
            {a.recommendation && a.recommendation !== 'none' && (
              <span className="ml-2 rounded-full border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700">
                {RECOMMENDATION_LABELS[a.recommendation] ?? a.recommendation}
              </span>
            )}
          </p>
          {span !== null && span > 0 && a.targetLow !== null && a.targetHigh !== null && (
            <div className="mt-3">
              <div className="relative h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700">
                <span className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--ink)]" style={{ left: `${pos(price)}%` }} title="Cours actuel" />
                <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--chart-3)] bg-white dark:bg-zinc-900" style={{ left: `${pos(a.targetMean)}%` }} title="Objectif moyen" />
              </div>
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                <span>Bas {fmtPrice(a.targetLow, priceCurrency)}</span>
                <span>Haut {fmtPrice(a.targetHigh, priceCurrency)}</span>
              </div>
            </div>
          )}
          {a.count !== null && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{a.count} analyste{a.count > 1 ? 's' : ''} · trait noir : cours actuel, rond : objectif moyen.</p>}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Pas de consensus publié pour ce titre.</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Profile({ summary }: { summary: QuoteSummaryData }) {
  const p = summary.profile;
  if (!p.sector && !p.industry && !p.description) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Profil</h3>
      <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
        {[p.sector, p.industry, p.country].filter(Boolean).join(' · ')}
        {p.employees ? ` · ${new Intl.NumberFormat('fr-FR').format(p.employees)} salariés` : ''}
      </p>
      {p.website && (
        <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-600 underline underline-offset-4 dark:text-zinc-400">
          {new URL(p.website).hostname.replace(/^www\./, '')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
      {p.description && (
        <details className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer select-none">Description de l’activité (en anglais)</summary>
          <p className="mt-1 leading-relaxed" lang="en">{p.description}</p>
        </details>
      )}
    </div>
  );
}

function PercentInput({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="mt-1 flex items-center gap-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={0.5}
          min={-20}
          max={40}
          value={Number.isFinite(value) ? Math.round(value * 1000) / 10 : ''}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-describedby={`${id}-hint`}
          className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <span className="text-sm text-zinc-500">%</span>
      </div>
      <p id={`${id}-hint`} className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
    </div>
  );
}

function DcfSimulator({
  defaults, fcfPerShare, grahamNumber, price, currency,
}: {
  defaults: FundamentalsResponse['dcfDefaults'];
  fcfPerShare: number | null;
  grahamNumber: number | null;
  price: number | null;
  currency: string;
}) {
  const [growth, setGrowth] = useState(defaults.growth);
  const [discount, setDiscount] = useState(defaults.discountRate);
  const [terminal, setTerminal] = useState(defaults.terminalGrowth);
  const value = useMemo(
    () => (fcfPerShare !== null ? dcfValuePerShare({ fcfPerShare, growth, discountRate: discount, terminalGrowth: terminal }) : null),
    [fcfPerShare, growth, discount, terminal]
  );
  const margin = value !== null && price ? value / price - 1 : null;
  const grahamMargin = grahamNumber !== null && price ? grahamNumber / price - 1 : null;

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Simulateur de valeur (DCF)</h3>
      {fcfPerShare === null || fcfPerShare <= 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Free cash flow négatif ou inconnu sur 12 mois : un modèle par actualisation des flux n’a pas de sens ici.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Part du free cash flow par action ({fmtPrice(fcfPerShare, currency)}), le fait croître 5 ans, puis ralentir jusqu’au taux perpétuel en 10 ans, et actualise le tout.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <PercentInput id="dcf-growth" label="Croissance 5 ans" value={growth} onChange={setGrowth} hint="Par an" />
            <PercentInput id="dcf-discount" label="Taux d’actualisation" value={discount} onChange={setDiscount} hint="Rendement exigé" />
            <PercentInput id="dcf-terminal" label="Croissance perpétuelle" value={terminal} onChange={setTerminal} hint="Après 10 ans" />
          </div>
          <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60" aria-live="polite">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Valeur estimée par action</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {value !== null ? fmtPrice(value, currency) : '—'}
              {margin !== null && <span className={`ml-2 text-sm font-medium ${changeClass(margin)}`}>{fmtPct(margin, 0)} vs cours</span>}
            </p>
            {value === null && <p className="text-xs text-zinc-500">Le taux d’actualisation doit dépasser la croissance perpétuelle.</p>}
          </div>
        </>
      )}
      {grahamNumber !== null && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Nombre de Graham (√(22,5 × BPA × actif net par action)) :{' '}
          <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{fmtPrice(grahamNumber, currency)}</span>
          {grahamMargin !== null && <span className={`ml-1 tabular-nums ${changeClass(grahamMargin)}`}>({fmtPct(grahamMargin, 0)} vs cours)</span>}
        </p>
      )}
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        Simulation pédagogique, très sensible aux hypothèses. Ce n’est ni une estimation de Fi-Hub ni un conseil.
      </p>
    </div>
  );
}
