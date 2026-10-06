import { NextResponse } from 'next/server';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { createClient } from '@/lib/supabase/server';
import { sendWelcome } from '@/lib/email';

export const runtime = 'nodejs';

// Tunnel d'onboarding en deux appels :
// - step 'profile'  : nom, préférence email et acceptation des CGU, au début
//   du tunnel. L'utilisateur reste dans le tunnel (onboarded_at vide) pour
//   créer son premier compte et sa première opération.
// - step 'complete' (défaut) : fin du tunnel, onboarded_at renseigné, l'app
//   s'ouvre. Sans step, l'ancien appel unique reste accepté.
export async function POST(request: Request) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    step?: 'profile' | 'complete';
    fullName?: string;
    marketingOptIn?: boolean;
  };
  const step = body.step === 'profile' ? 'profile' : 'complete';

  const { data: current, error: currentError } = await supabase
    .from('profiles')
    .select('onboarded_at, terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle();

  if (currentError) {
    console.error('[api/account/onboard] fetch profile failed', currentError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  // Le mail de bienvenue part une seule fois, au premier enregistrement.
  const firstVisit = !current?.onboarded_at && !current?.terms_accepted_at;
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    id: user.id,
    terms_accepted_at: current?.terms_accepted_at ?? now,
  };
  if (step === 'complete') update.onboarded_at = current?.onboarded_at ?? now;
  if (step === 'profile' || body.fullName !== undefined) update.full_name = body.fullName?.trim() || null;
  if (step === 'profile' || body.marketingOptIn !== undefined) update.marketing_opt_in = Boolean(body.marketingOptIn);

  const { error } = await supabase.from('profiles').upsert(update, { onConflict: 'id' });

  if (error) {
    console.error('[api/account/onboard] upsert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  if (firstVisit && user.email) {
    await sendWelcome(user.email);
  }

  return NextResponse.json({ ok: true, step });
}
