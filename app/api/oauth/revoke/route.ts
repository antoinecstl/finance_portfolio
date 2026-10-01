import { createAdminClient } from '@/lib/supabase/server';
import { hashApiToken } from '@/lib/public-api/tokens';
import { corsPreflight, findOAuthClient, oauthJson, readOAuthBody } from '@/lib/public-api/oauth-server';
import { readClientCredentials, secretsMatch } from '@/lib/public-api/oauth';

// RFC 7009 : révocation d'un access ou refresh token par le client qui l'a obtenu.
// Répond 200 même si le jeton est inconnu (pas d'oracle).
export async function POST(request: Request) {
  const body = await readOAuthBody(request);
  const { clientId, clientSecret } = readClientCredentials(request.headers.get('authorization'), body);
  const client = clientId ? await findOAuthClient(clientId) : null;
  if (!client || (client.client_secret_hash && (!clientSecret || !secretsMatch(clientSecret, client.client_secret_hash)))) {
    return oauthJson({ error: 'invalid_client', error_description: 'Client inconnu' }, 401);
  }
  if (!body.token) return oauthJson({});

  const hash = hashApiToken(body.token);
  const db = await createAdminClient();
  const { error } = await db
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('client_id', client.id)
    .is('revoked_at', null)
    .or(`token_hash.eq.${hash},refresh_token_hash.eq.${hash}`);
  if (error) console.error('[oauth/revoke] failed', error);

  return oauthJson({});
}

export const OPTIONS = corsPreflight;
