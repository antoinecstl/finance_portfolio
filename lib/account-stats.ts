import type { Account, Transaction } from './types';
import type { HistoricalQuote } from './stock-api';
import {
  calculateModifiedDietzPerformance,
  calculatePortfolioHistory,
  type PortfolioHistoryPoint,
} from './portfolio-calculator';
import { convertToBase, type FxRateMap } from './fx';

/**
 * Statistiques d'un compte depuis le 1er janvier de l'année en cours.
 * Tous les montants sont exprimés en EUR (devise de base), comme la valeur
 * `calculatedTotalValueInBase` des comptes enrichis.
 */
export interface AccountYearToDateStats {
  year: number;
  // Valeur du compte au 31/12 de l'année précédente (0 si le compte était vide).
  startValue: number;
  currentValue: number;
  // Variation brute de la valeur : currentValue - startValue (apports inclus).
  change: number;
  // Variation rapportée à la valeur de départ ; null si le compte partait de 0.
  changePercent: number | null;
  deposits: number;
  withdrawals: number;
  netFlows: number;
  // Dividendes + intérêts perçus sur l'année.
  income: number;
  fees: number;
  // Gain hors apports/retraits (change - netFlows).
  performance: number;
  // Rendement Modified Dietz, cohérent avec la performance annuelle du dashboard.
  performancePercent: number;
}

/** Date de référence de début d'année : le 31/12 de l'année précédente. */
export function getYearStartReferenceDate(year: number): string {
  return `${year - 1}-12-31`;
}

/**
 * Valorise chaque compte (en EUR) à une date donnée à partir des transactions,
 * des cours historiques et des taux FX. Réutilise le moteur de l'historique du
 * portefeuille, compte par compte.
 */
export function calculateAccountValuesAtDate(
  transactions: Transaction[],
  accounts: Account[],
  historicalQuotes: Record<string, HistoricalQuote[]>,
  date: string,
  fxRates: FxRateMap = {}
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const account of accounts) {
    const accountTransactions = transactions.filter(
      (t) => t.account_id === account.id && t.date <= date
    );
    if (accountTransactions.length === 0) {
      values[account.id] = 0;
      continue;
    }
    const [point] = calculatePortfolioHistory(
      accountTransactions,
      [account],
      historicalQuotes,
      date,
      date,
      'daily',
      fxRates
    );
    values[account.id] = point?.totalValue ?? 0;
  }
  return values;
}

/**
 * Calcule les statistiques depuis le début de l'année d'un compte.
 * `startValue` est la valeur au 31/12 précédent, `currentValue` la valeur
 * actuelle (cours temps réel), toutes deux en EUR.
 */
export function calculateAccountYearToDateStats({
  accountId,
  transactions,
  startValue,
  currentValue,
  today,
  fxRates = {},
}: {
  accountId: string;
  transactions: Transaction[];
  startValue: number;
  currentValue: number;
  today: string;
  fxRates?: FxRateMap;
}): AccountYearToDateStats {
  const year = Number(today.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const accountTransactions = transactions.filter((t) => t.account_id === accountId);

  // Deux points suffisent au Modified Dietz : valeur au 31/12 et valeur du jour.
  const history: PortfolioHistoryPoint[] = [
    { date: getYearStartReferenceDate(year), totalValue: startValue, stocksValue: 0, savingsValue: 0, positions: [] },
    { date: today, totalValue: currentValue, stocksValue: 0, savingsValue: 0, positions: [] },
  ];
  const dietz = calculateModifiedDietzPerformance(
    history,
    accountTransactions,
    yearStart,
    today,
    'totalValue',
    fxRates
  );

  let interests = 0;
  let fees = 0;
  for (const tx of accountTransactions) {
    if (tx.date < yearStart || tx.date > today) continue;
    if (tx.type !== 'INTEREST' && tx.type !== 'FEE') continue;
    const amountEur = convertToBase(tx.amount, tx.currency ?? 'EUR', tx.date, fxRates);
    if (tx.type === 'INTEREST') interests += amountEur;
    else fees += amountEur;
  }

  const change = currentValue - startValue;

  return {
    year,
    startValue,
    currentValue,
    change,
    changePercent: startValue > 0 ? (change / startValue) * 100 : null,
    deposits: dietz.deposits,
    withdrawals: dietz.withdrawals,
    netFlows: dietz.netFlows,
    income: dietz.dividends + interests,
    fees,
    performance: dietz.gainLoss,
    performancePercent: dietz.gainLossPercent,
  };
}
