import type { PortfolioHistoryPoint } from './portfolio-calculator';
import type { Transaction } from './types';
import { convertToBase, type FxRateMap } from './fx';

const MS_PER_DAY = 86_400_000;

export interface PerformanceProjectionPoint {
  date: string;
  actual: number | null;
  projected: number | null;
  pessimistic: number | null;
  optimistic: number | null;
  range: [number, number] | null;
}

export interface PerformanceProjection {
  points: PerformanceProjectionPoint[];
  annualRate: number;
  pessimisticAnnualRate: number;
  optimisticAnnualRate: number;
  observedDays: number;
  currentValue: number;
  projectedValue: number;
  pessimisticValue: number;
  optimisticValue: number;
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
  fxRates: FxRateMap = {},
  lookbackYears?: number
): PerformanceProjection | null {
  const sorted = [...history]
    .filter(point => Number.isFinite(point.stocksValue) && point.stocksValue >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstPositiveIndex = sorted.findIndex(point => point.stocksValue > 0);
  if (firstPositiveIndex < 0 || sorted.length - firstPositiveIndex < 2) return null;

  const allObserved = sorted.slice(firstPositiveIndex);
  const latestDate = new Date(`${allObserved[allObserved.length - 1].date}T00:00:00Z`);
  const lookbackStart = lookbackYears
    ? new Date(Date.UTC(latestDate.getUTCFullYear() - lookbackYears, latestDate.getUTCMonth(), latestDate.getUTCDate()))
    : null;
  const filteredObserved = lookbackStart
    ? allObserved.filter(point => new Date(`${point.date}T00:00:00Z`) >= lookbackStart)
    : allObserved;
  // Preserve a usable sample if the selected period only contains the latest point.
  const observed = filteredObserved.length >= 2 ? filteredObserved : allObserved.slice(-2);
  const firstDate = new Date(`${observed[0].date}T00:00:00Z`);
  const lastDate = new Date(`${observed[observed.length - 1].date}T00:00:00Z`);
  const observedDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / MS_PER_DAY));

  let growthFactor = 1;
  const periodLogReturns: Array<{ value: number; days: number }> = [];
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
    if (Number.isFinite(periodFactor) && periodFactor > 0) {
      growthFactor *= periodFactor;
      const periodDays = Math.max(1, Math.round(
        (new Date(`${current.date}T00:00:00Z`).getTime() - new Date(`${previous.date}T00:00:00Z`).getTime()) / MS_PER_DAY
      ));
      periodLogReturns.push({ value: Math.log(periodFactor), days: periodDays });
    }
  }

  // With less than one year, extrapolate the observed compounded return to one
  // year. With a longer history this is the CAGR over the complete observation.
  const rawAnnualRate = Math.pow(growthFactor, 365 / observedDays) - 1;
  // A bounded estimate prevents a very short or noisy history from producing an
  // unusable chart while keeping negative scenarios visible.
  const annualRate = Math.max(-0.9, Math.min(1, Number.isFinite(rawAnnualRate) ? rawAnnualRate : 0));
  const annualLogReturn = Math.log1p(annualRate);
  const dailyLogReturns = periodLogReturns.map(period => period.value / Math.sqrt(period.days));
  const meanDailyLogReturn = dailyLogReturns.length > 0
    ? dailyLogReturns.reduce((sum, value) => sum + value, 0) / dailyLogReturns.length
    : 0;
  const dailyVariance = dailyLogReturns.length > 1
    ? dailyLogReturns.reduce((sum, value) => sum + Math.pow(value - meanDailyLogReturn, 2), 0) / (dailyLogReturns.length - 1)
    : 0;
  const annualizedVolatility = Math.sqrt(dailyVariance * 365);
  // Keep a visible uncertainty band even with only two valuation points, where
  // volatility cannot be inferred yet. The band widens with observed volatility.
  const scenarioSpread = Math.min(0.5, Math.max(0.05, annualizedVolatility * 0.5));
  const pessimisticAnnualRate = Math.max(-0.95, Math.expm1(annualLogReturn - scenarioSpread));
  const optimisticAnnualRate = Math.min(1.5, Math.expm1(annualLogReturn + scenarioSpread));
  const currentValue = observed[observed.length - 1].stocksValue;

  const points: PerformanceProjectionPoint[] = observed.map(point => ({
    date: point.date,
    actual: point.stocksValue,
    projected: null,
    pessimistic: null,
    optimistic: null,
    range: null,
  }));
  points[points.length - 1].projected = currentValue;
  points[points.length - 1].pessimistic = currentValue;
  points[points.length - 1].optimistic = currentValue;
  points[points.length - 1].range = [currentValue, currentValue];

  const monthCount = Math.max(1, Math.round(horizonYears * 12));
  for (let month = 1; month <= monthCount; month += 1) {
    const projected = currentValue * Math.pow(1 + annualRate, month / 12);
    const pessimistic = currentValue * Math.pow(1 + pessimisticAnnualRate, month / 12);
    const optimistic = currentValue * Math.pow(1 + optimisticAnnualRate, month / 12);
    points.push({
      date: addMonths(lastDate, month).toISOString().slice(0, 10),
      actual: null,
      projected,
      pessimistic,
      optimistic,
      range: [pessimistic, optimistic],
    });
  }

  return {
    points,
    annualRate,
    pessimisticAnnualRate,
    optimisticAnnualRate,
    observedDays,
    currentValue,
    projectedValue: points[points.length - 1].projected ?? currentValue,
    pessimisticValue: points[points.length - 1].pessimistic ?? currentValue,
    optimisticValue: points[points.length - 1].optimistic ?? currentValue,
    isAnnualized: observedDays < 365,
  };
}
