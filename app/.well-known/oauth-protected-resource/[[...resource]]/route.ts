import { buildProtectedResourceMetadata } from '@/lib/public-api/oauth-metadata';
import { corsPreflight, oauthJson } from '@/lib/public-api/oauth-server';

// RFC 9728 : indique aux clients MCP quel serveur d'autorisation utiliser.
// Répond aussi sur /.well-known/oauth-protected-resource/api/mcp.
export function GET(request: Request) {
  return oauthJson(buildProtectedResourceMetadata(request), 200, { 'Cache-Control': 'public, max-age=3600' });
}

export const OPTIONS = corsPreflight;
