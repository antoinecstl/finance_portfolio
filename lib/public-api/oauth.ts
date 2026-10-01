import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { hashApiToken } from './tokens';

// Logique OAuth 2.1 (sans accès base) : validation des requêtes, PKCE,
// génération des secrets. Utilisée par /oauth/authorize et /api/oauth/*.

export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_DAYS = 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 600;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * URI de redirection acceptable : https, ou http sur une adresse locale
 * (clients natifs / CLI). Jamais de fragment ni d'identifiants.
 */
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

const redirectUriSchema = z
  .string()
  .max(2000)
  .refine(isAllowedRedirectUri, 'redirect_uri doit être en https (ou http://localhost)');

export const clientRegistrationSchema = z.object({
  redirect_uris: z.array(redirectUriSchema).min(1).max(10),
  client_name: z.string().trim().min(1).max(100).optional(),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post', 'client_secret_basic']).default('none'),
  grant_types: z
    .array(z.string())
    .optional()
    .refine((types) => !types || types.includes('authorization_code'), 'grant_types doit inclure authorization_code')
    .refine(
      (types) => !types || types.every((type) => type === 'authorization_code' || type === 'refresh_token'),
      'grant_types non pris en charge'
    ),
  response_types: z
    .array(z.string())
    .optional()
    .refine((types) => !types || types.every((type) => type === 'code'), 'response_types doit valoir ["code"]'),
});

export type ClientRegistration = z.infer<typeof clientRegistrationSchema>;

// code_verifier / code_challenge : base64url, 43 à 128 caractères (RFC 7636).
const pkceValue = z.string().regex(/^[A-Za-z0-9\-._~]{43,128}$/);

export const authorizationRequestSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.uuid(),
  redirect_uri: redirectUriSchema,
  code_challenge: pkceValue,
  code_challenge_method: z.literal('S256'),
  state: z.string().max(1000).optional(),
  scope: z
    .string()
    .optional()
    .refine((scope) => !scope || scope.split(' ').every((s) => s === '' || s === 'read'), 'Seul le scope "read" est disponible'),
  resource: z.url().max(2000).optional(),
});

export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!pkceValue.safeParse(codeVerifier).success) return false;
  const computed = createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function secretsMatch(secret: string, expectedHash: string): boolean {
  const a = Buffer.from(hashApiToken(secret), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Secret opaque préfixé (code d'autorisation, refresh token, secret client). */
export function generateSecret(prefix: 'fihc_' | 'fihr_' | 'fihs_'): { value: string; hash: string } {
  const value = `${prefix}${randomBytes(32).toString('base64url')}`;
  return { value, hash: hashApiToken(value) };
}

/** Ajoute des paramètres à l'URI de redirection du client (en conservant sa query). */
export function buildRedirectUrl(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Identifiants client depuis l'en-tête Basic ou le corps (client_secret_post). */
export function readClientCredentials(
  authorization: string | null,
  body: Record<string, string>
): { clientId: string | null; clientSecret: string | null } {
  const basic = authorization && /^Basic\s+(.+)$/i.exec(authorization);
  if (basic) {
    try {
      const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        };
      }
    } catch {
      /* en-tête illisible : traité comme absent */
    }
  }
  return { clientId: body.client_id ?? null, clientSecret: body.client_secret ?? null };
}

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'slow_down';
