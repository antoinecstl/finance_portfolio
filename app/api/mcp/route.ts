import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/public-api/auth';
import { getPublicPortfolio, getPublicProfile, listPublicTransactions } from '@/lib/public-api/data';
import { handleMcpMessage, JSON_RPC_ERRORS, type McpDataSource } from '@/lib/public-api/mcp';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 100_000;

function dataSourceFor(userId: string): McpDataSource {
  // Un même message (ou lot) ne recalcule le portefeuille qu'une fois.
  let portfolio: ReturnType<typeof getPublicPortfolio> | null = null;
  return {
    getProfile: () => getPublicProfile(userId),
    getPortfolio: () => (portfolio ??= getPublicPortfolio(userId)),
    listTransactions: (query) => listPublicTransactions(userId, query),
  };
}

// POST /api/mcp : serveur MCP (Streamable HTTP, sans état), authentifié par jeton personnel.
export async function POST(request: Request) {
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

  const data = dataSourceFor(auth.context.userId);
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
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } });
}

export const DELETE = GET;
