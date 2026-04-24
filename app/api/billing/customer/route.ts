import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPaddleClient } from '@/lib/paddle';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = await createAdminClient();

  const { data: existing } = await admin
    .from('subscriptions')
    .select('paddle_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.paddle_customer_id) {
    return NextResponse.json({ customerId: existing.paddle_customer_id });
  }

  try {
    const paddle = getPaddleClient();

    let customerId: string | null = null;

    const collection = paddle.customers.list({ email: [user.email] });
    const firstPage = await collection.next();
    const match = firstPage.find((c) => c.email.toLowerCase() === user.email!.toLowerCase());
    if (match) {
      customerId = match.id;
    } else {
      const created = await paddle.customers.create({
        email: user.email,
        customData: { user_id: user.id },
      });
      customerId = created.id;
    }

    if (existing) {
      await admin
        .from('subscriptions')
        .update({ paddle_customer_id: customerId })
        .eq('user_id', user.id);
    } else {
      await admin.from('subscriptions').insert({
        user_id: user.id,
        plan_id: 'free',
        status: 'active',
        paddle_customer_id: customerId,
      });
    }

    return NextResponse.json({ customerId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'customer_error' },
      { status: 500 }
    );
  }
}
