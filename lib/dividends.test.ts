import { describe, it, expect } from 'vitest';
import type { Transaction } from './types';
import {
  buildDividendEvents,
  dividendSeries,
  dividendYears,
  summarizeDividendKpis,
  summarizeDividendsByPosition,
} from './dividends';

let _id = 0;
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? `tx-${++_id}`,
    account_id: partial.account_id ?? 'pea',
    type: partial.type ?? 'DIVIDEND',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'EUR',
    description: '',
    date: partial.date ?? '2026-01-01',
    stock_symbol: partial.stock_symbol,
    quantity: partial.quantity,
    price_per_unit: partial.price_per_unit,
    target_amount: null,
    target_currency: null,
    created_at: '2025-01-01T00:00:00Z',
    fee_transaction_id: null,
  };
}

const transactions = [
  tx({ type: 'BUY', stock_symbol: 'TTE.PA', quantity: 100, price_per_unit: 50, amount: 5000, date: '2024-06-01' }),
  tx({ stock_symbol: 'TTE.PA', amount: 80, date: '2025-04-10' }),
  tx({ stock_symbol: 'TTE.PA', amount: 100, date: '2026-04-10' }),
  tx({ stock_symbol: 'TTE.PA', amount: 90, date: '2025-10-10' }),
  tx({ stock_symbol: 'KO', amount: 40, currency: 'USD', date: '2026-07-01' }),
  tx({ amount: 10, date: '2026-02-01' }),
];

const fxRates = { USD: [{ date: '2026-06-30', open: 2, high: 2, low: 2, close: 2, volume: 0, adjustedClose: 2 }] };

describe('dividends', () => {
  const events = buildDividendEvents(transactions, fxRates);

  it('computes per-share amounts, yield on cost and EUR conversion', () => {
    const tte = events.find((event) => event.date === '2026-04-10')!;
    expect(tte.quantity).toBe(100);
    expect(tte.perShare).toBe(1);
    expect(tte.yieldOnCost).toBeCloseTo(2);
    expect(events.find((event) => event.symbol === 'KO')!.amountEur).toBe(20);
    expect(events.find((event) => event.symbol === null)!.perShare).toBeNull();
    expect(events[0].date).toBe('2026-07-01');
  });

  it('builds headline KPIs', () => {
    const kpis = summarizeDividendKpis(events, 2026, '2026-09-30');
    expect(kpis.periodTotalEur).toBe(130);
    expect(kpis.periodCount).toBe(3);
    // 12 mois glissants : 2025-10-10 + 2026 (100 + 20 + 10).
    expect(kpis.trailing12mEur).toBe(220);
    // 2026 à date (130) vs 2025 au 30/09 (80 ; le versement d'octobre est exclu).
    expect(kpis.previousYtdEur).toBe(80);
    expect(kpis.ytdChangePercent).toBeCloseTo(((130 - 80) / 80) * 100);
  });

  it('groups by position with share of total', () => {
    const byPosition = summarizeDividendsByPosition(events);
    expect(byPosition[0]).toMatchObject({ symbol: 'TTE.PA', total: 270, count: 3 });
    expect(byPosition.reduce((sum, position) => sum + position.sharePercent, 0)).toBeCloseTo(100);
  });

  it('builds monthly and yearly series', () => {
    const months = dividendSeries(events, 2026);
    expect(months).toHaveLength(12);
    expect(months[3].amountEur).toBe(100);
    expect(dividendSeries(events, 'all').map((point) => [point.label, point.amountEur])).toEqual([
      ['2025', 170],
      ['2026', 130],
    ]);
    expect(dividendYears(events)).toEqual([2026, 2025]);
  });
});
