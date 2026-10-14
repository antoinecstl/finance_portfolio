// GET /api/market/details?symbol=CW8.PA — onglets Composition (ETF) et Marché
// (crypto) de la fiche (docs/specs/explorateur-marches-v2.md §4.5-4.6).

import { NextRequest, NextResponse } from 'next/server';
import { freshness, guardMarketRequest } from '@/lib/market/route-guard';
import { getDetails } from '@/lib/market/services/details';

export async function GET(request: NextRequest) {
  const guard = await guardMarketRequest(request);
  if (guard instanceof NextResponse) return guard;

  const entry = await getDetails(guard.symbol);
  if (!entry) return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });
  if (!entry.data.found) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ...entry.data, ...freshness(entry) });
}
