import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';

export const TICKET_STATUSES = ['idea', 'planned', 'in_progress', 'done'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export type AdminTicket = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  tags: string[];
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
};

type TicketRow = {
  id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  tags: string[];
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
};

export function serializeTicket(row: TicketRow): AdminTicket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptance_criteria,
    tags: row.tags,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAdminTickets(): Promise<AdminTicket[]> {
  const db = await createAdminClient();
  const { data, error } = await db
    .from('admin_tickets')
    .select('id,title,description,acceptance_criteria,tags,status,priority,created_at,updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    // Permet au dashboard de rester utilisable avant l'application de la migration.
    console.error('[admin-tickets] list failed', error);
    return [];
  }
  return (data as TicketRow[]).map(serializeTicket);
}
