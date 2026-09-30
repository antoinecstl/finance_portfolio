import { NextResponse } from 'next/server';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { hasUserFeature } from '@/lib/subscription';
import { appOrigin } from '@/lib/public-api/oauth-metadata';
import { AUTHORIZATION_CODE_TTL_SECONDS, buildRedirectUrl, generateSecret } from '@/lib/public-api/oauth';
import { resolveAuthorizationRequest } from '@/lib/public-api/oauth-server';

// Décision de l'utilisateur sur l'écran de consentement (/oauth/authorize).
// Renvoie l'URL de retour vers le client ; la navigation se fait côté navigateur.
export async function POST(request: Request) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (typeof value === 'string') params[key] = value;
  }

  const resolved = await resolveAuthorizationRequest(params);
  if (resolved.kind === 'fatal') return NextResponse.json({ error: 'invalid_request', message: resolved.message }, { status: 400 });
  if (resolved.kind === 'redirect') return NextResponse.json({ redirect_to: resolved.url });

  const { request: authRequest, client } = resolved;
  const issuer = appOrigin(request);

  if (params.decision !== 'allow' || !(await hasUserFeature(user.id, 'api_access'))) {
    return NextResponse.json({
      redirect_to: buildRedirectUrl(authRequest.redirect_uri, {
        error: 'access_denied',
        error_description: params.decision === 'allow' ? "L'accès API est réservé à l'offre Pro" : "L'utilisateur a refusé l'accès",
        state: authRequest.state,
        iss: issuer,
      }),
    });
  }

  const code = generateSecret('fihc_');
  const db = await createAdminClient();
  const { error } = await db.from('oauth_authorization_codes').insert({
    code_hash: code.hash,
    client_id: client.id,
    user_id: user.id,
    redirect_uri: authRequest.redirect_uri,
    code_challenge: authRequest.code_challenge,
    scopes: ['read'],
    resource: authRequest.resource ?? null,
    expires_at: new Date(Date.now() + AUTHORIZATION_CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) {
    console.error('[oauth/authorize] code insert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({
    redirect_to: buildRedirectUrl(authRequest.redirect_uri, { code: code.value, state: authRequest.state, iss: issuer }),
  });
}
