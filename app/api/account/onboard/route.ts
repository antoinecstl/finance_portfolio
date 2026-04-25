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

  const { data: current, error: currentError } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle();

  if (currentError) {
    console.error('[api/account/onboard] fetch profile failed', currentError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const alreadyDone = Boolean(current?.onboarded_at);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: body.fullName?.trim() || null,
        marketing_opt_in: Boolean(body.marketingOptIn),
        onboarded_at: now,
        terms_accepted_at: now,
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('[api/account/onboard] upsert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  if (!alreadyDone && user.email) {
    await sendWelcome(user.email);
  }

  return NextResponse.json({ ok: true });
}
