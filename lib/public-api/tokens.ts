import { createHash, randomBytes } from 'node:crypto';

// Format : "fih_" + 43 caractères base64url (32 octets aléatoires).
export const API_TOKEN_PREFIX = 'fih_';
const TOKEN_PATTERN = /^fih_[A-Za-z0-9_-]{43}$/;
const DISPLAY_PREFIX_LENGTH = 10;

export const MAX_ACTIVE_TOKENS_PER_USER = 10;
export const API_TOKEN_SCOPES = ['read'] as const;
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export interface GeneratedApiToken {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateApiToken(): GeneratedApiToken {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    token,
    tokenHash: hashApiToken(token),
    tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

export function isWellFormedApiToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer fih_...`. */
export function extractBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  if (!match) return null;
  return isWellFormedApiToken(match[1]) ? match[1] : null;
}
