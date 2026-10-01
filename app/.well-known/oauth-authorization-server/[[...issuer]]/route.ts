import { buildAuthorizationServerMetadata } from '@/lib/public-api/oauth-metadata';
import { corsPreflight, oauthJson } from '@/lib/public-api/oauth-server';

// RFC 8414 : métadonnées du serveur d'autorisation OAuth 2.1 de Fi-Hub.
export function GET(request: Request) {
  return oauthJson(buildAuthorizationServerMetadata(request), 200, { 'Cache-Control': 'public, max-age=3600' });
}

export const OPTIONS = corsPreflight;
