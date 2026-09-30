import { describe, expect, it } from 'vitest';
import type { AdminTicket } from './admin-tickets';
import { filterAndSortAdminTickets } from './admin-ticket-view';

const ticket = (overrides: Partial<AdminTicket>): AdminTicket => ({
  id: crypto.randomUUID(),
  title: 'Ticket',
  description: '',
  acceptanceCriteria: '',
  tags: [],
  status: 'idea',
  priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('admin ticket view', () => {
  it('masque les tickets terminés dans la vue ouverte', () => {
    const result = filterAndSortAdminTickets([
      ticket({ title: 'Ouvert' }),
      ticket({ title: 'Fini', status: 'done' }),
    ], { query: '', status: 'open', tag: 'all' });
    expect(result.map(({ title }) => title)).toEqual(['Ouvert']);
  });

  it('recherche aussi dans les critères et les tags', () => {
    const tickets = [ticket({ title: 'Import', acceptanceCriteria: 'Un fichier CSV', tags: ['onboarding'] })];
    expect(filterAndSortAdminTickets(tickets, { query: 'csv', status: 'all', tag: 'all' })).toHaveLength(1);
    expect(filterAndSortAdminTickets(tickets, { query: 'onboarding', status: 'all', tag: 'all' })).toHaveLength(1);
  });

  it('place les priorités hautes avant les plus récentes', () => {
    const result = filterAndSortAdminTickets([
      ticket({ title: 'Basse récente', priority: 'low', updatedAt: '2026-02-01T00:00:00.000Z' }),
      ticket({ title: 'Haute ancienne', priority: 'high' }),
    ], { query: '', status: 'all', tag: 'all' });
    expect(result.map(({ title }) => title)).toEqual(['Haute ancienne', 'Basse récente']);
  });
});
