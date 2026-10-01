import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { clientKey } from '@/lib/rate-limit';
import {
  authorizationRequestSchema,
  buildRedirectUrl,
  type AuthorizationRequest,
  type OAuthErrorCode,
} from './oauth';

// Les endpoints OAuth/metadata sont appelés par des clients tiers, parfois
// depuis un navigateur : CORS ouvert (aucun cookie n'est utilisé).
export const OAUTH_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
};

export function oauthJson(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...OAUTH_CORS_HEADERS, 'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers },
  });
}

export function oauthError(error: OAuthErrorCode, description: string, status = 400): NextResponse {
  return oauthJson({ error, error_description: description }, status);
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { ...OAUTH_CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
}

/** Limite de débit partagée en base (public.api_rate_limit_hit), par IP. */
export async function rateLimitByIp(
  request: Request,
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const db = await createAdminClient();
  const { data, error } = await db
    .rpc('api_rate_limit_hit', {
      p_bucket: `${bucket}:${clientKey(request)}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    .single<{ allowed: boolean; retry_after: number }>();
  if (error) {
    // En cas de panne du compteur, on laisse passer plutôt que de bloquer l'auth.
    console.warn('[oauth] rate limit check failed', error.message);
    return null;
  }
  if (data.allowed) return null;
  return oauthJson(
    { error: 'slow_down', error_description: 'Trop de requêtes, réessayez plus tard.' },
    429,
    { 'Retry-After': String(data.retry_after) }
  );
}

/** Corps d'une requête OAuth : formulaire (standard) ou JSON. */
export async function readOAuthBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? '';
  const result: Record<string, string> = {};
  if (contentType.includes('application/json')) {
    const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    for (const [key, value] of Object.entries(json ?? {})) {
      if (typeof value === 'string') result[key] = value;
    }
    return result;
  }
  const form = new URLSearchParams(await request.text());
  form.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export interface OAuthClientRecord {
  id: string;
  client_name: string;
  redirect_uris: string[];
  client_secret_hash: string | null;
  token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic';
}

export async function findOAuthClient(clientId: string): Promise<OAuthClientRecord | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) return null;
  const db = await createAdminClient();
  const { data, error } = await db
    .from('oauth_clients')
    .select('id, client_name, redirect_uris, client_secret_hash, token_endpoint_auth_method')
    .eq('id', clientId)
    .maybeSingle<OAuthClientRecord>();
  if (error) {
    console.error('[oauth] client lookup failed', error);
    return null;
  }
  return data;
}

export type ResolvedAuthorization =
  | { kind: 'fatal'; message: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'ok'; request: AuthorizationRequest; client: OAuthClientRecord };

/**
 * Valide une demande d'autorisation. Tant que client_id et redirect_uri ne sont
 * pas vérifiés, on n'envoie jamais l'utilisateur vers l'URI fournie (erreur "fatal").
 */
export async function resolveAuthorizationRequest(params: Record<string, string>): Promise<ResolvedAuthorization> {
  const client = params.client_id ? await findOAuthClient(params.client_id) : null;
  if (!client) return { kind: 'fatal', message: "Application inconnue. Reconnectez-la depuis l'assistant." };
  if (!params.redirect_uri || !client.redirect_uris.includes(params.redirect_uri)) {
    return { kind: 'fatal', message: "Adresse de retour non autorisée pour cette application." };
  }

  const parsed = authorizationRequestSchema.safeParse(params);
  if (!parsed.success) {
    return {
      kind: 'redirect',
      url: buildRedirectUrl(params.redirect_uri, {
        error: 'invalid_request',
        error_description: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
        state: params.state,
      }),
    };
  }
  return { kind: 'ok', request: parsed.data, client };
}
