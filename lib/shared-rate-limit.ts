import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export type SharedRateLimitResult = { ok: boolean; retryAfterMs: number };

/**
 * Limite de débit partagée entre toutes les instances serverless (compteur en
 * base, public.api_rate_limit_hit, fenêtres fixes). À utiliser pour ce qui coûte
 * de l'argent (OCR, LLM) : le limiteur en mémoire de lib/rate-limit.ts repart de
 * zéro à chaque instance et se contourne en multipliant les requêtes parallèles.
 * Si le compteur en base est indisponible, on retombe sur le limiteur en mémoire.
 */
export async function sharedRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number
): Promise<SharedRateLimitResult> {
  try {
    const db = await createAdminClient();
    const { data, error } = await db
      .rpc('api_rate_limit_hit', { p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds })
      .single<{ allowed: boolean; retry_after: number }>();
    if (error) throw error;
    return { ok: data.allowed, retryAfterMs: data.allowed ? 0 : data.retry_after * 1000 };
  } catch (error) {
    console.warn('[rate-limit] shared counter unavailable, falling back to memory', error);
    const local = rateLimit(bucket, max, windowSeconds * 1000);
    return { ok: local.ok, retryAfterMs: local.ok ? 0 : local.resetMs };
  }
}
