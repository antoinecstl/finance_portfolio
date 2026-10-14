// Comptes annuels officiels des sociétés américaines : données XBRL des 10-K
// publiées par la SEC (EDGAR, API `companyfacts`). Gratuit, sans clé, 10 requêtes
// par seconde au plus, `User-Agent` avec contact obligatoire.
// docs/specs/explorateur-marches-v2.md §6.

import { STATEMENT_ITEMS, type StatementItem, type StatementRow } from '../fundamentals';

const DAY_MS = 86_400_000;

/** Société américaine cotée en USD sans suffixe de place (AAPL, BRK-B). */
export function isSecEligible(symbol: string, quoteCurrency: string | null | undefined): boolean {
  return /^[A-Z]{1,5}(-[A-Z])?$/.test(symbol) && (quoteCurrency ?? '').toUpperCase() === 'USD';
}

/** Table officielle ticker → CIK (`company_tickers.json`). CIK sur 10 chiffres. */
export function parseCompanyTickers(json: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!json || typeof json !== 'object') return out;
  for (const entry of Object.values(json as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const { ticker, cik_str: cik } = entry as { ticker?: unknown; cik_str?: unknown };
    if (typeof ticker !== 'string' || (typeof cik !== 'number' && typeof cik !== 'string')) continue;
    const key = ticker.toUpperCase().replace('.', '-');
    if (!out[key]) out[key] = String(cik).padStart(10, '0');
  }
  return out;
}

interface Fact {
  start?: string;
  end: string;
  val: number;
  form: string;
  filed: string;
}

type ConceptFacts = Map<string, Fact>; // date de fin → fait retenu

const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '10-KT', '10-KT/A']);

/** Concepts US GAAP par poste, du préféré au repli. Choisis exercice par exercice. */
const CONCEPTS = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet', 'RevenuesNetOfInterestExpense'],
  grossProfit: ['GrossProfit'],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements'],
  depreciation: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
  dividendsPaid: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'Cash'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  totalAssets: ['Assets'],
  longTermDebt: ['LongTermDebt'],
  longTermDebtNoncurrent: ['LongTermDebtNoncurrent'],
  longTermDebtCurrent: ['LongTermDebtCurrent'],
  shortTermDebt: ['ShortTermBorrowings', 'CommercialPaper'],
  shares: ['CommonStockSharesOutstanding'],
} as const;

const DURATION = new Set<keyof typeof CONCEPTS>(['revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'eps', 'dilutedShares', 'operatingCashFlow', 'capex', 'depreciation', 'dividendsPaid']);
const UNIT: Partial<Record<keyof typeof CONCEPTS, string>> = { eps: 'USD/shares', dilutedShares: 'shares', shares: 'shares' };

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY_MS;

function readFacts(taxonomy: Record<string, unknown>, concept: string, unit: string, duration: boolean): ConceptFacts {
  const out: ConceptFacts = new Map();
  const node = taxonomy[concept] as { units?: Record<string, unknown> } | undefined;
  const list = node?.units?.[unit];
  if (!Array.isArray(list)) return out;
  for (const raw of list) {
    const f = raw as Partial<Fact>;
    if (typeof f.end !== 'string' || typeof f.val !== 'number' || !Number.isFinite(f.val)) continue;
    if (typeof f.form !== 'string' || !ANNUAL_FORMS.has(f.form) || typeof f.filed !== 'string') continue;
    if (duration) {
      if (typeof f.start !== 'string') continue;
      const length = days(f.start, f.end);
      if (!(length >= 330 && length <= 400)) continue; // exercice complet uniquement (date illisible exclue)
    } else if (f.start) {
      continue;
    }
    const current = out.get(f.end);
    // Même date d'arrêté : la valeur déposée le plus récemment (retraitements) l'emporte.
    if (!current || f.filed > current.filed) out.set(f.end, f as Fact);
  }
  return out;
}

/** Valeur à une date d'arrêté, tolérance de quelques jours (exercices de 52/53 semaines). */
function valueAt(facts: ConceptFacts, end: string, toleranceDays = 3): number | null {
  const exact = facts.get(end);
  if (exact) return exact.val;
  for (const [date, fact] of facts) if (Math.abs(days(date, end)) <= toleranceDays) return fact.val;
  return null;
}

export interface SecFacts {
  name: string | null;
  rows: StatementRow[];
}

/**
 * Lit la réponse `companyfacts` : un exercice par date de clôture des 10-K, en USD.
 * Les postes absents restent `null` ; le fournisseur de cours les complètera.
 */
export function parseCompanyFacts(json: unknown, maxYears = 15): SecFacts {
  const root = (json ?? {}) as { entityName?: unknown; facts?: Record<string, Record<string, unknown>> };
  const gaap = root.facts?.['us-gaap'];
  const dei = root.facts?.dei;
  const name = typeof root.entityName === 'string' ? root.entityName : null;
  if (!gaap) return { name, rows: [] };

  const facts = {} as Record<keyof typeof CONCEPTS, ConceptFacts[]>;
  for (const key of Object.keys(CONCEPTS) as Array<keyof typeof CONCEPTS>) {
    facts[key] = CONCEPTS[key].map((concept) => readFacts(gaap, concept, UNIT[key] ?? 'USD', DURATION.has(key)));
  }
  const pick = (key: keyof typeof CONCEPTS, end: string): number | null => {
    for (const byConcept of facts[key]) {
      const v = valueAt(byConcept, end);
      if (v !== null) return v;
    }
    return null;
  };

  // Dates de clôture des exercices : celles des comptes de résultat annuels.
  const ends = new Set<string>();
  for (const key of ['revenue', 'netIncome'] as const) for (const byConcept of facts[key]) for (const end of byConcept.keys()) ends.add(end);
  const sortedEnds = [...ends].sort();
  // Deux clôtures à quelques jours d'écart (52/53 semaines, concepts différents) : on garde la plus récente.
  const fiscalEnds = sortedEnds.filter((end, i) => i === sortedEnds.length - 1 || days(end, sortedEnds[i + 1]) > 20).slice(-maxYears);

  const coverShares = dei ? readFacts(dei, 'EntityCommonStockSharesOutstanding', 'shares', false) : new Map<string, Fact>();

  const rows: StatementRow[] = [];
  for (const end of fiscalEnds) {
    const row = { date: end } as StatementRow;
    for (const key of Object.keys(STATEMENT_ITEMS) as StatementItem[]) row[key] = null;

    row.revenue = pick('revenue', end);
    row.grossProfit = pick('grossProfit', end);
    row.operatingIncome = pick('operatingIncome', end);
    row.netIncome = pick('netIncome', end);
    row.eps = pick('eps', end);
    row.dilutedShares = pick('dilutedShares', end);
    row.operatingCashFlow = pick('operatingCashFlow', end);
    const capex = pick('capex', end);
    row.capitalExpenditure = capex !== null ? -Math.abs(capex) : null;
    row.freeCashFlow = row.operatingCashFlow !== null && row.capitalExpenditure !== null ? row.operatingCashFlow + row.capitalExpenditure : null;
    const dividends = pick('dividendsPaid', end);
    row.dividendsPaid = dividends !== null ? -Math.abs(dividends) : null;
    const depreciation = pick('depreciation', end);
    row.ebitda = row.operatingIncome !== null && depreciation !== null ? row.operatingIncome + depreciation : null;
    row.cash = pick('cash', end);
    row.equity = pick('equity', end);
    row.totalAssets = pick('totalAssets', end);

    // Dette financière : long terme (échéances courantes comprises) + court terme.
    const longTerm = pick('longTermDebt', end)
      ?? (pick('longTermDebtNoncurrent', end) !== null ? (pick('longTermDebtNoncurrent', end) as number) + (pick('longTermDebtCurrent', end) ?? 0) : null);
    const shortTerm = pick('shortTermDebt', end);
    row.totalDebt = longTerm !== null || shortTerm !== null ? (longTerm ?? 0) + (shortTerm ?? 0) : null;

    // Actions en circulation : bilan, sinon page de garde du 10-K (datée après la clôture).
    let shares = pick('shares', end);
    if (shares === null) {
      let best: Fact | null = null;
      for (const fact of coverShares.values()) {
        const delay = days(end, fact.end);
        if (delay >= 0 && delay <= 120 && (!best || fact.end < best.end)) best = fact;
      }
      shares = best?.val ?? null;
    }
    row.shares = shares;

    if (row.revenue !== null || row.netIncome !== null) rows.push(row);
  }
  return { name, rows };
}
