import { createAdminClient } from '@/lib/supabase/server';
import { clientRegistrationSchema, generateSecret } from '@/lib/public-api/oauth';
import { corsPreflight, oauthError, oauthJson, rateLimitByIp } from '@/lib/public-api/oauth-server';

// RFC 7591 : enregistrement dynamique de client (utilisé par Claude, ChatGPT…).
export async function POST(request: Request) {
  const limited = await rateLimitByIp(request, 'oauth-register', 20, 3600);
  if (limited) return limited;

  const raw = await request.json().catch(() => null);
  const parsed = clientRegistrationSchema.safeParse(raw);
  if (!parsed.success) {
    const redirectIssue = parsed.error.issues.some((issue) => issue.path[0] === 'redirect_uris');
    return oauthError(
      redirectIssue ? 'invalid_redirect_uri' : 'invalid_client_metadata',
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    );
  }

  const registration = parsed.data;
  const secret = registration.token_endpoint_auth_method === 'none' ? null : generateSecret('fihs_');

  const db = await createAdminClient();
  const { data, error } = await db
    .from('oauth_clients')
    .insert({
      client_name: registration.client_name ?? 'Application',
      redirect_uris: registration.redirect_uris,
      client_secret_hash: secret?.hash ?? null,
      token_endpoint_auth_method: registration.token_endpoint_auth_method,
    })
    .select('id, client_name, redirect_uris, token_endpoint_auth_method, created_at')
    .single();

  if (error) {
    console.error('[oauth/register] insert failed', error);
    return oauthError('server_error', 'Enregistrement impossible', 500);
  }

  return oauthJson(
    {
      client_id: data.id,
      client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
      client_name: data.client_name,
      redirect_uris: data.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: data.token_endpoint_auth_method,
      scope: 'read',
      ...(secret ? { client_secret: secret.value, client_secret_expires_at: 0 } : {}),
    },
    201
  );
}

export const OPTIONS = corsPreflight;
