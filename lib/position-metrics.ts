import type { Account, StockPosition, StockQuote, Transaction } from './types';
import { convertToBase, type FxRateMap } from './fx';
import { buildPositionDisplayGroups, transactionMatchesPositionDisplayGroup } from './position-display';
import { getSectorColor } from './utils';

export interface PositionTransactionStats {
  buys: Transaction[];
  sells: Transaction[];
  dividends: Transaction[];
  totalBought: number;
  totalSold: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalDividends: number;
  totalDividendsInBase: number;
  allTransactions: Transaction[];
}

export interface PositionMetrics {
  key: string; symbol: string; displayLabel: string; name: string;
  accountId: string; accountName: string; accountType: string;
  currentValue: number; investedValue: number; gainValue: number; gainPercent: number;
  dayChange: number; dayChangePercent: number; nativeCurrentValue: number;
  nativeInvestedValue: number; nativeDayChange: number; totalReturnValue: number;
  totalReturnPercent: number; weight: number; quantity: number; avgPrice: number;
  currentPrice: number; costCurrency: string; quoteCurrency: string; color: string;
  isCrypto: boolean; transactionStats: PositionTransactionStats;
}

const currencyOf = (transaction: Transaction) => (transaction.currency ?? 'EUR').toUpperCase();

export function getTransactionsForPosition(
  transactions: Transaction[],
  metric: Pick<PositionMetrics, 'symbol' | 'accountId' | 'costCurrency' | 'isCrypto'>,
): Transaction[] {
  return transactions
    .filter(transaction => transactionMatchesPositionDisplayGroup(transaction, metric))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getTransactionStats(
  transactions: Transaction[],
  metric: Pick<PositionMetrics, 'symbol' | 'accountId' | 'costCurrency' | 'isCrypto'>,
  fxRates: FxRateMap,
): PositionTransactionStats {
  const allTransactions = getTransactionsForPosition(transactions, metric);
  const buys = allTransactions.filter(t => t.type === 'BUY');
  const sells = allTransactions.filter(t => t.type === 'SELL');
  const dividends = allTransactions.filter(t => t.type === 'DIVIDEND');
  return {
    buys, sells, dividends,
    totalBought: buys.reduce((sum, t) => sum + (t.quantity || 0), 0),
    totalSold: sells.reduce((sum, t) => sum + (t.quantity || 0), 0),
    totalBuyAmount: buys.reduce((sum, t) => sum + t.amount, 0),
    totalSellAmount: sells.reduce((sum, t) => sum + t.amount, 0),
    totalDividends: dividends.reduce((sum, t) => sum + t.amount, 0),
    totalDividendsInBase: dividends.reduce((sum, t) => sum + convertToBase(t.amount, currencyOf(t), t.date, fxRates), 0),
    allTransactions,
  };
}

export function buildPositionMetrics({ positions, quotes, transactions = [], accounts = [], fxRates = {}, date, portfolioTotalValue }: {
  positions: StockPosition[]; quotes: Record<string, StockQuote>; transactions?: Transaction[];
  accounts?: Account[]; fxRates?: FxRateMap; date: string; portfolioTotalValue?: number;
}): PositionMetrics[] {
  const accountsById = new Map(accounts.map(account => [account.id, account]));
  const symbolAccounts = new Map<string, Set<string>>();
  for (const group of buildPositionDisplayGroups(positions, quotes, fxRates, date)) {
    const ids = symbolAccounts.get(group.symbol) ?? new Set<string>(); ids.add(group.accountId); symbolAccounts.set(group.symbol, ids);
  }
  const metrics = buildPositionDisplayGroups(positions, quotes, fxRates, date).map((group, index): PositionMetrics => {
    const transactionStats = getTransactionStats(transactions, group, fxRates);
    const totalReturnValue = group.gainValue + transactionStats.totalDividendsInBase;
    const account = accountsById.get(group.accountId);
    const accountType = account?.type ?? '';
    return { ...group, displayLabel: (symbolAccounts.get(group.symbol)?.size ?? 0) > 1 && accountType ? `${group.symbol} (${accountType})` : group.symbol,
      accountName: account?.name ?? '—', accountType, totalReturnValue,
      totalReturnPercent: group.investedValue > 0 ? totalReturnValue / group.investedValue * 100 : 0,
      weight: 0, color: getSectorColor(index), transactionStats };
  });
  const total = portfolioTotalValue ?? metrics.reduce((sum, metric) => sum + metric.currentValue, 0);
  metrics.forEach(metric => { metric.weight = total > 0 ? metric.currentValue / total * 100 : 0; });
  return metrics;
}
