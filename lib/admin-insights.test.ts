import { describe, expect, it } from 'vitest';
import { calculateRate, estimateMonthlyRevenue, formatAdminRate } from './admin-insights';

describe('admin insights', () => {
  it('calcule et formate un taux arrondi', () => {
    expect(calculateRate(2, 3)).toBe(67);
    expect(formatAdminRate(2, 3)).toBe('67 %');
  });

  it('n’affiche pas un taux trompeur sans population', () => {
    expect(calculateRate(0, 0)).toBeNull();
    expect(formatAdminRate(0, 0)).toBe('—');
  });

  it('estime le revenu avec les seuls abonnements payants', () => {
    expect(estimateMonthlyRevenue(3, 499)).toBe(1497);
    expect(estimateMonthlyRevenue(-1, 499)).toBe(0);
  });
});
