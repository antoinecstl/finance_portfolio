import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  extractBearerToken,
  hashApiToken,
  shouldTouchLastUsed,
  validateTokenRecord,
  type ApiTokenRecord,
} from './tokens';

// 60 requêtes / minute / jeton : large pour un assistant IA, limite les abus.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

export interface ApiAuthContext {
  userId: string;
  tokenId: string;
  scopes: string[];
}

export type ApiAuthResult = { ok: true; context: ApiAuthContext } | { ok: false; response: NextResponse };

// Les en-têtes HTTP doivent rester en ASCII : description anglaise dans
// WWW-Authenticate, message français dans le corps.
function unauthorized(error: string, message: string, headerDescription: string): NextResponse {
  return NextResponse.json(
    { error, message },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer realm="fi-hub", error="invalid_token", error_description="${headerDescription}"`,
      },
    }
  );
}

/**
 * Authentifie une requête de l'API publique par jeton personnel
 * (`Authorization: Bearer fih_...`). Aucune session cookie n'est utilisée :
 * toute lecture de données doit ensuite être filtrée par `context.userId`.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return {
      ok: false,
      response: unauthorized(
        'unauthorized',
        'Jeton manquant ou mal formé (Authorization: Bearer fih_...)',
        'Missing or malformed token'
      ),
    };
  }

  const db = await createAdminClient();
  const { data, error } = await db
    .from('api_tokens')
    .select('id, user_id, scopes, expires_at, revoked_at, last_used_at')
    .eq('token_hash', hashApiToken(token))
    .maybeSingle<ApiTokenRecord>();

  if (error) {
    console.error('[public-api/auth] token lookup failed', error);
    return { ok: false, response: NextResponse.json({ error: 'internal_error' }, { status: 500 }) };
  }

  const validation = validateTokenRecord(data);
  if (!validation.ok) {
    const messages = {
      not_found: ['Jeton inconnu', 'Unknown token'],
      revoked: ['Jeton révoqué', 'Token revoked'],
      expired: ['Jeton expiré', 'Token expired'],
    } as const;
    const [message, headerDescription] = messages[validation.reason];
    return { ok: false, response: unauthorized('invalid_token', message, headerDescription) };
  }

  const rl = rateLimit(`api-token:${validation.tokenId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'rate_limited', message: 'Trop de requêtes, réessayez dans un instant.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
      ),
    };
  }

  if (data && shouldTouchLastUsed(data.last_used_at)) {
    // Non bloquant : l'horodatage d'usage est indicatif.
    void db
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', validation.tokenId)
      .then(({ error: touchError }) => {
        if (touchError) console.warn('[public-api/auth] last_used_at update failed', touchError.message);
      });
  }

  return {
    ok: true,
    context: { userId: validation.userId, tokenId: validation.tokenId, scopes: validation.scopes },
  };
}
