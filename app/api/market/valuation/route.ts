// GET /api/market/valuation?symbol=SU.PA — onglet Valorisation d'une action
// (docs/specs/explorateur-marches-v2.md §4.3) : multiples dans le temps (médiane,
// plus haut, plus bas) et repères de valorisation.

import { NextRequest, NextResponse } from 'next/server';
import { freshness, guardMarketRequest } from '@/lib/market/route-guard';
import { getValuation } from '@/lib/market/services/valuation';

// Premier chargement d'une société américaine : comptes SEC (plusieurs Mo) à lire.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const guard = await guardMarketRequest(request);
  if (guard instanceof NextResponse) return guard;

  const entry = await getValuation(guard.symbol);
  if (!entry) return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });
  return NextResponse.json({ ...entry.data, ...freshness(entry) });
}
