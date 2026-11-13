// GET /api/market/similar?symbol=NVDA — bas de fiche : sociétés du même
// secteur d'activité (par capitalisation) et titres souvent consultés avec
// celui-ci. Symboles et noms seulement ; les cours sont demandés à part.

import { NextRequest, NextResponse } from 'next/server';
import { freshness, guardMarketRequest } from '@/lib/market/route-guard';
import { getSimilar } from '@/lib/market/services/similar';

export async function GET(request: NextRequest) {
  const guard = await guardMarketRequest(request);
  if (guard instanceof NextResponse) return guard;

  const entry = await getSimilar(guard.symbol);
  if (!entry) return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });
  return NextResponse.json({ ...entry.data, ...freshness(entry) });
}
