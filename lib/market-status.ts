import type { Account, StockPosition, StockQuote } from './types';

export type PortfolioMarketStatus = {
  state: 'open' | 'partial' | 'closed' | 'empty';
  label: string;
};

function quoteIsOpen(quote: StockQuote | undefined, nowUnix: number): boolean {
  if (!quote?.regularMarketStart || !quote.regularMarketEnd) return false;
  return nowUnix >= quote.regularMarketStart && nowUnix < quote.regularMarketEnd;
}

/**
 * Décrit la période couverte par la variation affichée. Les comptes crypto
 * sont ouverts 24 h/24 ; les autres positions suivent la fenêtre de leur place
 * de cotation, ce qui fonctionne aussi pour les jours fériés et les week-ends.
 */
export function getPortfolioMarketStatus(
  positions: StockPosition[],
  accounts: Account[],
  quotes: Record<string, StockQuote>,
  now: Date = new Date(),
): PortfolioMarketStatus {
  const accountTypes = new Map(accounts.map(account => [account.id, account.type]));
  const relevantPositions = positions.filter(position => position.quantity > 0);

  if (relevantPositions.length === 0) {
    return { state: 'empty', label: 'Aucune position' };
  }

  const cryptoCount = relevantPositions.filter(
    position => accountTypes.get(position.account_id) === 'CRYPTO',
  ).length;
  const marketPositions = relevantPositions.filter(
    position => accountTypes.get(position.account_id) !== 'CRYPTO',
  );
  const nowUnix = Math.floor(now.getTime() / 1000);
  const openMarketCount = marketPositions.filter(position =>
    quoteIsOpen(quotes[position.symbol], nowUnix),
  ).length;
  const openCount = cryptoCount + openMarketCount;

  if (cryptoCount === relevantPositions.length) {
    return {
      state: 'open',
      label: 'Ouvert · 24/7',
    };
  }

  if (openCount === relevantPositions.length) {
    return {
      state: 'open',
      label: 'Ouvert',
    };
  }

  if (openCount > 0) {
    return {
      state: 'partial',
      label: 'Partiellement ouvert',
    };
  }

  return {
    state: 'closed',
    label: 'Fermé · dernière séance',
  };
}
