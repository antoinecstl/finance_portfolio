import { describe, expect, it } from 'vitest';
import { buildQuickPortfolio, heldSymbols } from './quick-portfolio';

const pea = { type: 'PEA' as const, currency: 'EUR', supports_positions: null };

describe('buildQuickPortfolio', () => {
  it('crée un versement de départ puis un achat par titre, au prix de revient', () => {
    const result = buildQuickPortfolio(pea, {
      date: '2026-11-13',
      cash: 250.5,
      positions: [
        { symbol: 'wpea.pa', quantity: 100, averagePrice: 5.12 },
        { symbol: 'MC.PA', quantity: 2, averagePrice: 650 },
      ],
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.symbols).toEqual(['WPEA.PA', 'MC.PA']);
    expect(result.transactions.map((t) => [t.type, t.amount, t.stock_symbol])).toEqual([
      ['DEPOSIT', 2062.5, null], // 512 + 1300 investis + 250,50 de liquidités
      ['BUY', 512, 'WPEA.PA'],
      ['BUY', 1300, 'MC.PA'],
    ]);
    expect(result.transactions[1]).toMatchObject({ quantity: 100, price_per_unit: 5.12, currency: 'EUR', fees: 0 });
  });

  it('verse dans chaque devise ce qui finance les titres cotés dans cette devise', () => {
    const result = buildQuickPortfolio({ type: 'CTO', currency: 'EUR', supports_positions: null }, {
      date: '2026-11-13',
      cash: 100,
      positions: [
        { symbol: 'AAPL', quantity: 3, averagePrice: 200, currency: 'USD' },
        { symbol: 'AI.PA', quantity: 1, averagePrice: 170, currency: 'EUR' },
      ],
    });
    if (!result.ok) throw new Error(result.error);
    const deposits = result.transactions.filter((t) => t.type === 'DEPOSIT');
    expect(deposits.map((d) => [d.currency, d.amount]).sort()).toEqual([['EUR', 270], ['USD', 600]]);
    // Versements avant les achats : chaque achat trouve ses liquidités.
    expect(result.transactions.slice(0, 2).every((t) => t.type === 'DEPOSIT')).toBe(true);
  });

  it('refuse les lignes incohérentes en nommant la ligne', () => {
    const base = { date: '2026-11-13', cash: 0 };
    expect(buildQuickPortfolio(pea, { ...base, positions: [] })).toMatchObject({ ok: false });
    expect(
      buildQuickPortfolio(pea, { ...base, positions: [{ symbol: 'MC.PA', quantity: 1, averagePrice: 10 }, { symbol: 'mc.pa', quantity: 1, averagePrice: 10 }] })
    ).toMatchObject({ ok: false, row: 1 });
    expect(buildQuickPortfolio(pea, { ...base, positions: [{ symbol: 'MC.PA', quantity: 0, averagePrice: 10 }] })).toMatchObject({ ok: false, row: 0 });
    expect(buildQuickPortfolio(pea, { ...base, positions: [{ symbol: 'BTC-EUR', quantity: 1, averagePrice: 10 }] })).toMatchObject({ ok: false, row: 0 });
    expect(buildQuickPortfolio(pea, { ...base, cash: -1, positions: [{ symbol: 'MC.PA', quantity: 1, averagePrice: 10 }] })).toMatchObject({ ok: false });
    expect(buildQuickPortfolio(pea, { date: 'hier', positions: [{ symbol: 'MC.PA', quantity: 1, averagePrice: 10 }] })).toMatchObject({ ok: false });
  });

  it('refuse un compte qui ne détient pas de titres', () => {
    expect(
      buildQuickPortfolio({ type: 'LIVRET_A', currency: 'EUR', supports_positions: null }, {
        date: '2026-11-13',
        positions: [{ symbol: 'MC.PA', quantity: 1, averagePrice: 10 }],
      })
    ).toMatchObject({ ok: false });
  });
});

describe('heldSymbols', () => {
  it('ne compte que les titres encore détenus', () => {
    const held = heldSymbols([
      { type: 'BUY', stock_symbol: 'MC.PA', quantity: 2 },
      { type: 'SELL', stock_symbol: 'mc.pa', quantity: 2 },
      { type: 'BUY', stock_symbol: 'AI.PA', quantity: '3' },
      { type: 'DIVIDEND', stock_symbol: 'TTE.PA', quantity: null },
      { type: 'DEPOSIT' },
    ]);
    expect(Array.from(held)).toEqual(['AI.PA']);
  });
});
