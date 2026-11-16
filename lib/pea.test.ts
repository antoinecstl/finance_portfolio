import { describe, expect, it } from 'vitest';
import { addYears, computePeaStatus, formatMonthsRemaining, sumPeaDeposits } from './pea';

describe('computePeaStatus', () => {
  it('mesure le plafond sur le cumul des versements', () => {
    const status = computePeaStatus({ deposits: 37_500, today: '2026-11-13' });
    expect(status).toMatchObject({ cap: 150_000, remaining: 112_500, capUsedPercent: 25, capReached: false });
    expect(computePeaStatus({ deposits: 160_000, today: '2026-11-13' })).toMatchObject({
      remaining: 0,
      capUsedPercent: 100,
      capReached: true,
    });
  });

  it('ne donne aucune échéance sans date d’ouverture déclarée', () => {
    expect(computePeaStatus({ deposits: 0, today: '2026-11-13' })).toMatchObject({
      openedOn: null,
      fiveYearDate: null,
      fiveYearsReached: null,
      monthsToFiveYears: null,
    });
    expect(computePeaStatus({ deposits: 0, openedOn: 'hier', today: '2026-11-13' }).fiveYearDate).toBeNull();
  });

  it('calcule l’échéance des 5 ans depuis l’ouverture', () => {
    expect(computePeaStatus({ deposits: 0, openedOn: '2022-03-12', today: '2026-11-13' })).toMatchObject({
      fiveYearDate: '2027-03-12',
      fiveYearsReached: false,
      monthsToFiveYears: 3, // 13/11 → 12/03 : trois mois entiers
    });
    expect(computePeaStatus({ deposits: 0, openedOn: '2021-11-13', today: '2026-11-13' })).toMatchObject({
      fiveYearDate: '2026-11-13',
      fiveYearsReached: true,
      monthsToFiveYears: 0,
    });
    expect(computePeaStatus({ deposits: 0, openedOn: '2021-11-14', today: '2026-11-13' }).fiveYearsReached).toBe(false);
  });
});

describe('addYears', () => {
  it('gère le 29 février', () => {
    expect(addYears('2024-02-29', 5)).toBe('2029-02-28');
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29');
    expect(addYears('2020-12-31', 5)).toBe('2025-12-31');
  });
});

describe('sumPeaDeposits', () => {
  it('additionne les versements du compte, sans les retraits ni les autres comptes', () => {
    expect(
      sumPeaDeposits(
        [
          { account_id: 'pea', type: 'DEPOSIT', amount: 1000 },
          { account_id: 'pea', type: 'DEPOSIT', amount: '250.50' },
          { account_id: 'pea', type: 'WITHDRAWAL', amount: 400 },
          { account_id: 'pea', type: 'BUY', amount: 900 },
          { account_id: 'cto', type: 'DEPOSIT', amount: 5000 },
        ],
        'pea'
      )
    ).toBe(1250.5);
  });
});

describe('formatMonthsRemaining', () => {
  it('écrit la durée en clair', () => {
    expect(formatMonthsRemaining(0)).toBe('dans moins d’un mois');
    expect(formatMonthsRemaining(4)).toBe('dans 4 mois');
    expect(formatMonthsRemaining(12)).toBe('dans 1 an');
    expect(formatMonthsRemaining(38)).toBe('dans 3 ans et 2 mois');
  });
});
