import type { Account, StockQuote, Transaction } from '@/lib/types';
import {
  calculateAccountCashByCurrencyAtDate,
  calculateAllPositionsAtDate,
} from '@/lib/portfolio-calculator';
import { BASE_CURRENCY, convertToBase, type FxRateMap } from '@/lib/fx';
import { accountSupportsPositions } from '@/lib/utils';

// Vue "lecture seule" du portefeuille exposée par l'API publique et le serveur MCP.
// Les montants sont en EUR (devise de base) sauf mention *_native.
// Même logique que le dashboard : positions dérivées des transactions, valorisées
// au dernier cours (repli sur le PRU sans cours), cash rejoué depuis les transactions.

export interface PublicPosition {
  account_id: string;
  account_name: string;
  symbol: string;
  name: string;
  quantity: number;
  cost_currency: string;
  average_price: number;
  quote_currency: string;
  price: number | null;
  price_is_live: boolean;
  cost_basis: number;
  value: number;
  unrealized_gain: number;
  unrealized_gain_percent: number | null;
  day_change: number;
  day_change_percent: number | null;
  weight_percent: number;
}

export interface PublicAccount {
  id: string;
  name: string;
  type: Account['type'];
  currency: string;
  supports_positions: boolean;
  value: number;
  cash: number;
  cash_by_currency: Record<string, number>;
  positions_value: number;
  positions_count: number;
  weight_percent: number;
}

export interface PublicPortfolioTotals {
  total_value: number;
  positions_value: number;
  investment_cash: number;
  savings_value: number;
  cost_basis: number;
  unrealized_gain: number;
  unrealized_gain_percent: number | null;
  day_change: number;
  day_change_percent: number | null;
}

export interface PublicPortfolio {
  base_currency: string;
  as_of: string;
  totals: PublicPortfolioTotals;
  accounts: PublicAccount[];
  positions: PublicPosition[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const percent = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : null);

export function buildPublicPortfolio({
  accounts,
  transactions,
  quotes,
  fxRates = {},
  today,
  asOf = new Date().toISOString(),
}: {
  accounts: Account[];
  transactions: Transaction[];
  quotes: Record<string, StockQuote>;
  fxRates?: FxRateMap;
  today: string;
  asOf?: string;
}): PublicPortfolio {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const positionAccountIds = new Set(accounts.filter(accountSupportsPositions).map((account) => account.id));

  const positions: PublicPosition[] = [];
  let positionsDayChange = 0;
  calculateAllPositionsAtDate(transactions, today).forEach((calculated) => {
    if (calculated.quantity <= 0 || !positionAccountIds.has(calculated.accountId)) return;
    const quote = quotes[calculated.symbol];
    const price = quote?.price ?? null;
    const effectivePrice = price ?? calculated.averagePrice;
    const previousClose = quote?.previousClose || effectivePrice;
    const costCurrency = (calculated.currency ?? 'EUR').toUpperCase();
    const quoteCurrency = (quote?.currency ?? costCurrency).toUpperCase();

    const value = convertToBase(calculated.quantity * effectivePrice, quoteCurrency, today, fxRates);
    const costBasis = convertToBase(calculated.quantity * calculated.averagePrice, costCurrency, today, fxRates);
    const dayChange = convertToBase(calculated.quantity * (effectivePrice - previousClose), quoteCurrency, today, fxRates);
    positionsDayChange += dayChange;

    positions.push({
      account_id: calculated.accountId,
      account_name: accountById.get(calculated.accountId)?.name ?? '',
      symbol: calculated.symbol,
      name: quote?.name || calculated.symbol,
      quantity: round6(calculated.quantity),
      cost_currency: costCurrency,
      average_price: round6(calculated.averagePrice),
      quote_currency: quoteCurrency,
      price: price === null ? null : round6(price),
      price_is_live: price !== null,
      cost_basis: costBasis,
      value,
      unrealized_gain: value - costBasis,
      unrealized_gain_percent: percent(value - costBasis, costBasis),
      day_change: dayChange,
      day_change_percent: percent(dayChange, value - dayChange),
      weight_percent: 0,
    });
  });

  const publicAccounts: PublicAccount[] = accounts.map((account) => {
    const cashByCurrency = calculateAccountCashByCurrencyAtDate(transactions, account.id, today);
    let cash = 0;
    const cashObject: Record<string, number> = {};
    cashByCurrency.forEach((amount, currency) => {
      cash += convertToBase(amount, currency, today, fxRates);
      cashObject[currency] = round2(amount);
    });
    const accountPositions = positions.filter((position) => position.account_id === account.id);
    const positionsValue = accountPositions.reduce((sum, position) => sum + position.value, 0);
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      supports_positions: accountSupportsPositions(account),
      value: cash + positionsValue,
      cash,
      cash_by_currency: cashObject,
      positions_value: positionsValue,
      positions_count: accountPositions.length,
      weight_percent: 0,
    };
  });

  const totalValue = publicAccounts.reduce((sum, account) => sum + account.value, 0);
  const positionsValue = positions.reduce((sum, position) => sum + position.value, 0);
  const costBasis = positions.reduce((sum, position) => sum + position.cost_basis, 0);
  const savingsValue = publicAccounts
    .filter((account) => !account.supports_positions)
    .reduce((sum, account) => sum + account.value, 0);

  for (const position of positions) {
    position.weight_percent = percent(position.value, positionsValue) ?? 0;
    position.cost_basis = round2(position.cost_basis);
    position.value = round2(position.value);
    position.unrealized_gain = round2(position.unrealized_gain);
    position.day_change = round2(position.day_change);
  }
  for (const account of publicAccounts) {
    account.weight_percent = percent(account.value, totalValue) ?? 0;
    account.value = round2(account.value);
    account.cash = round2(account.cash);
    account.positions_value = round2(account.positions_value);
  }
  positions.sort((a, b) => b.value - a.value);

  return {
    base_currency: BASE_CURRENCY,
    as_of: asOf,
    totals: {
      total_value: round2(totalValue),
      positions_value: round2(positionsValue),
      investment_cash: round2(totalValue - positionsValue - savingsValue),
      savings_value: round2(savingsValue),
      cost_basis: round2(costBasis),
      unrealized_gain: round2(positionsValue - costBasis),
      unrealized_gain_percent: percent(positionsValue - costBasis, costBasis),
      day_change: round2(positionsDayChange),
      day_change_percent: percent(positionsDayChange, positionsValue - positionsDayChange),
    },
    accounts: publicAccounts,
    positions,
  };
}

/** Symboles des positions ouvertes (à coter) pour les comptes titres. */
export function openPositionSymbols(accounts: Account[], transactions: Transaction[], today: string): string[] {
  const positionAccountIds = new Set(accounts.filter(accountSupportsPositions).map((account) => account.id));
  const symbols = new Set<string>();
  calculateAllPositionsAtDate(transactions, today).forEach((position) => {
    if (position.quantity > 0 && positionAccountIds.has(position.accountId)) symbols.add(position.symbol);
  });
  return Array.from(symbols).sort();
}
