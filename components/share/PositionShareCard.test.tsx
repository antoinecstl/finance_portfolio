import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildPositionMetrics } from '@/lib/position-metrics';
import { createPositionShareData, DEFAULT_SHARE_CARD_SETTINGS } from '@/lib/share-card';
import type { Account, StockPosition, StockQuote } from '@/lib/types';
import { PositionShareCard } from './PositionShareCard';

const position = (symbol: string, currency: string, quantity: number, average_price: number): StockPosition => ({ id: symbol + currency, account_id: 'crypto', symbol, name: symbol, quantity, average_price, currency, created_at: '', updated_at: '' });
const quote = (symbol: string, currency: string, price: number): StockQuote => ({ symbol, name: symbol, currency, price, change: 0, changePercent: 0, previousClose: price, open: price, high: price, low: price, volume: 0 });

describe('PositionShareCard', () => {
  it('affiche une performance négative non-EUR sans révéler le compte par défaut', () => {
    const [metric] = buildPositionMetrics({ positions: [position('ACME', 'USD', 2, 100)], quotes: { ACME: quote('ACME', 'USD', 80) }, accounts: [{ id: 'crypto', name: 'Compte secret', type: 'CTO', currency: 'USD', created_at: '', updated_at: '' } as Account], date: '2026-07-22' });
    const settings = DEFAULT_SHARE_CARD_SETTINGS; const markup = renderToStaticMarkup(<PositionShareCard data={createPositionShareData(metric, settings, '2026-07-22')} settings={settings} />);
    expect(markup).toContain('ACME'); expect(markup).toContain('-20,00'); expect(markup).not.toContain('Compte secret'); expect(markup).not.toContain('160');
  });

  it('rend une crypto consolidée et le libellé de compte seulement sur demande', () => {
    const positions = [position('BTC-EUR', 'EUR', 0.1, 50000), position('BTC-USD', 'USD', 0.2, 60000)];
    const metrics = buildPositionMetrics({ positions, quotes: { 'BTC-EUR': quote('BTC-EUR', 'EUR', 70000), 'BTC-USD': quote('BTC-USD', 'USD', 75000) }, accounts: [{ id: 'crypto', name: 'Wallet principal', type: 'CRYPTO', currency: 'EUR', created_at: '', updated_at: '' }], date: '2026-07-22' });
    expect(metrics).toHaveLength(1); expect(metrics[0].symbol).toBe('BTC'); expect(metrics[0].quantity).toBeCloseTo(0.3);
    const settings = { ...DEFAULT_SHARE_CARD_SETTINGS, theme: 'dark' as const, format: 'story' as const, showAccountName: true };
    const markup = renderToStaticMarkup(<PositionShareCard data={createPositionShareData(metrics[0], settings, '2026-07-22')} settings={settings} />);
    expect(markup).toContain('Wallet principal'); expect(markup).toContain('height:1920px'); expect(markup).toContain('#0c0b0a');
  });
});
