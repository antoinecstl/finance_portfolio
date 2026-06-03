import type { StockPosition, StockQuote, Transaction } from './types';
import { BASE_CURRENCY, convertToBase, type FxRateMap } from './fx';
import { getCryptoBaseSymbol, isCryptoSymbol } from './utils';

export interface PositionDisplayGroup {
  key: string;
  symbol: string;
  name: string;
  accountId: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  costCurrency: string;
  quoteCurrency: string;
  currentValue: number;
  investedValue: number;
  gainValue: number;
  gainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  nativeCurrentValue: number;
  nativeInvestedValue: number;
  nativeDayChange: number;
  sourceSymbols: string[];
  sourceCurrencies: string[];
  isCrypto: boolean;
}

function positionCurrency(position: Pick<StockPosition, 'currency'>): string {
  return (position.currency ?? BASE_CURRENCY).toUpperCase();
}

function positionSymbol(position: Pick<StockPosition, 'symbol'>): string {
  return position.symbol.toUpperCase();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.toUpperCase()))).sort();
}

function displayNameForGroup(symbol: string, positions: StockPosition[], isCrypto: boolean): string {
  if (isCrypto) return symbol;

  const firstName = positions.find((position) => position.name)?.name;
  return firstName ?? symbol;
}

export function positionDisplaySymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  return isCryptoSymbol(upperSymbol) ? getCryptoBaseSymbol(upperSymbol) : upperSymbol;
}

export function positionDisplayKey(position: StockPosition): string {
  const symbol = positionSymbol(position);
  if (isCryptoSymbol(symbol)) {
    return `${position.account_id}:crypto:${getCryptoBaseSymbol(symbol)}`;
  }

  return `${position.account_id}:${symbol}:${positionCurrency(position)}`;
}

export function buildPositionDisplayGroups(
  positions: StockPosition[],
  quotes: Record<string, StockQuote>,
  fxRates: FxRateMap,
  date: string
): PositionDisplayGroup[] {
  const grouped = new Map<string, StockPosition[]>();

  for (const position of positions) {
    const key = positionDisplayKey(position);
    const items = grouped.get(key) ?? [];
    items.push(position);
    grouped.set(key, items);
  }

  return Array.from(grouped.entries()).map(([key, items]) => {
    const first = items[0];
    const firstSymbol = positionSymbol(first);
    const isCrypto = isCryptoSymbol(firstSymbol);
    const symbol = isCrypto ? getCryptoBaseSymbol(firstSymbol) : firstSymbol;
    const sourceSymbols = uniqueSorted(items.map((position) => positionSymbol(position)));
    const sourceCurrencies = uniqueSorted(items.map(positionCurrency));

    let quantity = 0;
    let currentValue = 0;
    let investedValue = 0;
    let dayChange = 0;
    let nativeCurrentValue = 0;
    let nativeInvestedValue = 0;
    let nativeDayChange = 0;
    let quoteCurrency = BASE_CURRENCY;
    let costCurrency = BASE_CURRENCY;

    for (const position of items) {
      const quote = quotes[position.symbol];
      const positionCostCurrency = positionCurrency(position);
      const positionQuoteCurrency = (quote?.currency ?? positionCostCurrency).toUpperCase();
      const currentPrice = quote?.price ?? position.average_price;
      const currentDayChange = quote?.change ?? 0;
      const currentNative = position.quantity * currentPrice;
      const investedNative = position.quantity * position.average_price;
      const dayChangeNative = position.quantity * currentDayChange;

      quantity += position.quantity;
      currentValue += convertToBase(currentNative, positionQuoteCurrency, date, fxRates);
      investedValue += convertToBase(investedNative, positionCostCurrency, date, fxRates);
      dayChange += convertToBase(dayChangeNative, positionQuoteCurrency, date, fxRates);

      if (!isCrypto) {
        nativeCurrentValue += currentNative;
        nativeInvestedValue += investedNative;
        nativeDayChange += dayChangeNative;
        quoteCurrency = positionQuoteCurrency;
        costCurrency = positionCostCurrency;
      }
    }

    if (isCrypto) {
      nativeCurrentValue = currentValue;
      nativeInvestedValue = investedValue;
      nativeDayChange = dayChange;
      quoteCurrency = BASE_CURRENCY;
      costCurrency = BASE_CURRENCY;
    }

    const avgPrice = quantity > 0 ? nativeInvestedValue / quantity : 0;
    const currentPrice = quantity > 0 ? nativeCurrentValue / quantity : 0;
    const gainValue = currentValue - investedValue;
    const gainPercent = investedValue > 0 ? (gainValue / investedValue) * 100 : 0;
    const previousValue = currentValue - dayChange;
    const dayChangePercent = previousValue > 0 ? (dayChange / previousValue) * 100 : 0;

    return {
      key,
      symbol,
      name: displayNameForGroup(symbol, items, isCrypto),
      accountId: first.account_id,
      quantity,
      avgPrice,
      currentPrice,
      costCurrency,
      quoteCurrency,
      currentValue,
      investedValue,
      gainValue,
      gainPercent,
      dayChange,
      dayChangePercent,
      nativeCurrentValue,
      nativeInvestedValue,
      nativeDayChange,
      sourceSymbols,
      sourceCurrencies,
      isCrypto,
    };
  });
}

export function transactionMatchesPositionDisplayGroup(
  transaction: Pick<Transaction, 'account_id' | 'stock_symbol' | 'currency'>,
  group: Pick<PositionDisplayGroup, 'accountId' | 'symbol' | 'costCurrency' | 'isCrypto'>
): boolean {
  if (transaction.account_id !== group.accountId || !transaction.stock_symbol) {
    return false;
  }

  const transactionSymbol = transaction.stock_symbol.toUpperCase();
  if (group.isCrypto) {
    return isCryptoSymbol(transactionSymbol) && getCryptoBaseSymbol(transactionSymbol) === group.symbol;
  }

  return transactionSymbol === group.symbol
    && (transaction.currency ?? BASE_CURRENCY).toUpperCase() === group.costCurrency;
}
