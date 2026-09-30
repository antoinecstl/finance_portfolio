import type { AdminTicket, TicketPriority, TicketStatus } from '@/lib/admin-tickets';

export type AdminTicketStatusFilter = TicketStatus | 'all' | 'open';

const PRIORITY_ORDER: Record<TicketPriority, number> = { high: 0, medium: 1, low: 2 };

export function filterAndSortAdminTickets(
  tickets: AdminTicket[],
  filters: { query: string; status: AdminTicketStatusFilter; tag: string },
): AdminTicket[] {
  const needle = filters.query.trim().toLowerCase();
  return tickets
    .filter((ticket) => {
      if (filters.status === 'open' && ticket.status === 'done') return false;
      if (filters.status !== 'all' && filters.status !== 'open' && ticket.status !== filters.status) return false;
      if (filters.tag !== 'all' && !ticket.tags.includes(filters.tag)) return false;
      const searchable = `${ticket.title} ${ticket.description} ${ticket.acceptanceCriteria} ${ticket.tags.join(' ')}`;
      return !needle || searchable.toLowerCase().includes(needle);
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.updatedAt.localeCompare(a.updatedAt));
}
