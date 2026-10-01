import { createAdminClient } from '@/lib/supabase/server';
import { generateApiToken, hashApiToken } from '@/lib/public-api/tokens';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  generateSecret,
  readClientCredentials,
  secretsMatch,
  verifyPkceS256,
} from '@/lib/public-api/oauth';
import {
  corsPreflight,
  findOAuthClient,
  oauthError,
  oauthJson,
  rateLimitByIp,
  readOAuthBody,
  type OAuthClientRecord,
} from '@/lib/public-api/oauth-server';

function expiryDates() {
  const now = Date.now();
  return {
    expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_DAYS * 86_400_000).toISOString(),
  };
}

function tokenResponse(accessToken: string, refreshToken: string) {
  return oauthJson({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: 'read',
  });
}

/** Authentifie le client : secret obligatoire s'il en a un, sinon client public. */
async function authenticateClient(
  request: Request,
  body: Record<string, string>
): Promise<OAuthClientRecord | null> {
  const { clientId, clientSecret } = readClientCredentials(request.headers.get('authorization'), body);
  if (!clientId) return null;
  const client = await findOAuthClient(clientId);
  if (!client) return null;
  if (client.client_secret_hash) {
    if (!clientSecret || !secretsMatch(clientSecret, client.client_secret_hash)) return null;
  }
  return client;
}

async function exchangeAuthorizationCode(body: Record<string, string>, client: OAuthClientRecord) {
  const { code, redirect_uri: redirectUri, code_verifier: codeVerifier } = body;
  if (!code || !redirectUri || !codeVerifier) {
    return oauthError('invalid_request', 'code, redirect_uri et code_verifier sont requis');
  }

  const db = await createAdminClient();
  // Consommation atomique : un code ne sert qu'une fois, même en cas de requêtes concurrentes.
  const { data: grant, error } = await db
    .from('oauth_authorization_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code_hash', hashApiToken(code))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('client_id, user_id, redirect_uri, code_challenge, scopes')
    .maybeSingle();

  if (error) {
    console.error('[oauth/token] code lookup failed', error);
    return oauthError('server_error', 'Erreur interne', 500);
  }
  if (!grant || grant.client_id !== client.id || grant.redirect_uri !== redirectUri) {
    return oauthError('invalid_grant', "Code d'autorisation invalide, expiré ou déjà utilisé");
  }
  if (!verifyPkceS256(codeVerifier, grant.code_challenge)) {
    return oauthError('invalid_grant', 'code_verifier invalide');
  }

  const access = generateApiToken();
  const refresh = generateSecret('fihr_');
  const { error: insertError } = await db.from('api_tokens').insert({
    user_id: grant.user_id,
    name: client.client_name,
    kind: 'oauth',
    client_id: client.id,
    token_prefix: access.tokenPrefix,
    token_hash: access.tokenHash,
    refresh_token_hash: refresh.hash,
    scopes: grant.scopes,
    ...expiryDates(),
  });
  if (insertError) {
    console.error('[oauth/token] token insert failed', insertError);
    return oauthError('server_error', 'Erreur interne', 500);
  }

  // Purge non bloquante des codes expirés depuis plus d'un jour.
  void db
    .from('oauth_authorization_codes')
    .delete()
    .lt('expires_at', new Date(Date.now() - 86_400_000).toISOString())
    .then(({ error: purgeError }) => {
      if (purgeError) console.warn('[oauth/token] code purge failed', purgeError.message);
    });

  return tokenResponse(access.token, refresh.value);
}

async function refreshAccessToken(body: Record<string, string>, client: OAuthClientRecord) {
  if (!body.refresh_token) return oauthError('invalid_request', 'refresh_token est requis');

  const access = generateApiToken();
  const refresh = generateSecret('fihr_');
  const db = await createAdminClient();
  // Rotation atomique : l'ancien refresh token devient inutilisable.
  const { data, error } = await db
    .from('api_tokens')
    .update({
      token_hash: access.tokenHash,
      token_prefix: access.tokenPrefix,
      refresh_token_hash: refresh.hash,
      ...expiryDates(),
    })
    .eq('refresh_token_hash', hashApiToken(body.refresh_token))
    .eq('client_id', client.id)
    .eq('kind', 'oauth')
    .is('revoked_at', null)
    .gt('refresh_expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[oauth/token] refresh failed', error);
    return oauthError('server_error', 'Erreur interne', 500);
  }
  if (!data) return oauthError('invalid_grant', 'Refresh token invalide, expiré ou révoqué');

  return tokenResponse(access.token, refresh.value);
}

// RFC 6749 / OAuth 2.1 : échange de code (PKCE S256 obligatoire) et rafraîchissement.
export async function POST(request: Request) {
  const limited = await rateLimitByIp(request, 'oauth-token', 60, 60);
  if (limited) return limited;

  const body = await readOAuthBody(request);
  const client = await authenticateClient(request, body);
  if (!client) return oauthError('invalid_client', 'Client inconnu ou authentification invalide', 401);

  switch (body.grant_type) {
    case 'authorization_code':
      return exchangeAuthorizationCode(body, client);
    case 'refresh_token':
      return refreshAccessToken(body, client);
    default:
      return oauthError('unsupported_grant_type', 'grant_type doit valoir authorization_code ou refresh_token');
  }
}

export const OPTIONS = corsPreflight;
