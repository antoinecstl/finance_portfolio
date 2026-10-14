import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { stockLookupSymbolSchema } from '@/lib/schemas';

/**
 * Contrôles communs des routes /api/market/* : session, 60 requêtes par minute
 * et par utilisateur (compteur partagé avec la v1), symbole valide.
 */
export async function guardMarketRequest(request: NextRequest): Promise<{ symbol: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = rateLimit(`market:${clientKey(request, user.id)}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
    );
  }

  const symbol = stockLookupSymbolSchema.safeParse(request.nextUrl.searchParams.get('symbol') ?? '');
  if (!symbol.success) return NextResponse.json({ error: 'invalid_symbol' }, { status: 400 });
  return { symbol: symbol.data };
}

/** Fraîcheur des données servies : date de récupération et copie de secours. */
export function freshness(entry: { fetchedAt: number; stale: boolean }) {
  return { asOf: new Date(entry.fetchedAt).toISOString(), stale: entry.stale };
}
