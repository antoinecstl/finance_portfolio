import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPaddleClient } from '@/lib/paddle';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = await createAdminClient();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('paddle_customer_id, paddle_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub?.paddle_customer_id) {
    return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  }

  try {
    const paddle = getPaddleClient();
    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      sub.paddle_subscription_id ? [sub.paddle_subscription_id] : []
    );
    const url = session.urls?.general?.overview;
    if (!url) return NextResponse.json({ error: 'no_portal_url' }, { status: 500 });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'portal_error' },
      { status: 500 }
    );
  }
}
