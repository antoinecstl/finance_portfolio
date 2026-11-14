import { describe, expect, it } from 'vitest';
import { computeDigest, previousMonthPeriod, renderDigestEmail } from './digest';
import type { Transaction } from './types';
import type { PortfolioHistoryPoint } from './portfolio-calculator';

const point = (date: string, totalValue: number, accountValues: Record<string, number> = {}): PortfolioHistoryPoint => ({
  date,
  totalValue,
  stocksValue: 0,
  savingsValue: 0,
  accountValues,
  positions: [],
});
const tx = (partial: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  account_id: 'pea',
  type: 'DEPOSIT',
  amount: 0,
  currency: 'EUR',
  description: '',
  date: '2026-10-10',
  created_at: '2026-10-10T00:00:00Z',
  ...partial,
});

describe('previousMonthPeriod', () => {
  it('donne le mois civil précédent', () => {
    expect(previousMonthPeriod('2026-11-01')).toEqual({
      key: '2026-10-01',
      start: '2026-10-01',
      end: '2026-10-31',
      previousEnd: '2026-09-30',
      label: 'octobre 2026',
      endLabel: '31 octobre',
    });
    expect(previousMonthPeriod('2026-11-30').key).toBe('2026-10-01');
  });

  it('passe l’année et gère février', () => {
    expect(previousMonthPeriod('2027-01-03')).toMatchObject({ start: '2026-12-01', end: '2026-12-31', previousEnd: '2026-11-30', label: 'décembre 2026' });
    expect(previousMonthPeriod('2028-03-01')).toMatchObject({ start: '2028-02-01', end: '2028-02-29', previousEnd: '2028-01-31' });
  });
});

describe('computeDigest', () => {
  const period = previousMonthPeriod('2026-11-01');
  const accounts = [{ id: 'pea', name: 'Mon PEA' }, { id: 'livret', name: 'Livret A' }, { id: 'vide', name: 'Vide' }];

  it('sépare les apports du gain du mois', () => {
    const digest = computeDigest({
      period,
      accounts,
      transactions: [
        tx({ type: 'DEPOSIT', amount: 500, date: '2026-10-01' }),
        tx({ type: 'WITHDRAWAL', amount: 100, date: '2026-10-20', account_id: 'livret' }),
        tx({ type: 'DEPOSIT', amount: 9999, date: '2026-11-02' }), // hors période
      ],
      startPoint: point('2026-09-30', 10_000),
      endPoint: point('2026-10-31', 10_700, { pea: 8_200, livret: 2_500, vide: 0 }),
    });
    expect(digest).toMatchObject({ valueStart: 10_000, valueEnd: 10_700, netFlows: 400, gain: 300 });
    expect(digest?.gainPercent).toBeGreaterThan(2.8);
    expect(digest?.gainPercent).toBeLessThan(3);
    expect(digest?.accounts).toEqual([{ name: 'Mon PEA', value: 8_200 }, { name: 'Livret A', value: 2_500 }]);
  });

  it('ne donne pas de pourcentage quand le portefeuille partait de zéro', () => {
    const digest = computeDigest({
      period,
      accounts,
      transactions: [tx({ type: 'DEPOSIT', amount: 1000, date: '2026-10-15' })],
      startPoint: undefined,
      endPoint: point('2026-10-31', 1020, { pea: 1020 }),
    });
    expect(digest).toMatchObject({ valueStart: 0, netFlows: 1000, gainPercent: null });
    expect(digest?.gain).toBeCloseTo(20, 5);
  });

  it('ne récapitule rien pour un portefeuille vide', () => {
    expect(computeDigest({ period, accounts, transactions: [], startPoint: point('2026-09-30', 0), endPoint: point('2026-10-31', 0) })).toBeNull();
    expect(computeDigest({ period, accounts, transactions: [], startPoint: undefined, endPoint: undefined })).toBeNull();
  });
});

describe('renderDigestEmail', () => {
  it('écrit les montants en clair et échappe les noms de compte', () => {
    const period = previousMonthPeriod('2026-11-01');
    const email = renderDigestEmail(
      { period, valueStart: 10_000, valueEnd: 10_700, netFlows: 400, gain: -300.4, gainPercent: -2.96, accounts: [{ name: '<b>PEA</b> & co', value: 10_700 }] },
      { dashboardUrl: 'https://app/dashboard', unsubscribeUrl: 'https://app/u', settingsUrl: 'https://app/s' }
    );
    expect(email.subject).toBe('Votre récapitulatif d’octobre 2026');
    expect(email.body).toContain('Votre patrimoine en octobre 2026');
    expect(email.body).toContain('−300');
    expect(email.body).toContain('−3,0 %');
    expect(email.body).toContain('&lt;b&gt;PEA&lt;/b&gt; &amp; co');
    expect(email.body).not.toContain('<b>PEA</b>');
    expect(email.body).toContain('https://app/u');
  });
});
