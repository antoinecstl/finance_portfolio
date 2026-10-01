import type { Transaction } from './types';
import { calculatePositionsAtDate, findCalculatedPosition } from './portfolio-calculator';
import { convertToBase, type FxRateMap } from './fx';

// Calculs de la page Dividendes (sans dépendance UI).
// Les montants « …Eur » sont convertis en EUR au taux du jour du versement, pour
// pouvoir additionner des dividendes versés dans plusieurs devises.

export interface DividendEvent {
  id: string;
  date: string;
  accountId: string;
  symbol: string | null;
  currency: string;
  amount: number;
  amountEur: number;
  /** Quantité détenue sur le compte à la date du versement (0 si inconnue). */
  quantity: number;
  /** Dividende par action, en devise du versement. */
  perShare: number | null;
  /** Versement rapporté au coût d'acquisition de la ligne, en %. */
  yieldOnCost: number | null;
}

export interface DividendPositionSummary {
  key: string;
  symbol: string | null;
  currency: string;
  total: number;
  totalEur: number;
  count: number;
  sharePercent: number;
  avgPerShare: number | null;
  avgYieldOnCost: number | null;
  lastDate: string;
  lastAmount: number;
}

export interface DividendPeriodPoint {
  key: string;
  label: string;
  amountEur: number;
}

export type DividendYearFilter = number | 'all';

const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function buildDividendEvents(transactions: Transaction[], fxRates: FxRateMap = {}): DividendEvent[] {
  return transactions
    .filter((tx) => tx.type === 'DIVIDEND')
    .map((tx) => {
      const currency = (tx.currency ?? 'EUR').toUpperCase();
      const symbol = tx.stock_symbol ? tx.stock_symbol.toUpperCase() : null;
      let quantity = 0;
      let perShare: number | null = null;
      let yieldOnCost: number | null = null;

      if (symbol) {
        const positions = calculatePositionsAtDate(transactions, tx.date, tx.account_id);
        const position = findCalculatedPosition(positions, symbol, currency, tx.account_id);
        quantity = position?.quantity ?? 0;
        if (quantity > 0) {
          perShare = tx.amount / quantity;
          const costBasis = quantity * (position?.averagePrice ?? 0);
          if (costBasis > 0) yieldOnCost = (tx.amount / costBasis) * 100;
        }
      }

      return {
        id: tx.id,
        date: tx.date,
        accountId: tx.account_id,
        symbol,
        currency,
        amount: tx.amount,
        amountEur: convertToBase(tx.amount, currency, tx.date, fxRates),
        quantity,
        perShare,
        yieldOnCost,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function dividendYears(events: DividendEvent[]): number[] {
  return Array.from(new Set(events.map((event) => Number(event.date.slice(0, 4))))).sort((a, b) => b - a);
}

export function filterDividendsByYear(events: DividendEvent[], year: DividendYearFilter): DividendEvent[] {
  return year === 'all' ? events : events.filter((event) => event.date.startsWith(`${year}-`));
}

const sumEur = (events: DividendEvent[]) => events.reduce((sum, event) => sum + event.amountEur, 0);

function shiftDate(date: string, years: number, days = 0): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Indicateurs de tête de page. `today` au format YYYY-MM-DD. */
export function summarizeDividendKpis(events: DividendEvent[], year: DividendYearFilter, today: string) {
  const periodEvents = filterDividendsByYear(events, year);

  // 12 mois glissants : du même jour l'an dernier (exclu) à aujourd'hui.
  const ttmStart = shiftDate(today, -1);
  const trailing12m = sumEur(events.filter((event) => event.date > ttmStart && event.date <= today));

  // Année en cours à date vs même période de l'année précédente.
  const currentYear = Number(today.slice(0, 4));
  const ytd = sumEur(events.filter((event) => event.date >= `${currentYear}-01-01` && event.date <= today));
  const previousYtd = sumEur(
    events.filter((event) => event.date >= `${currentYear - 1}-01-01` && event.date <= shiftDate(today, -1))
  );
  const ytdChangePercent = previousYtd > 0 ? ((ytd - previousYtd) / previousYtd) * 100 : null;

  return {
    periodTotalEur: sumEur(periodEvents),
    periodCount: periodEvents.length,
    payingPositions: new Set(periodEvents.map((event) => event.symbol ?? '—')).size,
    trailing12mEur: trailing12m,
    monthlyAverageEur: trailing12m / 12,
    currentYear,
    ytdEur: ytd,
    previousYtdEur: previousYtd,
    ytdChangePercent,
  };
}

/** Par position, triées par montant reçu (EUR) décroissant. */
export function summarizeDividendsByPosition(events: DividendEvent[]): DividendPositionSummary[] {
  const byKey = new Map<string, DividendEvent[]>();
  for (const event of events) {
    const key = `${event.symbol ?? '—'}:${event.currency}`;
    byKey.set(key, [...(byKey.get(key) ?? []), event]);
  }
  const totalEur = sumEur(events);

  return Array.from(byKey.entries())
    .map(([key, group]) => {
      const withShares = group.filter((event) => event.perShare !== null);
      const withYield = group.filter((event) => event.yieldOnCost !== null);
      const last = group.reduce((latest, event) => (event.date > latest.date ? event : latest), group[0]);
      const groupEur = sumEur(group);
      return {
        key,
        symbol: group[0].symbol,
        currency: group[0].currency,
        total: group.reduce((sum, event) => sum + event.amount, 0),
        totalEur: groupEur,
        count: group.length,
        sharePercent: totalEur > 0 ? (groupEur / totalEur) * 100 : 0,
        avgPerShare: withShares.length
          ? withShares.reduce((sum, event) => sum + (event.perShare ?? 0), 0) / withShares.length
          : null,
        avgYieldOnCost: withYield.length
          ? withYield.reduce((sum, event) => sum + (event.yieldOnCost ?? 0), 0) / withYield.length
          : null,
        lastDate: last.date,
        lastAmount: last.amount,
      };
    })
    .sort((a, b) => b.totalEur - a.totalEur);
}

/**
 * Série du graphique : 12 mois pour une année donnée, une barre par année
 * (de la première à la dernière, années sans versement incluses) pour « Tout ».
 */
export function dividendSeries(events: DividendEvent[], year: DividendYearFilter): DividendPeriodPoint[] {
  if (year !== 'all') {
    const months = MONTH_LABELS.map((label, index) => ({
      key: `${year}-${String(index + 1).padStart(2, '0')}`,
      label,
      amountEur: 0,
    }));
    for (const event of filterDividendsByYear(events, year)) {
      months[Number(event.date.slice(5, 7)) - 1].amountEur += event.amountEur;
    }
    return months;
  }

  const years = dividendYears(events);
  if (years.length === 0) return [];
  const series: DividendPeriodPoint[] = [];
  for (let y = years[years.length - 1]; y <= years[0]; y++) {
    series.push({ key: String(y), label: String(y), amountEur: sumEur(filterDividendsByYear(events, y)) });
  }
  return series;
}
