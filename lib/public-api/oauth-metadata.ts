// URLs et métadonnées OAuth 2.1 / MCP (RFC 8414, RFC 9728).

export const OAUTH_SCOPES = ['read'] as const;

/** Origine publique de l'application (NEXT_PUBLIC_APP_URL en production). */
export function appOrigin(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  return request ? new URL(request.url).origin : 'https://fi-hub.subleet.com';
}

export function mcpResourceUrl(request?: Request): string {
  return `${appOrigin(request)}/api/mcp`;
}

export function protectedResourceMetadataUrl(request?: Request): string {
  return `${appOrigin(request)}/.well-known/oauth-protected-resource`;
}

export function buildProtectedResourceMetadata(request?: Request) {
  const origin = appOrigin(request);
  return {
    resource: mcpResourceUrl(request),
    authorization_servers: [origin],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Fi-Hub',
    resource_documentation: `${origin}/settings/api`,
  };
}

export function buildAuthorizationServerMetadata(request?: Request) {
  const origin = appOrigin(request);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [...OAUTH_SCOPES],
    service_documentation: `${origin}/settings/api`,
  };
}
