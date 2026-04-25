const DEFAULT_INTERNAL_REDIRECT = '/dashboard';
const SAFE_ORIGIN = 'https://fi-hub.local';

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_INTERNAL_REDIRECT
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, SAFE_ORIGIN);
    if (parsed.origin !== SAFE_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

