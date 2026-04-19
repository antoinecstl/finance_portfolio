import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPaddleSignature } from '@/lib/paddle';
import { sendSubscriptionReceipt, sendPaymentFailed } from '@/lib/email';

export const runtime = 'nodejs';

type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: {
    id?: string;
    customer_id?: string;
    status?: string;
    scheduled_change?: { action?: string; effective_at?: string } | null;
    current_billing_period?: { ends_at?: string } | null;
    canceled_at?: string | null;
    custom_data?: { user_id?: string } | null;
    items?: Array<{ price?: { id?: string; product_id?: string } }>;
  };
};

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get('paddle-signature');

  if (!verifyPaddleSignature(raw, sig)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const admin = await createAdminClient();

  // Idempotence check first (does not commit yet — we mark as processed only after success).
  const { data: seen } = await admin
    .from('webhook_events')
    .select('event_id')
    .eq('provider', 'paddle')
    .eq('event_id', event.event_id)
    .maybeSingle();
  if (seen) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  switch (event.event_type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.activated':
    case 'subscription.resumed':
    case 'subscription.past_due':
    case 'subscription.paused': {
      const userId = event.data.custom_data?.user_id;
      if (!userId || !event.data.id) break;

      const status = event.data.status ?? 'active';
      const periodEnd = event.data.current_billing_period?.ends_at ?? null;
      const cancelAtPeriodEnd = event.data.scheduled_change?.action === 'cancel';

      // Determine plan from Paddle price_id match
      const paddlePriceId = event.data.items?.[0]?.price?.id ?? null;
      const planId =
        paddlePriceId && paddlePriceId === process.env.PADDLE_PRO_PRICE_ID ? 'pro' : 'free';

      await admin.from('subscriptions').upsert(
        {
          user_id: userId,
          plan_id: planId,
          status,
          paddle_customer_id: event.data.customer_id ?? null,
          paddle_subscription_id: event.data.id,
          current_period_end: periodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
        },
        { onConflict: 'user_id' }
      );

      if (
        event.event_type === 'subscription.activated' ||
        event.event_type === 'subscription.past_due'
      ) {
        const { data: authData } = await admin.auth.admin.getUserById(userId);
        const email = authData?.user?.email;
        if (email) {
          if (event.event_type === 'subscription.activated' && planId === 'pro') {
            await sendSubscriptionReceipt(email, periodEnd);
          } else if (event.event_type === 'subscription.past_due') {
            await sendPaymentFailed(email);
          }
        }
      }
      break;
    }
    case 'subscription.canceled': {
      const userId = event.data.custom_data?.user_id;
      if (!userId) break;
      await admin
        .from('subscriptions')
        .update({
          plan_id: 'free',
          status: 'canceled',
          cancel_at_period_end: false,
        })
        .eq('user_id', userId);
      break;
    }
    default:
      // ignore (transaction.*, address.*, etc.)
      break;
  }

  // Mark event as processed only after successful handling — a crash above
  // means Paddle will retry and we will reprocess instead of silently skipping.
  await admin
    .from('webhook_events')
    .insert({ provider: 'paddle', event_id: event.event_id });

  return NextResponse.json({ ok: true });
}
