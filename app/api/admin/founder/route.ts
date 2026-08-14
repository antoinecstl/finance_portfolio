import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  userId: z.string().uuid(),
  isFounder: z.boolean(),
});

export async function POST(request: Request) {
  const guard = enforceAuthenticatedJsonMutation(request);
  if (guard) return guard;

  // Gate admin : ne révèle pas l'existence de l'endpoint aux non-admins.
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const db = await createAdminClient();
  const { error } = await db
    .from('profiles')
    .update({ is_founder: parsed.data.isFounder })
    .eq('id', parsed.data.userId);

  if (error) {
    console.error('[api/admin/founder] update failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId: parsed.data.userId,
    isFounder: parsed.data.isFounder,
  });
}
