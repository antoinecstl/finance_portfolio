import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { formatZodError } from '@/lib/schemas';
import { authenticateApiRequest, type ApiAuthContext } from './auth';
import { PublicApiError } from './errors';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function apiJson(body: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(body, { status: init.status ?? 200, headers: NO_STORE });
}

/**
 * Enveloppe commune des routes /api/v1 : authentification par jeton,
 * traduction des erreurs de validation et d'accès aux données.
 */
export function withApiAuth(
  handler: (request: Request, context: ApiAuthContext) => Promise<unknown>
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    const auth = await authenticateApiRequest(request);
    if (!auth.ok) return auth.response;

    try {
      return apiJson(await handler(request, auth.context));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiJson(formatZodError(error), { status: 400 });
      }
      if (error instanceof PublicApiError) {
        const status = error.code === 'invalid_cursor' ? 400 : error.code === 'not_found' ? 404 : 500;
        return apiJson({ error: error.code, message: error.message }, { status });
      }
      console.error('[public-api] unexpected error', error);
      return apiJson({ error: 'internal_error' }, { status: 500 });
    }
  };
}
