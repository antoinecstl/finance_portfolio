// GET /api/market/performance?symbol=CW8.PA — onglet Performance de la fiche
// (docs/specs/explorateur-marches-v2.md §4.1) : croissance annuelle moyenne,
// performance par année civile, saisonnalité, pertes depuis le plus haut.

import { NextRequest, NextResponse } from 'next/server';
import { freshness, guardMarketRequest } from '@/lib/market/route-guard';
import { getPerformance } from '@/lib/market/services/performance';

export async function GET(request: NextRequest) {
  const guard = await guardMarketRequest(request);
  if (guard instanceof NextResponse) return guard;

  const entry = await getPerformance(guard.symbol);
  if (!entry) return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });
  if (!entry.data.found) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ...entry.data, ...freshness(entry) });
}
