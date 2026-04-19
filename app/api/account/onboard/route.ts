import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcome } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    fullName?: string;
    marketingOptIn?: boolean;
  };

  const { data: current } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .single();

  const alreadyDone = Boolean(current?.onboarded_at);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: body.fullName?.trim() || null,
      marketing_opt_in: Boolean(body.marketingOptIn),
      onboarded_at: now,
      // Signup enforces the CGU checkbox; we persist consent server-side at onboarding
      // so we keep a verifiable trace (RGPD — preuve de consentement).
      terms_accepted_at: now,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[api/account/onboard] update failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  if (!alreadyDone && user.email) {
    await sendWelcome(user.email);
  }

  return NextResponse.json({ ok: true });
}
