import { describe, expect, it } from 'vitest';
import { getPortfolioMarketStatus } from './market-status';
import type { Account, StockPosition, StockQuote } from './types';

const account = (id: string, type: Account['type']): Account => ({
  id, type, name: id, currency: 'EUR', created_at: '', updated_at: '',
});
const position = (accountId: string, symbol = 'MC.PA'): StockPosition => ({
  id: `${accountId}-${symbol}`, account_id: accountId, symbol, name: symbol,
  quantity: 1, average_price: 100, currency: 'EUR', created_at: '', updated_at: '',
});
const quote = (start: number, end: number): StockQuote => ({
  symbol: 'MC.PA', name: 'MC.PA', price: 101, change: 1, changePercent: 1,
  previousClose: 100, open: 100, high: 102, low: 99, volume: 1, currency: 'EUR',
  regularMarketStart: start, regularMarketEnd: end,
});

describe('getPortfolioMarketStatus', () => {
  it('affiche la variation du jour pendant la séance', () => {
    const now = new Date('2026-08-10T10:00:00Z');
    const timestamp = now.getTime() / 1000;
    const status = getPortfolioMarketStatus(
      [position('pea')], [account('pea', 'PEA')],
      { 'MC.PA': quote(timestamp - 60, timestamp + 60) }, now,
    );
    expect(status).toMatchObject({ state: 'open', title: 'Variation du jour' });
  });

  it('affiche la dernière séance hors horaires et le week-end', () => {
    const now = new Date('2026-08-09T10:00:00Z');
    const status = getPortfolioMarketStatus(
      [position('pea')], [account('pea', 'PEA')],
      { 'MC.PA': quote(1, 2) }, now,
    );
    expect(status).toEqual({
      state: 'closed',
      title: 'Variation dernière séance',
      detail: 'Marché fermé · dernière séance',
    });
  });

  it('considère un compte crypto comme toujours ouvert', () => {
    const status = getPortfolioMarketStatus(
      [position('crypto', 'BTC-USD')], [account('crypto', 'CRYPTO')], {},
      new Date('2026-08-09T10:00:00Z'),
    );
    expect(status).toMatchObject({ state: 'open', detail: 'Marché crypto ouvert 24 h/24' });
  });

  it('signale un portefeuille partiellement ouvert quand seule la crypto cote', () => {
    const status = getPortfolioMarketStatus(
      [position('crypto', 'BTC-USD'), position('pea')],
      [account('crypto', 'CRYPTO'), account('pea', 'PEA')], {},
      new Date('2026-08-09T10:00:00Z'),
    );
    expect(status).toMatchObject({ state: 'partial', title: 'Variation en cours' });
  });
});
