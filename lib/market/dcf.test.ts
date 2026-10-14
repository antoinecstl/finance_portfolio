import { describe, expect, it } from 'vitest';
import { dcfPlan, discountRateFor, impliedGrowth } from './dcf';
import { dcfValuePerShare } from './fundamentals';

const basis = { revenueCagr: null, epsCagr: null, fcfCagr: null, growthYears: null, analystGrowth: null, beta: null };

describe('DCF scenarios', () => {
  it('derives the required return from the beta', () => {
    expect(discountRateFor(null)).toBe(0.09);
    expect(discountRateFor(1)).toBe(0.09);
    expect(discountRateFor(1.12)).toBe(0.095);
    expect(discountRateFor(0.4)).toBe(0.07); // plancher
    expect(discountRateFor(2.5)).toBe(0.12); // plafond
  });

  it('centres growth on the median of past and expected growth', () => {
    // CA +7,7 %, BPA +7 %, FCF +1,8 % : médiane 7 %.
    const plan = dcfPlan({ ...basis, revenueCagr: 0.077, epsCagr: 0.07, fcfCagr: 0.018, growthYears: 4, beta: 1 });
    expect(plan.scenarios.central).toEqual({ growth: 0.07, discountRate: 0.09, terminalGrowth: 0.02 });
    expect(plan.scenarios.prudent.growth).toBe(0.04);
    expect(plan.scenarios.optimistic.growth).toBe(0.1);
    expect(plan.basis.growthYears).toBe(4);
  });

  it('bounds growth and keeps a default without history', () => {
    expect(dcfPlan(basis).scenarios.central.growth).toBe(0.04);
    const hyper = dcfPlan({ ...basis, revenueCagr: 0.5, epsCagr: 0.8, fcfCagr: 0.4 });
    expect(hyper.scenarios.central.growth).toBe(0.15);
    expect(hyper.scenarios.optimistic.growth).toBe(0.21);
    const shrinking = dcfPlan({ ...basis, revenueCagr: -0.05, epsCagr: -0.2 });
    expect(shrinking.scenarios.central.growth).toBe(0);
    expect(shrinking.scenarios.prudent.growth).toBe(0);
    expect(shrinking.scenarios.optimistic.growth).toBe(0.03);
  });
});

describe('implied growth', () => {
  const common = { fcfPerShare: 5, discountRate: 0.09, terminalGrowth: 0.02 };

  it('finds the growth that justifies the current price', () => {
    const price = dcfValuePerShare({ ...common, growth: 0.08 })!;
    const implied = impliedGrowth({ ...common, price });
    expect(implied?.bound).toBeNull();
    expect(implied?.growth).toBeCloseTo(0.08, 6);
  });

  it('flags prices outside the studied range', () => {
    expect(impliedGrowth({ ...common, price: 1_000_000 })).toEqual({ growth: 0.6, bound: 'above' });
    expect(impliedGrowth({ ...common, price: 1 })).toEqual({ growth: -0.3, bound: 'below' });
  });

  it('is meaningless without a positive free cash flow', () => {
    expect(impliedGrowth({ ...common, fcfPerShare: -1, price: 100 })).toBeNull();
    expect(impliedGrowth({ ...common, price: 0 })).toBeNull();
  });
});
