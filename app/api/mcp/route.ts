import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/public-api/auth';
import { getPublicPortfolio, getPublicProfile, listPublicTransactions } from '@/lib/public-api/data';
import { handleMcpMessage, JSON_RPC_ERRORS, type McpDataSource } from '@/lib/public-api/mcp';
import { OAUTH_CORS_HEADERS } from '@/lib/public-api/oauth-server';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 100_000;

function dataSourceFor(token: string): McpDataSource {
  // Un même message (ou lot) ne recalcule le portefeuille qu'une fois.
  let portfolio: ReturnType<typeof getPublicPortfolio> | null = null;
  return {
    getProfile: () => getPublicProfile(token),
    getPortfolio: () => (portfolio ??= getPublicPortfolio(token)),
    listTransactions: (query) => listPublicTransactions(token, query),
  };
}

// Clients MCP exécutés dans un navigateur (ex. MCP Inspector) : CORS ouvert,
// sans cookie, et WWW-Authenticate lisible pour découvrir OAuth.
function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(OAUTH_CORS_HEADERS)) response.headers.set(key, value);
  response.headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
  return response;
}

// POST /api/mcp : serveur MCP (Streamable HTTP, sans état), authentifié par jeton
// personnel ou OAuth.
export async function POST(request: Request) {
  return withCors(await handlePost(request));
}

async function handlePost(request: Request): Promise<NextResponse> {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: JSON_RPC_ERRORS.parseError, message: 'JSON invalide' } },
      { status: 400 }
    );
  }

  const data = dataSourceFor(auth.context.token);
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const message of messages) {
    const response = await handleMcpMessage(message, data);
    if (response) responses.push(response);
  }

  // Uniquement des notifications : accusé de réception sans corps.
  if (responses.length === 0) return new NextResponse(null, { status: 202 });

  return NextResponse.json(Array.isArray(body) ? responses : responses[0], {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// Pas de flux SSE serveur → client ni de session à clôturer.
export function GET() {
  return withCors(NextResponse.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } }));
}

export const DELETE = GET;

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
