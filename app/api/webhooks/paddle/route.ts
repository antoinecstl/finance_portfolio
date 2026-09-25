import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPaddleSignature } from '@/lib/paddle';
import { sendSubscriptionReceipt, sendPaymentFailed } from '@/lib/email';
import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_WEBHOOK_BYTES = 256 * 1024;

const paddleWebhookSchema = z.object({
  event_id: z.string().min(1).max(128),
  event_type: z.string().min(1).max(100),
  data: z.object({
    id: z.string().max(128).optional(),
    customer_id: z.string().max(128).optional(),
    status: z.string().max(50).optional(),
    scheduled_change: z.object({ action: z.string().max(50).optional() }).nullable().optional(),
    current_billing_period: z.object({ ends_at: z.string().datetime().optional() }).nullable().optional(),
    custom_data: z.object({ user_id: z.string().uuid().optional() }).nullable().optional(),
    items: z.array(z.object({ price: z.object({ id: z.string().max(128).optional() }).optional() })).max(20).optional(),
  }),
});

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }
  const sig = request.headers.get('paddle-signature');

  if (!verifyPaddleSignature(raw, sig)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = paddleWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }
  const event = parsed.data;

  const admin = await createAdminClient();

  const { error: claimError } = await admin
    .from('webhook_events')
    .insert({ provider: 'paddle', event_id: event.event_id });

  if (claimError) {
    if (claimError.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error('[webhooks/paddle] idempotence claim failed', claimError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  try {
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

        const paddlePriceId = event.data.items?.[0]?.price?.id ?? null;
        const proPriceIds = [
          process.env.PADDLE_PRO_PRICE_ID,
          process.env.PADDLE_PRO_YEARLY_PRICE_ID,
        ].filter((v): v is string => Boolean(v));
        const planId =
          paddlePriceId && proPriceIds.includes(paddlePriceId) ? 'pro' : 'free';

        const { error: subError } = await admin.from('subscriptions').upsert(
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
        if (subError) throw subError;

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
        const { error: cancelError } = await admin
          .from('subscriptions')
          .update({
            plan_id: 'free',
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('user_id', userId);
        if (cancelError) throw cancelError;
        break;
      }
      default:
        break;
    }
  } catch (error) {
    await admin
      .from('webhook_events')
      .delete()
      .eq('provider', 'paddle')
      .eq('event_id', event.event_id);
    console.error('[webhooks/paddle] processing failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
