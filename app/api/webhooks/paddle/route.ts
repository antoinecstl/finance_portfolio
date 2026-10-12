import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPaddleSignature } from '@/lib/paddle';
import { sendSubscriptionReceipt, sendPaymentFailed } from '@/lib/email';

export const runtime = 'nodejs';

type PaddleWebhookEvent = {
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

// Abonnements encore en vigueur (un autre client ne peut pas les remplacer).
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused']);

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get('paddle-signature');

  if (!verifyPaddleSignature(raw, sig)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

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

        // `custom_data.user_id` vient du checkout côté navigateur : il ne doit pas
        // permettre d'écraser l'abonnement payé par un autre client Paddle.
        const { data: existing } = await admin
          .from('subscriptions')
          .select('paddle_subscription_id, paddle_customer_id, status')
          .eq('user_id', userId)
          .maybeSingle();
        if (
          existing?.paddle_subscription_id &&
          existing.paddle_subscription_id !== event.data.id &&
          existing.paddle_customer_id &&
          event.data.customer_id &&
          existing.paddle_customer_id !== event.data.customer_id &&
          LIVE_STATUSES.has(existing.status ?? '')
        ) {
          console.warn('[webhooks/paddle] ignored subscription from another customer', {
            userId,
            subscription: event.data.id,
          });
          break;
        }

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
        if (!userId || !event.data.id) break;
        // Seul l'abonnement résilié est concerné : un autre abonnement rattaché au
        // même user_id (custom_data fourni par le navigateur) n'est pas touché.
        const { error: cancelError } = await admin
          .from('subscriptions')
          .update({
            plan_id: 'free',
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('user_id', userId)
          .eq('paddle_subscription_id', event.data.id);
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
