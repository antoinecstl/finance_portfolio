import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteAccountSchema, formatZodError } from '@/lib/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: account, error: accError } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (accError) {
    console.error('[api/accounts/:id] fetch failed', accError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Confirmation by name retyped in body — guardrail against accidental deletion
  // of an account with attached transactions/positions (all cascade on FK).
  const raw = await request.json().catch(() => ({}));
  const parsed = deleteAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  if (parsed.data.confirmName !== account.name) {
    return NextResponse.json(
      { error: 'confirm_mismatch', reason: 'Le nom saisi ne correspond pas au compte.' },
      { status: 400 }
    );
  }

  const { error: delError } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (delError) {
    console.error('[api/accounts/:id] delete failed', delError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
