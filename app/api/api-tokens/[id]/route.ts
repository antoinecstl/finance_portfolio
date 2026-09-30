import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthenticatedMutation } from '@/lib/api-security';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { IdRouteContext } from '@/lib/route-types';

// DELETE /api/api-tokens/:id : révoque un jeton (il reste listé comme révoqué).
export async function DELETE(request: Request, { params }: IdRouteContext) {
  const securityError = enforceAuthenticatedMutation(request);
  if (securityError) return securityError;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = await createAdminClient();
  const { data, error } = await db
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[api/api-tokens/:id] revoke failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
