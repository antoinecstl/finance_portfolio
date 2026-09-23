import type { PortfolioHistoryPoint } from './portfolio-calculator';
import type { Transaction } from './types';
import { convertToBase, type FxRateMap } from './fx';

const MS_PER_DAY = 86_400_000;

export interface PerformanceProjectionPoint {
  date: string;
  actual: number | null;
  projected: number | null;
}

export interface PerformanceProjection {
  points: PerformanceProjectionPoint[];
  annualRate: number;
  observedDays: number;
  currentValue: number;
  projectedValue: number;
  isAnnualized: boolean;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(targetDay, lastDay));
  return result;
}

/**
 * Builds a cash-flow-neutral projection from the account's observed performance.
 * Deposits and withdrawals are removed from each sub-period return so adding cash
 * cannot be mistaken for market performance. No future contribution is assumed.
 */
export function buildPerformanceProjection(
  history: PortfolioHistoryPoint[],
  transactions: Transaction[],
  horizonYears: number,
  fxRates: FxRateMap = {}
): PerformanceProjection | null {
  const sorted = [...history]
    .filter(point => Number.isFinite(point.stocksValue) && point.stocksValue >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstPositiveIndex = sorted.findIndex(point => point.stocksValue > 0);
  if (firstPositiveIndex < 0 || sorted.length - firstPositiveIndex < 2) return null;

  const observed = sorted.slice(firstPositiveIndex);
  const firstDate = new Date(`${observed[0].date}T00:00:00Z`);
  const lastDate = new Date(`${observed[observed.length - 1].date}T00:00:00Z`);
  const observedDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / MS_PER_DAY));

  let growthFactor = 1;
  for (let index = 1; index < observed.length; index += 1) {
    const previous = observed[index - 1];
    const current = observed[index];
    if (previous.stocksValue <= 0) continue;

    const netExternalFlow = transactions.reduce((sum, transaction) => {
      if (transaction.date <= previous.date || transaction.date > current.date) return sum;
      if (transaction.type !== 'DEPOSIT' && transaction.type !== 'WITHDRAWAL') return sum;
      const amount = convertToBase(transaction.amount, transaction.currency ?? 'EUR', transaction.date, fxRates);
      return sum + (transaction.type === 'DEPOSIT' ? amount : -amount);
    }, 0);
    const periodFactor = (current.stocksValue - netExternalFlow) / previous.stocksValue;
    if (Number.isFinite(periodFactor) && periodFactor > 0) growthFactor *= periodFactor;
  }

  // With less than one year, extrapolate the observed compounded return to one
  // year. With a longer history this is the CAGR over the complete observation.
  const rawAnnualRate = Math.pow(growthFactor, 365 / observedDays) - 1;
  // A bounded estimate prevents a very short or noisy history from producing an
  // unusable chart while keeping negative scenarios visible.
  const annualRate = Math.max(-0.9, Math.min(1, Number.isFinite(rawAnnualRate) ? rawAnnualRate : 0));
  const currentValue = observed[observed.length - 1].stocksValue;

  const points: PerformanceProjectionPoint[] = observed.map(point => ({
    date: point.date,
    actual: point.stocksValue,
    projected: null,
  }));
  points[points.length - 1].projected = currentValue;

  const monthCount = Math.max(1, Math.round(horizonYears * 12));
  for (let month = 1; month <= monthCount; month += 1) {
    points.push({
      date: addMonths(lastDate, month).toISOString().slice(0, 10),
      actual: null,
      projected: currentValue * Math.pow(1 + annualRate, month / 12),
    });
  }

  return {
    points,
    annualRate,
    observedDays,
    currentValue,
    projectedValue: points[points.length - 1].projected ?? currentValue,
    isAnnualized: observedDays < 365,
  };
}
