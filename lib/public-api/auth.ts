import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { extractBearerToken } from './tokens';
import { protectedResourceMetadataUrl } from './oauth-metadata';

// 60 requêtes / minute / jeton, compteur partagé en base (toutes instances).
export const API_RATE_LIMIT = 60;
const API_RATE_WINDOW_SECONDS = 60;

export interface ApiAuthContext {
  // Jeton en clair de la requête : c'est lui (et non un user_id) qui est
  // transmis aux fonctions Postgres api_* pour lire les données.
  token: string;
  tokenId: string;
  scopes: string[];
}

export type ApiAuthResult = { ok: true; context: ApiAuthContext } | { ok: false; response: NextResponse };

type AuthenticateResult =
  | { status: 'ok'; token_id: string; scopes: string[] }
  | { status: 'rate_limited'; retry_after: number }
  | { status: 'not_found' | 'revoked' | 'expired' | 'plan_required' };

// Les en-têtes HTTP doivent rester en ASCII : description anglaise dans
// WWW-Authenticate, message français dans le corps.
function unauthorized(request: Request, error: string, message: string, headerDescription: string): NextResponse {
  return NextResponse.json(
    { error, message },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': [
          'Bearer realm="fi-hub"',
          `resource_metadata="${protectedResourceMetadataUrl(request)}"`,
          ...(error === 'invalid_token' ? [`error="invalid_token", error_description="${headerDescription}"`] : []),
        ].join(', '),
      },
    }
  );
}

/**
 * Authentifie une requête de l'API publique par jeton (`Authorization: Bearer fih_...`),
 * personnel ou issu d'OAuth. Validité, offre Pro et limite de débit sont vérifiées
 * dans Postgres (public.api_authenticate).
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return {
      ok: false,
      response: unauthorized(
        request,
        'unauthorized',
        'Jeton manquant ou mal formé (Authorization: Bearer fih_...)',
        'Missing or malformed token'
      ),
    };
  }

  const db = await createAdminClient();
  const { data, error } = await db.rpc('api_authenticate', {
    p_token: token,
    p_rate_limit: API_RATE_LIMIT,
    p_rate_window_seconds: API_RATE_WINDOW_SECONDS,
  });

  if (error || !data) {
    console.error('[public-api/auth] api_authenticate failed', error);
    return { ok: false, response: NextResponse.json({ error: 'internal_error' }, { status: 500 }) };
  }

  const result = data as AuthenticateResult;
  switch (result.status) {
    case 'ok':
      return { ok: true, context: { token, tokenId: result.token_id, scopes: result.scopes } };
    case 'rate_limited':
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'rate_limited', message: 'Trop de requêtes, réessayez dans un instant.' },
          { status: 429, headers: { 'Retry-After': String(result.retry_after) } }
        ),
      };
    case 'plan_required':
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'pro_required',
            message: "L'accès API est réservé à l'offre Pro. Passez Pro sur fi-hub.subleet.com/settings/billing.",
          },
          { status: 402 }
        ),
      };
    default: {
      const messages = {
        not_found: ['Jeton inconnu', 'Unknown token'],
        revoked: ['Jeton révoqué', 'Token revoked'],
        expired: ['Jeton expiré', 'Token expired'],
      } as const;
      const [message, headerDescription] = messages[result.status];
      return { ok: false, response: unauthorized(request, 'invalid_token', message, headerDescription) };
    }
  }
}
