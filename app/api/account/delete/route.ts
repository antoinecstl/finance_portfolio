import { NextResponse } from 'next/server';
import { enforceAuthenticatedMutation } from '@/lib/api-security';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendAccountDeletion } from '@/lib/email';
import { getPaddleClient } from '@/lib/paddle';

// Abonnements encore facturés : à résilier avant de supprimer le compte.
const BILLED_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused']);

export async function POST(request: Request) {
  const securityError = enforceAuthenticatedMutation(request);
  if (securityError) return securityError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY manquant côté serveur' },
      { status: 500 }
    );
  }

  const email = user.email;
  const admin = await createAdminClient();

  // Un compte supprimé ne doit plus être facturé : on résilie d'abord
  // l'abonnement Paddle, et on n'efface rien si la résiliation échoue.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('paddle_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (sub?.paddle_subscription_id && BILLED_STATUSES.has(sub.status ?? '')) {
    try {
      await getPaddleClient().subscriptions.cancel(sub.paddle_subscription_id, { effectiveFrom: 'immediately' });
    } catch (cancelError) {
      console.error('[api/account/delete] subscription cancel failed', cancelError);
      return NextResponse.json(
        {
          error: 'subscription_cancel_failed',
          message: 'Impossible de résilier votre abonnement. Résiliez-le depuis Paramètres → Abonnement, puis réessayez.',
        },
        { status: 409 }
      );
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error('[api/account/delete] deleteUser failed', error);
    return NextResponse.json({ error: 'deletion_failed' }, { status: 500 });
  }

  if (email) {
    await sendAccountDeletion(email);
  }

  return NextResponse.json({ ok: true });
}
