import { NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/public-api/openapi';

// Spécification publique (sans données) : importable dans ChatGPT > GPT > Actions.
export function GET(request: Request) {
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json(buildOpenApiSpec(serverUrl), {
    headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
  });
}
