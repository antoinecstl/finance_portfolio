import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  authorizationRequestSchema,
  buildRedirectUrl,
  clientRegistrationSchema,
  generateSecret,
  isAllowedRedirectUri,
  readClientCredentials,
  secretsMatch,
  verifyPkceS256,
} from './oauth';
import { buildAuthorizationServerMetadata, buildProtectedResourceMetadata } from './oauth-metadata';

const verifier = 'a'.repeat(20) + 'B-._~' + '9'.repeat(30);
const challenge = createHash('sha256').update(verifier).digest('base64url');

describe('PKCE S256', () => {
  it('accepts the matching verifier only', () => {
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256(verifier.replace('B', 'C'), challenge)).toBe(false);
    expect(verifyPkceS256('too-short', challenge)).toBe(false);
  });
});

describe('redirect URIs', () => {
  it('allows https and loopback http only', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:6274/oauth/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:33418/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://evil.example/callback')).toBe(false);
    expect(isAllowedRedirectUri('https://claude.ai/cb#fragment')).toBe(false);
    expect(isAllowedRedirectUri('https://user:pass@claude.ai/cb')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
  });

  it('keeps the client query string when adding parameters', () => {
    expect(buildRedirectUrl('https://app.example/cb?x=1', { code: 'abc', state: 'st', iss: undefined })).toBe(
      'https://app.example/cb?x=1&code=abc&state=st'
    );
  });
});

describe('client registration', () => {
  it('defaults to a public client', () => {
    const parsed = clientRegistrationSchema.parse({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude' });
    expect(parsed.token_endpoint_auth_method).toBe('none');
  });

  it('rejects unsupported grants and insecure redirects', () => {
    expect(clientRegistrationSchema.safeParse({ redirect_uris: ['https://a.b/cb'], grant_types: ['client_credentials'] }).success).toBe(false);
    expect(clientRegistrationSchema.safeParse({ redirect_uris: ['http://a.b/cb'] }).success).toBe(false);
    expect(clientRegistrationSchema.safeParse({ redirect_uris: [] }).success).toBe(false);
  });
});

describe('authorization request', () => {
  const base = {
    response_type: 'code',
    client_id: '11111111-1111-4111-8111-111111111111',
    redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
  };

  it('accepts a valid PKCE request', () => {
    expect(authorizationRequestSchema.safeParse({ ...base, scope: 'read', resource: 'https://fi-hub.subleet.com/api/mcp' }).success).toBe(true);
  });

  it('requires S256 and the read scope', () => {
    expect(authorizationRequestSchema.safeParse({ ...base, code_challenge_method: 'plain' }).success).toBe(false);
    expect(authorizationRequestSchema.safeParse({ ...base, scope: 'write' }).success).toBe(false);
    expect(authorizationRequestSchema.safeParse({ ...base, response_type: 'token' }).success).toBe(false);
  });
});

describe('client credentials', () => {
  it('reads Basic auth and form credentials', () => {
    const basic = `Basic ${Buffer.from('client-1:s3cr%3At').toString('base64')}`;
    expect(readClientCredentials(basic, {})).toEqual({ clientId: 'client-1', clientSecret: 's3cr:t' });
    expect(readClientCredentials(null, { client_id: 'c', client_secret: 's' })).toEqual({ clientId: 'c', clientSecret: 's' });
    expect(readClientCredentials(null, { client_id: 'c' })).toEqual({ clientId: 'c', clientSecret: null });
  });

  it('matches secrets against their stored hash', () => {
    const secret = generateSecret('fihs_');
    expect(secretsMatch(secret.value, secret.hash)).toBe(true);
    expect(secretsMatch('fihs_other', secret.hash)).toBe(false);
  });
});

describe('metadata', () => {
  it('points the MCP resource to this authorization server', () => {
    const request = new Request('https://fi-hub.subleet.com/.well-known/oauth-protected-resource');
    const resource = buildProtectedResourceMetadata(request);
    const server = buildAuthorizationServerMetadata(request);
    expect(resource.resource).toMatch(/\/api\/mcp$/);
    expect(resource.authorization_servers).toEqual([server.issuer]);
    expect(server.code_challenge_methods_supported).toEqual(['S256']);
    expect(server.registration_endpoint).toMatch(/\/api\/oauth\/register$/);
  });
});
