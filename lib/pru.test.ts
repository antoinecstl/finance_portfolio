import { describe, expect, it } from 'vitest';
import { computePru, latentGain } from './pru';

const run = (ops: Parameters<typeof computePru>[0]) => {
  const outcome = computePru(ops);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
};

describe('computePru', () => {
  it('fait la moyenne pondérée des achats, frais inclus', () => {
    const result = run([
      { type: 'buy', quantity: 10, price: 100, fees: 5 },
      { type: 'buy', quantity: 30, price: 80, fees: 5 },
    ]);
    expect(result.quantity).toBe(40);
    expect(result.cost).toBe(3410);
    expect(result.pru).toBeCloseTo(85.25, 10);
    expect(result.totalFees).toBe(10);
  });

  it('ne change pas le PRU à la vente et calcule la plus-value réalisée', () => {
    const result = run([
      { type: 'buy', quantity: 10, price: 100 },
      { type: 'buy', quantity: 10, price: 120 },
      { type: 'sell', quantity: 5, price: 150, fees: 2 },
    ]);
    expect(result.pru).toBeCloseTo(110, 10);
    expect(result.quantity).toBe(15);
    expect(result.realizedGain).toBeCloseTo((150 - 110) * 5 - 2, 10);
  });

  it('repart de zéro après une vente totale', () => {
    const result = run([
      { type: 'buy', quantity: 10, price: 100 },
      { type: 'sell', quantity: 10, price: 90 },
      { type: 'buy', quantity: 4, price: 50 },
    ]);
    expect(result.quantity).toBe(4);
    expect(result.pru).toBeCloseTo(50, 10);
    expect(result.realizedGain).toBeCloseTo(-100, 10);
  });

  it('refuse une vente supérieure à la quantité détenue et les saisies invalides', () => {
    expect(computePru([{ type: 'buy', quantity: 2, price: 10 }, { type: 'sell', quantity: 3, price: 10 }])).toMatchObject({ ok: false, row: 1 });
    expect(computePru([{ type: 'buy', quantity: 0, price: 10 }])).toMatchObject({ ok: false, row: 0 });
    expect(computePru([{ type: 'buy', quantity: 1, price: -1 }])).toMatchObject({ ok: false, row: 0 });
    expect(computePru([{ type: 'buy', quantity: 1, price: 1, fees: -1 }])).toMatchObject({ ok: false, row: 0 });
  });

  it('gère une liste vide', () => {
    expect(run([])).toEqual({ quantity: 0, pru: 0, cost: 0, realizedGain: 0, totalFees: 0 });
  });
});

describe('latentGain', () => {
  it('compare la valeur au coût de revient', () => {
    const result = run([{ type: 'buy', quantity: 10, price: 100 }]);
    expect(latentGain(result, 125)).toEqual({ value: 1250, gain: 250, percent: 25 });
    expect(latentGain(result, 0)).toBeNull();
    expect(latentGain(run([]), 100)).toBeNull();
  });
});
