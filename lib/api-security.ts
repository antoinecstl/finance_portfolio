import { NextResponse } from 'next/server';

const MAX_JSON_BODY_BYTES = 1_000_000;

function requestOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (origin) return origin;

  const referer = request.headers.get('referer');
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * Reject cross-site state-changing requests before cookie-backed auth is used.
 * Browser POST/PATCH/DELETE requests include an Origin header; Referer is kept
 * as a fallback for older clients. Webhooks are intentionally not covered.
 */
export function enforceSameOrigin(request: Request): NextResponse | null {
  const expectedOrigin = new URL(request.url).origin;
  const actualOrigin = requestOrigin(request);

  if (!actualOrigin || actualOrigin !== expectedOrigin) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  }

  return null;
}

export function enforceJsonRequest(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES
): NextResponse | null {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 });
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const bytes = Number(contentLength);
    if (!Number.isFinite(bytes) || bytes > maxBytes) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    }
  }

  return null;
}

export function enforceAuthenticatedMutation(request: Request): NextResponse | null {
  return enforceSameOrigin(request);
}

export function enforceAuthenticatedJsonMutation(request: Request): NextResponse | null {
  return enforceSameOrigin(request) ?? enforceJsonRequest(request);
}
