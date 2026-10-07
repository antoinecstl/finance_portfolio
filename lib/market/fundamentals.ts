// Fondamentaux de l'explorateur de marchés (docs/specs/explorateur-marches.md §12).
// Fonctions pures : lecture des séries comptables du fournisseur, ratios de
// valorisation calculés par Fi-Hub et petit modèle DCF. Aucun appel réseau ici.

/** Postes comptables demandés au fournisseur (nom de série sans préfixe). */
export const STATEMENT_ITEMS = {
  revenue: 'TotalRevenue',
  grossProfit: 'GrossProfit',
  operatingIncome: 'OperatingIncome',
  ebitda: 'EBITDA',
  netIncome: 'NetIncomeCommonStockholders',
  eps: 'DilutedEPS',
  dilutedShares: 'DilutedAverageShares',
  operatingCashFlow: 'OperatingCashFlow',
  capitalExpenditure: 'CapitalExpenditure',
  freeCashFlow: 'FreeCashFlow',
  dividendsPaid: 'CashDividendsPaid',
  totalDebt: 'TotalDebt',
  cash: 'CashAndCashEquivalents',
  equity: 'StockholdersEquity',
  totalAssets: 'TotalAssets',
  shares: 'OrdinarySharesNumber',
} as const;

export type StatementItem = keyof typeof STATEMENT_ITEMS;

/** Libellés de repli quand la société ne publie pas le poste principal. */
const FALLBACK_ITEMS: Partial<Record<StatementItem, string>> = {
  netIncome: 'NetIncome',
  cash: 'CashCashEquivalentsAndShortTermInvestments',
};

const itemSeries = (series: SeriesMap, prefix: string, key: StatementItem): SeriesPoint[] | undefined => {
  const main = series[`${prefix}${STATEMENT_ITEMS[key]}`];
  if (main && main.length > 0) return main;
  const fallback = FALLBACK_ITEMS[key];
  return fallback ? series[`${prefix}${fallback}`] : undefined;
};

/** Postes de bilan : pris au dernier trimestre publié pour la colonne « 12 derniers mois ». */
const BALANCE_ITEMS: StatementItem[] = ['totalDebt', 'cash', 'equity', 'totalAssets', 'shares'];
/** Postes de flux : sommés sur 12 mois glissants par le fournisseur (préfixe `trailing`). */
const FLOW_ITEMS: StatementItem[] = [
  'revenue', 'grossProfit', 'operatingIncome', 'ebitda', 'netIncome', 'eps', 'dilutedShares',
  'operatingCashFlow', 'capitalExpenditure', 'freeCashFlow', 'dividendsPaid',
];

/** Ratios de valorisation publiés par le fournisseur (estimations d'analystes incluses). */
export const PROVIDER_VALUATION_TYPES = [
  'trailingForwardPeRatio',
  'trailingPegRatio',
] as const;

/** Liste complète des séries à demander à l'endpoint de séries temporelles. */
export function fundamentalsSeriesTypes(): string[] {
  const names = (keys: StatementItem[]) => keys.flatMap((k) => [STATEMENT_ITEMS[k], FALLBACK_ITEMS[k]].filter(Boolean) as string[]);
  return [
    ...names(Object.keys(STATEMENT_ITEMS) as StatementItem[]).map((n) => `annual${n}`),
    ...names(FLOW_ITEMS).map((n) => `trailing${n}`),
    ...names(BALANCE_ITEMS).map((n) => `quarterly${n}`),
    ...PROVIDER_VALUATION_TYPES,
  ];
}

export interface SeriesPoint {
  date: string; // AAAA-MM-JJ, date d'arrêté
  value: number;
  currency: string | null;
}

export type SeriesMap = Record<string, SeriesPoint[]>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Valeur numérique d'un champ `{ raw, fmt }` ou d'un nombre brut. */
export function rawNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (isRecord(v) && typeof v.raw === 'number' && Number.isFinite(v.raw)) return v.raw;
  return null;
}

/**
 * Lit la réponse de l'endpoint de séries temporelles : une entrée par série,
 * `meta.type[0]` donne son nom, et la clé du même nom porte les points
 * `{ asOfDate, currencyCode, reportedValue: { raw } }` (parfois `null`).
 */
export function parseTimeseriesResponse(json: unknown): SeriesMap {
  const out: SeriesMap = {};
  const result = isRecord(json) && isRecord(json.timeseries) ? json.timeseries.result : null;
  if (!Array.isArray(result)) return out;
  for (const entry of result) {
    if (!isRecord(entry) || !isRecord(entry.meta)) continue;
    const type = Array.isArray(entry.meta.type) ? entry.meta.type[0] : null;
    if (typeof type !== 'string') continue;
    const rows = entry[type];
    if (!Array.isArray(rows)) continue;
    const points: SeriesPoint[] = [];
    for (const row of rows) {
      if (!isRecord(row) || typeof row.asOfDate !== 'string') continue;
      const value = rawNumber(row.reportedValue);
      if (value === null) continue;
      points.push({
        date: row.asOfDate.slice(0, 10),
        value,
        currency: typeof row.currencyCode === 'string' ? row.currencyCode : null,
      });
    }
    if (points.length > 0) out[type] = points.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

export type StatementRow = { date: string } & Record<StatementItem, number | null>;

export interface Statements {
  currency: string | null;
  /** Exercices annuels, du plus ancien au plus récent (5 au plus). */
  annual: StatementRow[];
  /** 12 derniers mois : flux glissants + dernier bilan trimestriel. */
  ttm: StatementRow | null;
  /** Estimations publiées par le fournisseur. */
  provider: { forwardPe: number | null; peg: number | null };
}

const lastValue = (points: SeriesPoint[] | undefined): SeriesPoint | null =>
  points && points.length > 0 ? points[points.length - 1] : null;

function emptyRow(date: string): StatementRow {
  const row = { date } as StatementRow;
  for (const key of Object.keys(STATEMENT_ITEMS) as StatementItem[]) row[key] = null;
  return row;
}

/** Regroupe les séries en exercices annuels et en colonne « 12 derniers mois ». */
export function buildStatements(series: SeriesMap, maxYears = 5): Statements {
  const keys = Object.keys(STATEMENT_ITEMS) as StatementItem[];
  const byDate = new Map<string, StatementRow>();
  let currency: string | null = null;

  for (const key of keys) {
    for (const p of itemSeries(series, 'annual', key) ?? []) {
      const row = byDate.get(p.date) ?? emptyRow(p.date);
      row[key] = p.value;
      byDate.set(p.date, row);
      if (!currency && p.currency && key !== 'eps') currency = p.currency;
    }
  }
  const annual = [...byDate.values()]
    .filter((r) => r.revenue !== null || r.netIncome !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxYears);

  let ttm: StatementRow | null = null;
  const trailingDates = FLOW_ITEMS.map((k) => lastValue(itemSeries(series, 'trailing', k))?.date).filter(Boolean) as string[];
  if (trailingDates.length > 0) {
    ttm = emptyRow(trailingDates.sort().at(-1) as string);
    for (const key of FLOW_ITEMS) {
      const p = lastValue(itemSeries(series, 'trailing', key));
      if (p) {
        ttm[key] = p.value;
        if (!currency && p.currency && key !== 'eps') currency = p.currency;
      }
    }
    const latestAnnual = annual.at(-1);
    for (const key of BALANCE_ITEMS) {
      const q = lastValue(itemSeries(series, 'quarterly', key));
      ttm[key] = q?.value ?? latestAnnual?.[key] ?? null;
    }
  } else if (annual.length > 0) {
    // Pas de 12 mois glissants : le dernier exercice en tient lieu.
    ttm = { ...annual[annual.length - 1] };
  }

  // Flux de trésorerie disponible absent : flux d'exploitation + investissements (négatifs).
  for (const row of [...annual, ...(ttm ? [ttm] : [])]) {
    if (row.freeCashFlow === null && row.operatingCashFlow !== null && row.capitalExpenditure !== null) {
      row.freeCashFlow = row.operatingCashFlow + row.capitalExpenditure;
    }
  }

  return {
    currency,
    annual,
    ttm,
    provider: {
      forwardPe: lastValue(series.trailingForwardPeRatio)?.value ?? null,
      peg: lastValue(series.trailingPegRatio)?.value ?? null,
    },
  };
}

/** Taux de croissance annuel moyen entre deux valeurs positives. */
export function cagr(first: number | null, last: number | null, years: number): number | null {
  if (first === null || last === null || first <= 0 || last <= 0 || years <= 0) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

/** Croissance annuelle moyenne d'un poste sur les exercices disponibles (3 au moins). */
export function seriesCagr(rows: StatementRow[], key: StatementItem): number | null {
  const values = rows.filter((r) => r[key] !== null);
  if (values.length < 3) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const years = (Date.parse(last.date) - Date.parse(first.date)) / (365.25 * 86_400_000);
  return cagr(first[key], last[key], Math.round(years));
}

const ratio = (a: number | null | undefined, b: number | null | undefined, positiveDenominator = true): number | null => {
  if (a === null || a === undefined || b === null || b === undefined || b === 0) return null;
  if (positiveDenominator && b < 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
};

export interface FundamentalRatios {
  marketCap: number | null;
  enterpriseValue: number | null;
  netDebt: number | null;
  per: number | null;
  forwardPer: number | null;
  earningsYield: number | null;
  peg: number | null;
  forwardPeg: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;
  evToSales: number | null;
  priceToFcf: number | null;
  fcfYield: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  netDebtToEbitda: number | null;
  payoutRatio: number | null;
  fcfPayoutRatio: number | null;
  revenueGrowth: number | null;
  revenueCagr: number | null;
  epsCagr: number | null;
  fcfCagr: number | null;
  eps: number | null;
  fcfPerShare: number | null;
  bookValuePerShare: number | null;
  grahamNumber: number | null;
}

/**
 * Ratios à partir du cours exprimé dans la devise des comptes.
 * Le PEG rapporte le PER à la croissance annuelle moyenne du BPA (en points),
 * sur les exercices publiés ; le PEG « prévisionnel » vient du fournisseur.
 */
export function computeRatios(statements: Statements, price: number): FundamentalRatios {
  const t = statements.ttm;
  const annual = statements.annual;
  const shares = t?.shares ?? t?.dilutedShares ?? annual.at(-1)?.shares ?? null;
  const eps = t?.eps ?? ratio(t?.netIncome, shares);
  const marketCap = shares !== null && shares > 0 && price > 0 ? price * shares : null;
  const netDebt = t && t.totalDebt !== null ? t.totalDebt - (t.cash ?? 0) : t?.cash != null ? -t.cash : null;
  const enterpriseValue = marketCap !== null ? marketCap + (netDebt ?? 0) : null;
  const per = eps !== null && eps > 0 ? price / eps : null;
  const epsCagr = seriesCagr(annual, 'eps');
  const peg = per !== null && epsCagr !== null && epsCagr > 0 ? per / (epsCagr * 100) : null;
  const fcf = t?.freeCashFlow ?? null;
  const bookValuePerShare = ratio(t?.equity, shares);
  const lastYear = annual.at(-1);
  const prevYear = annual.at(-2);

  return {
    marketCap,
    enterpriseValue,
    netDebt,
    per,
    forwardPer: statements.provider.forwardPe !== null && statements.provider.forwardPe > 0 ? statements.provider.forwardPe : null,
    earningsYield: eps !== null && price > 0 ? eps / price : null,
    peg,
    forwardPeg: statements.provider.peg !== null && statements.provider.peg > 0 ? statements.provider.peg : null,
    priceToBook: ratio(marketCap, t?.equity),
    priceToSales: ratio(marketCap, t?.revenue),
    evToEbitda: ratio(enterpriseValue, t?.ebitda),
    evToSales: ratio(enterpriseValue, t?.revenue),
    priceToFcf: ratio(marketCap, fcf),
    fcfYield: ratio(fcf, marketCap),
    grossMargin: ratio(t?.grossProfit, t?.revenue),
    operatingMargin: ratio(t?.operatingIncome, t?.revenue),
    netMargin: ratio(t?.netIncome, t?.revenue),
    fcfMargin: ratio(fcf, t?.revenue),
    roe: ratio(t?.netIncome, t?.equity),
    roa: ratio(t?.netIncome, t?.totalAssets),
    debtToEquity: ratio(t?.totalDebt, t?.equity),
    netDebtToEbitda: ratio(netDebt, t?.ebitda),
    payoutRatio: t?.dividendsPaid != null ? ratio(Math.abs(t.dividendsPaid), t.netIncome) : null,
    fcfPayoutRatio: t?.dividendsPaid != null ? ratio(Math.abs(t.dividendsPaid), fcf) : null,
    revenueGrowth: lastYear && prevYear ? ratio((lastYear.revenue ?? NaN) - (prevYear.revenue ?? NaN), prevYear.revenue) : null,
    revenueCagr: seriesCagr(annual, 'revenue'),
    epsCagr,
    fcfCagr: seriesCagr(annual, 'freeCashFlow'),
    eps,
    fcfPerShare: ratio(fcf, shares),
    bookValuePerShare,
    // Nombre de Graham : √(22,5 × BPA × actif net par action), si les deux sont positifs.
    grahamNumber: eps !== null && eps > 0 && bookValuePerShare !== null && bookValuePerShare > 0
      ? Math.sqrt(22.5 * eps * bookValuePerShare)
      : null,
  };
}

export interface DcfInput {
  fcfPerShare: number;
  growth: number; // croissance annuelle des 5 premières années
  discountRate: number;
  terminalGrowth: number;
  years?: number; // 10 par défaut ; la croissance décroît linéairement vers le taux terminal à partir de l'an 6
}

/**
 * Valeur par action par actualisation des flux de trésorerie disponibles.
 * Années 1-5 : `growth` ; années 6-10 : décroissance linéaire vers `terminalGrowth` ;
 * valeur terminale de Gordon-Shapiro. Renvoie null si le modèle n'a pas de sens.
 */
export function dcfValuePerShare({ fcfPerShare, growth, discountRate, terminalGrowth, years = 10 }: DcfInput): number | null {
  if (!(fcfPerShare > 0) || discountRate <= terminalGrowth || years < 1) return null;
  let flow = fcfPerShare;
  let value = 0;
  const fade = Math.max(years - 5, 1);
  for (let year = 1; year <= years; year++) {
    const g = year <= 5 ? growth : growth + ((terminalGrowth - growth) * (year - 5)) / fade;
    flow *= 1 + g;
    value += flow / Math.pow(1 + discountRate, year);
  }
  const terminal = (flow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  value += terminal / Math.pow(1 + discountRate, years);
  return Number.isFinite(value) ? value : null;
}

/** Croissance proposée par défaut au simulateur : historique du FCF, bornée entre 0 et 12 %. */
export function defaultDcfGrowth(ratios: Pick<FundamentalRatios, 'fcfCagr' | 'revenueCagr'>): number {
  const g = ratios.fcfCagr ?? ratios.revenueCagr ?? 0.04;
  return Math.min(Math.max(Math.round(g * 100) / 100, 0), 0.12);
}

/**
 * Devise « majeure » d'une cotation : certaines places cotent en centimes
 * (GBp à Londres, ZAc à Johannesburg, ILA à Tel-Aviv).
 */
export function majorCurrency(currency: string): { currency: string; divisor: number } {
  if (currency === 'GBp' || currency === 'GBX') return { currency: 'GBP', divisor: 100 };
  if (currency === 'ZAc') return { currency: 'ZAR', divisor: 100 };
  if (currency === 'ILA') return { currency: 'ILS', divisor: 100 };
  return { currency: currency.toUpperCase(), divisor: 1 };
}

// ── Profil et consensus (module « résumé » du fournisseur, facultatif) ──────

export interface QuoteSummaryData {
  profile: {
    sector: string | null;
    industry: string | null;
    country: string | null;
    website: string | null;
    employees: number | null;
    description: string | null;
  };
  analysts: {
    targetMean: number | null;
    targetHigh: number | null;
    targetLow: number | null;
    recommendation: string | null;
    recommendationMean: number | null;
    count: number | null;
    currency: string | null;
  };
  stats: {
    beta: number | null;
    forwardEps: number | null;
    forwardPe: number | null;
    peg: number | null;
    earningsGrowthNextYear: number | null;
    sharesFloat: number | null;
    heldByInsiders: number | null;
    heldByInstitutions: number | null;
    shortPercentOfFloat: number | null;
    nextEarningsDate: string | null;
    exDividendDate: string | null;
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isoDate = (v: unknown): string | null => {
  const s = rawNumber(v);
  return s !== null && s > 0 ? new Date(s * 1000).toISOString().slice(0, 10) : null;
};
const safeUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Lit la réponse du module « résumé » ; null si elle est vide ou en erreur. */
export function parseQuoteSummary(json: unknown): QuoteSummaryData | null {
  const result = isRecord(json) && isRecord(json.quoteSummary) && Array.isArray(json.quoteSummary.result)
    ? json.quoteSummary.result[0]
    : null;
  if (!isRecord(result)) return null;
  const mod = (name: string): Record<string, unknown> => (isRecord(result[name]) ? (result[name] as Record<string, unknown>) : {});
  const profile = mod('assetProfile');
  const detail = mod('summaryDetail');
  const keyStats = mod('defaultKeyStatistics');
  const financial = mod('financialData');
  const calendar = mod('calendarEvents');
  const trend = mod('earningsTrend');

  const nextYear = Array.isArray(trend.trend)
    ? (trend.trend as unknown[]).find((t) => isRecord(t) && t.period === '+1y')
    : undefined;
  const earningsDates = isRecord(calendar.earnings) && Array.isArray(calendar.earnings.earningsDate)
    ? calendar.earnings.earningsDate
    : [];

  return {
    profile: {
      sector: str(profile.sectorDisp) ?? str(profile.sector),
      industry: str(profile.industryDisp) ?? str(profile.industry),
      country: str(profile.country),
      website: safeUrl(profile.website),
      employees: rawNumber(profile.fullTimeEmployees),
      description: str(profile.longBusinessSummary),
    },
    analysts: {
      targetMean: rawNumber(financial.targetMeanPrice),
      targetHigh: rawNumber(financial.targetHighPrice),
      targetLow: rawNumber(financial.targetLowPrice),
      recommendation: str(financial.recommendationKey),
      recommendationMean: rawNumber(financial.recommendationMean),
      count: rawNumber(financial.numberOfAnalystOpinions),
      currency: str(financial.financialCurrency),
    },
    stats: {
      beta: rawNumber(detail.beta) ?? rawNumber(keyStats.beta),
      forwardEps: rawNumber(keyStats.forwardEps),
      forwardPe: rawNumber(detail.forwardPE) ?? rawNumber(keyStats.forwardPE),
      peg: rawNumber(keyStats.pegRatio),
      earningsGrowthNextYear: isRecord(nextYear) ? rawNumber(nextYear.growth) : null,
      sharesFloat: rawNumber(keyStats.floatShares),
      heldByInsiders: rawNumber(keyStats.heldPercentInsiders),
      heldByInstitutions: rawNumber(keyStats.heldPercentInstitutions),
      shortPercentOfFloat: rawNumber(keyStats.shortPercentOfFloat),
      nextEarningsDate: isoDate(earningsDates[0]),
      exDividendDate: isoDate(detail.exDividendDate) ?? isoDate(calendar.exDividendDate),
    },
  };
}

export const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: 'Achat fort',
  buy: 'Achat',
  hold: 'Conserver',
  underperform: 'Sous-performance',
  sell: 'Vente',
  strong_sell: 'Vente forte',
  none: '—',
};
