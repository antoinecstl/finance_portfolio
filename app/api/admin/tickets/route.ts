import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';
import { serializeTicket, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/admin-tickets';

const fields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10_000),
  acceptanceCriteria: z.string().max(10_000),
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(TICKET_PRIORITIES),
};
const createSchema = z.object(fields);
const updateSchema = z.object({ id: z.string().uuid(), ...fields });
const deleteSchema = z.object({ id: z.string().uuid() });

async function parseBody(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

async function authorize(request: Request) {
  const guard = enforceAuthenticatedJsonMutation(request);
  if (guard) return { response: guard, admin: null };
  const admin = await getAdminUser();
  return admin
    ? { response: null, admin }
    : { response: NextResponse.json({ error: 'not_found' }, { status: 404 }), admin: null };
}

function values(data: z.infer<typeof createSchema>) {
  return {
    title: data.title,
    description: data.description,
    acceptance_criteria: data.acceptanceCriteria,
    tags: [...new Set(data.tags.map((tag) => tag.toLowerCase()))],
    status: data.status,
    priority: data.priority,
  };
}

export async function POST(request: Request) {
  const { response, admin } = await authorize(request);
  if (response || !admin) return response;
  const parsed = createSchema.safeParse(await parseBody(request));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const db = await createAdminClient();
  const { data, error } = await db.from('admin_tickets').insert({
    ...values(parsed.data),
    created_by: admin.id,
  }).select('*').single();
  if (error) {
    console.error('[api/admin/tickets] create failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ ticket: serializeTicket(data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;
  const parsed = updateSchema.safeParse(await parseBody(request));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { id, ...ticket } = parsed.data;
  const db = await createAdminClient();
  const { data, error } = await db.from('admin_tickets').update(values(ticket)).eq('id', id).select('*').single();
  if (error) {
    console.error('[api/admin/tickets] update failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ ticket: serializeTicket(data) });
}

export async function DELETE(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;
  const parsed = deleteSchema.safeParse(await parseBody(request));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const db = await createAdminClient();
  const { error } = await db.from('admin_tickets').delete().eq('id', parsed.data.id);
  if (error) {
    console.error('[api/admin/tickets] delete failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
