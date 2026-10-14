'use client';

import { ExternalLink } from 'lucide-react';
import {
  RECOMMENDATION_LABELS,
  type FundamentalRatios,
  type QuoteSummaryData,
  type StatementItem,
  type StatementRow,
} from '@/lib/market/fundamentals';
import type { DcfPlan } from '@/lib/market/dcf';
import type { HistoryRow } from '@/lib/market/history';
import type { RecentPeriods } from '@/lib/market/quarters';
import { changeClass, fmtMoneyCompact, fmtMultiple, fmtPct, fmtPrice, fmtShare } from './format';
import { useJson } from './useJson';

export interface FundamentalsResponse {
  available: boolean;
  currency: string;
  priceCurrency: string;
  priceInStatementCurrency: number | null;
  fxRate: number | null;
  annual: StatementRow[];
  ttm: StatementRow | null;
  ratios: FundamentalRatios;
  summary: QuoteSummaryData | null;
  dcf: DcfPlan;
  history: HistoryRow[];
  periods?: RecentPeriods;
  sources: { official: boolean; officialYears: number; years: number };
  asOf: string;
  stale: boolean;
}

type MetricDef = {
  key: keyof FundamentalRatios;
  label: string;
  hint: string;
  kind: 'multiple' | 'share' | 'growth' | 'money' | 'price';
  /** Croissance moyenne : le libellé précise la durée (« par an sur 4 ans »). */
  perYear?: boolean;
};

const metricLabel = (m: MetricDef, growthYears: number | null) =>
  m.perYear ? `${m.label}, par an${growthYears ? ` sur ${growthYears} ans` : ''}` : m.label;

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
    title: 'Croissance',
    metrics: [
      { key: 'revenueGrowth', label: 'Chiffre d’affaires, sur 1 an', hint: 'Évolution du chiffre d’affaires entre les deux derniers exercices publiés.', kind: 'growth' },
      { key: 'revenueCagr', label: 'Chiffre d’affaires', hint: 'Croissance annuelle moyenne du chiffre d’affaires sur les derniers exercices publiés (5 au plus).', kind: 'growth', perYear: true },
      { key: 'epsCagr', label: 'Bénéfice par action', hint: 'Croissance annuelle moyenne du bénéfice par action sur les mêmes exercices.', kind: 'growth', perYear: true },
      { key: 'fcfCagr', label: 'Free cash flow', hint: 'Croissance annuelle moyenne du flux de trésorerie disponible sur les mêmes exercices.', kind: 'growth', perYear: true },
    ],
  },
  {
    title: 'Par action (12 derniers mois)',
    metrics: [
      { key: 'eps', label: 'Bénéfice par action', hint: 'Bénéfice net par action dilué des 12 derniers mois.', kind: 'price' },
      { key: 'fcfPerShare', label: 'Free cash flow par action', hint: 'Flux de trésorerie disponible des 12 derniers mois / nombre d’actions.', kind: 'price' },
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

/** Réponse de /api/market/fundamentals, partagée par les onglets Finances, Valorisation et Profil. */
export function useFundamentals(symbol: string) {
  return useJson<FundamentalsResponse>(`/api/market/fundamentals?symbol=${encodeURIComponent(symbol)}`);
}

/** Ratios du jour, par famille. */
export function RatioGroups({ ratios, currency }: { ratios: FundamentalRatios; currency: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{group.title}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.metrics.map((m) => {
              const value = ratios[m.key];
              return (
                <div key={m.key} title={m.hint} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">{metricLabel(m, ratios.growthYears)}</dt>
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
  );
}

export function RatiosGuide() {
  return (
    <details className="text-xs text-zinc-500 dark:text-zinc-400">
      <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">Comment lire ces ratios</summary>
      <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {GROUPS.flatMap((g) => g.metrics).map((m) => (
          <div key={m.key}>
            <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">{metricLabel(m, null)} : </dt>
            <dd className="inline">{m.hint}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2">
        Les ratios d’une entreprise se comparent à ceux de son secteur et à leur propre historique ; aucun seuil n’est bon dans l’absolu.
        Banques et assurances se lisent autrement (pas d’EBITDA ni de dette nette au sens industriel).
      </p>
    </details>
  );
}

/** Tableau des comptes : la vue tableau des graphiques de l'onglet Finances. */
export function AccountsTable({ rows, ttm, currency }: { rows: StatementRow[]; ttm: StatementRow | null; currency: string }) {
  const showTtm = Boolean(ttm && (rows.length === 0 || ttm.date > rows[rows.length - 1].date));
  if (rows.length === 0 && !showTtm) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            <th scope="col" className="sticky left-0 z-10 min-w-[8.5rem] bg-white py-2 pr-3 text-left font-medium shadow-[1px_0_0_var(--rule)] dark:bg-zinc-900">Exercice</th>
            {rows.map((y) => <th key={y.date} scope="col" className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">{y.date.slice(0, 4)}</th>)}
            {showTtm && <th scope="col" className="py-2 pl-2 text-right font-medium">12 mois</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {ROWS.filter((r) => rows.some((y) => y[r.key] !== null) || (showTtm && ttm?.[r.key] != null)).map((r) => (
            <tr key={r.key}>
              <th scope="row" className="sticky left-0 z-10 min-w-[8.5rem] bg-white py-1.5 pr-3 text-left font-normal leading-tight text-zinc-600 shadow-[1px_0_0_var(--rule)] dark:bg-zinc-900 dark:text-zinc-300">{r.label}</th>
              {rows.map((y) => (
                <td key={y.date} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {r.perShare ? fmtPrice(y[r.key], currency) : fmtMoneyCompact(y[r.key], currency)}
                </td>
              ))}
              {showTtm && (
                <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {r.perShare ? fmtPrice(ttm?.[r.key], currency) : fmtMoneyCompact(ttm?.[r.key], currency)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Consensus({ summary, price, priceCurrency }: { summary: QuoteSummaryData; price: number; priceCurrency: string }) {
  const a = summary.analysts;
  const upside = a.targetMean && price > 0 ? a.targetMean / price - 1 : null;
  const span = a.targetHigh !== null && a.targetLow !== null ? a.targetHigh - a.targetLow : null;
  const pos = (v: number) => (span && span > 0 && a.targetLow !== null ? Math.min(Math.max((v - a.targetLow) / span, 0), 1) * 100 : 50);

  return (
    <div>
      {a.targetMean !== null ? (
        <div>
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Pas de consensus publié pour ce titre.</p>
      )}
    </div>
  );
}

/** Dates à venir, risque et actionnariat. */
/**
 * Date d'un événement relue par rapport au jour des données (`asOf`) : le
 * fournisseur laisse parfois une date déjà passée en « prochains résultats ».
 */
export function eventLabel(date: string | null, asOf: string, upcoming: string, past: string): string {
  return date && date < asOf.slice(0, 10) ? past : upcoming;
}

export function CompanyFacts({ summary, priceCurrency, asOf }: { summary: QuoteSummaryData; priceCurrency: string; asOf: string }) {
  const s = summary.stats;
  const facts: Array<[string, string]> = [
    [eventLabel(s.nextEarningsDate, asOf, 'Prochains résultats', 'Derniers résultats connus'), fmtDate(s.nextEarningsDate)],
    [eventLabel(s.exDividendDate, asOf, 'Prochain détachement', 'Dernier détachement'), fmtDate(s.exDividendDate)],
    ['Bêta', s.beta !== null ? s.beta.toFixed(2).replace('.', ',') : '—'],
    ['BPA attendu (12 mois)', s.forwardEps !== null ? fmtPrice(s.forwardEps, priceCurrency) : '—'],
    ['Croissance du BPA attendue (1 an)', fmtPct(s.earningsGrowthNextYear, 1)],
    ['Détenu par les institutionnels', fmtShare(s.heldByInstitutions)],
    ['Détenu par les dirigeants', fmtShare(s.heldByInsiders)],
    ['Vendu à découvert', fmtShare(s.shortPercentOfFloat)],
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
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

export function Profile({ summary }: { summary: QuoteSummaryData }) {
  const p = summary.profile;
  if (!p.sector && !p.industry && !p.description) return null;
  return (
    <div>
      <p className="text-sm text-zinc-900 dark:text-zinc-100">
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
