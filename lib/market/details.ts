// Données propres aux ETF et aux cryptos (docs/specs/explorateur-marches-v2.md §4.5-4.6),
// lues dans le module « résumé » du fournisseur. Lecture tolérante : tout champ
// absent reste null et le module correspondant est masqué. Fonctions pures.

import { rawNumber } from './fundamentals';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : isRecord(v) && typeof v.fmt === 'string' && v.fmt.trim() ? v.fmt.trim() : null);
const isoFromEpoch = (v: unknown): string | null => {
  const s = rawNumber(v);
  return s !== null && s > 0 ? new Date(s * 1000).toISOString().slice(0, 10) : null;
};

/** Premier résultat d'une réponse `quoteSummary`. */
export function summaryResult(json: unknown): Record<string, unknown> | null {
  const result = isRecord(json) && isRecord(json.quoteSummary) && Array.isArray(json.quoteSummary.result) ? json.quoteSummary.result[0] : null;
  return isRecord(result) ? result : null;
}

const mod = (result: Record<string, unknown>, name: string): Record<string, unknown> => (isRecord(result[name]) ? (result[name] as Record<string, unknown>) : {});

/** Part exprimée en fraction ; certaines valeurs sont publiées en pourcentage. */
function fraction(v: unknown, percentAbove = 1): number | null {
  const n = rawNumber(v);
  if (n === null) return null;
  return Math.abs(n) > percentAbove ? n / 100 : n;
}

export const SECTOR_LABELS: Record<string, string> = {
  technology: 'Technologie',
  financial_services: 'Services financiers',
  healthcare: 'Santé',
  consumer_cyclical: 'Consommation cyclique',
  consumer_defensive: 'Consommation de base',
  industrials: 'Industrie',
  communication_services: 'Communication',
  energy: 'Énergie',
  basic_materials: 'Matériaux de base',
  utilities: 'Services aux collectivités',
  realestate: 'Immobilier',
};

const ALLOCATION_LABELS: Record<string, string> = {
  stockPosition: 'Actions',
  bondPosition: 'Obligations',
  cashPosition: 'Liquidités',
  preferredPosition: 'Actions de préférence',
  convertiblePosition: 'Convertibles',
  otherPosition: 'Autres',
};

export interface EtfDetails {
  profile: {
    category: string | null;
    family: string | null;
    legalType: string | null;
    inceptionDate: string | null;
    expenseRatio: number | null;
    totalAssets: number | null;
    distributionYield: number | null;
  };
  holdings: Array<{ symbol: string | null; name: string; weight: number }>;
  sectors: Array<{ key: string; label: string; weight: number }>;
  allocation: Array<{ key: string; label: string; weight: number }>;
  portfolioMultiples: { per: number | null; priceToBook: number | null; priceToSales: number | null; priceToCashflow: number | null };
  risk: Array<{ period: string; beta: number | null; sharpe: number | null; volatility: number | null }>;
}

/** « 3y » → 3 ; durée inconnue en dernier. */
function periodYears(period: string): number {
  const n = Number.parseInt(period, 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

type Multiples = EtfDetails['portfolioMultiples'];

/**
 * Multiples moyens des titres détenus. Le fournisseur les publie souvent inversés
 * (rendement bénéficiaire 0,042 au lieu d'un PER de 23,7) : un PER inférieur à 1
 * n'a pas de sens, on inverse alors toute la série. Zéro ou négatif : non publié.
 */
export function portfolioMultiples(raw: Multiples): Multiples {
  const values = Object.values(raw).filter((v): v is number => v !== null && v > 0);
  const inverted = raw.per !== null && raw.per > 0 ? raw.per < 1 : values.length > 0 && values.every((v) => v < 1);
  const fix = (v: number | null) => (v === null || v <= 0 ? null : inverted ? 1 / v : v);
  return { per: fix(raw.per), priceToBook: fix(raw.priceToBook), priceToSales: fix(raw.priceToSales), priceToCashflow: fix(raw.priceToCashflow) };
}

/** Date de création retenue : la plus ancienne entre celle du fonds et la première cotation. */
export function earliestDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return valid[0] ?? null;
}

export function parseEtfDetails(json: unknown): EtfDetails | null {
  const result = summaryResult(json);
  if (!result) return null;
  const fund = mod(result, 'fundProfile');
  const fees = isRecord(fund.feesExpensesInvestment) ? fund.feesExpensesInvestment : {};
  const detail = mod(result, 'summaryDetail');
  const keyStats = mod(result, 'defaultKeyStatistics');
  const top = mod(result, 'topHoldings');
  const perf = mod(result, 'fundPerformance');

  const holdings = (Array.isArray(top.holdings) ? top.holdings : [])
    .filter(isRecord)
    .map((h) => ({ symbol: str(h.symbol), name: str(h.holdingName) ?? str(h.symbol) ?? '', weight: fraction(h.holdingPercent) ?? 0 }))
    .filter((h) => h.name && h.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  const sectors = (Array.isArray(top.sectorWeightings) ? top.sectorWeightings : [])
    .filter(isRecord)
    .flatMap((entry) => Object.entries(entry).map(([key, value]) => ({ key, label: SECTOR_LABELS[key] ?? key, weight: fraction(value) ?? 0 })))
    .filter((s) => s.weight > 0.0005)
    .sort((a, b) => b.weight - a.weight);

  const allocation = Object.keys(ALLOCATION_LABELS)
    .map((key) => ({ key, label: ALLOCATION_LABELS[key], weight: fraction(top[key]) ?? 0 }))
    .filter((a) => a.weight > 0.0005)
    .sort((a, b) => b.weight - a.weight);

  const equity = isRecord(top.equityHoldings) ? top.equityHoldings : {};
  const riskStats = isRecord(perf.riskOverviewStatistics) && Array.isArray(perf.riskOverviewStatistics.riskStatistics)
    ? perf.riskOverviewStatistics.riskStatistics
    : [];
  const risk = riskStats
    .filter(isRecord)
    .map((r) => ({
      period: str(r.year) ?? '',
      beta: rawNumber(r.beta),
      sharpe: rawNumber(r.sharpeRatio),
      // Écart-type annualisé, publié en pourcentage (ex. 17,5).
      volatility: rawNumber(r.stdDev) !== null ? (rawNumber(r.stdDev) as number) / 100 : null,
    }))
    // Le fournisseur publie parfois des lignes entièrement à zéro : sans valeur, pas de ligne.
    .map((r) => ({ ...r, beta: r.beta || null, sharpe: r.sharpe || null, volatility: r.volatility || null }))
    .filter((r) => r.period && (r.beta !== null || r.sharpe !== null || r.volatility !== null))
    .sort((a, b) => periodYears(a.period) - periodYears(b.period));

  const details: EtfDetails = {
    profile: {
      category: str(fund.categoryName) ?? str(keyStats.category),
      family: str(fund.family) ?? str(keyStats.fundFamily),
      legalType: str(fund.legalType) ?? str(keyStats.legalType),
      inceptionDate: isoFromEpoch(keyStats.fundInceptionDate),
      // Frais courants : fraction (0,0038) ; au-delà de 10 %, valeur publiée en pourcentage.
      expenseRatio: fraction(fees.annualReportExpenseRatio, 0.1) ?? fraction(keyStats.annualReportExpenseRatio, 0.1),
      totalAssets: rawNumber(detail.totalAssets) ?? rawNumber(keyStats.totalAssets) ?? rawNumber(fees.totalNetAssets),
      distributionYield: fraction(detail.yield, 0.5) ?? fraction(keyStats.yield, 0.5),
    },
    holdings,
    sectors,
    allocation,
    portfolioMultiples: portfolioMultiples({
      per: rawNumber(equity.priceToEarnings),
      priceToBook: rawNumber(equity.priceToBook),
      priceToSales: rawNumber(equity.priceToSales),
      priceToCashflow: rawNumber(equity.priceToCashflow),
    }),
    risk,
  };
  const empty = !details.profile.category && !details.profile.expenseRatio && !details.profile.totalAssets
    && holdings.length === 0 && sectors.length === 0 && allocation.length === 0;
  return empty ? null : details;
}

export interface CryptoDetails {
  marketCap: number | null;
  volume24h: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  startDate: string | null;
  algorithm: string | null;
  description: string | null;
}

export function parseCryptoDetails(json: unknown): CryptoDetails | null {
  const result = summaryResult(json);
  if (!result) return null;
  const detail = mod(result, 'summaryDetail');
  const price = mod(result, 'price');
  const profile = mod(result, 'summaryProfile');
  const asset = mod(result, 'assetProfile');
  const details: CryptoDetails = {
    marketCap: rawNumber(detail.marketCap) ?? rawNumber(price.marketCap),
    volume24h: rawNumber(detail.volume24Hr) ?? rawNumber(price.volume24Hr) ?? rawNumber(detail.volume),
    circulatingSupply: rawNumber(detail.circulatingSupply) ?? rawNumber(price.circulatingSupply),
    maxSupply: rawNumber(detail.maxSupply),
    startDate: isoFromEpoch(detail.startDate) ?? isoFromEpoch(profile.startDate),
    algorithm: str(detail.algorithm),
    description: str(profile.description) ?? str(profile.longBusinessSummary) ?? str(asset.longBusinessSummary),
  };
  const empty = Object.values(details).every((v) => v === null);
  return empty ? null : details;
}

/** Indicateurs d'offre : part émise et capitalisation entièrement diluée. */
export function supplyMetrics(details: CryptoDetails, price: number | null) {
  const { circulatingSupply: circulating, maxSupply: max } = details;
  return {
    issuedShare: circulating !== null && max !== null && max > 0 ? Math.min(circulating / max, 1) : null,
    fullyDilutedValue: max !== null && max > 0 && price !== null && price > 0 ? max * price : null,
    volumeToMarketCap: details.volume24h !== null && details.marketCap ? details.volume24h / details.marketCap : null,
  };
}
