// GET /api/market/fundamentals?symbol=SU.PA — onglets Finances, Valorisation et
// Profil d'une action (docs/specs/explorateur-marches.md §12, v2 §4.2-4.4) :
// comptes consolidés sur 15 exercices au plus (comptes officiels SEC pour les
// sociétés américaines + fournisseur), ratios au cours actuel, consensus, profil.

import { NextRequest, NextResponse } from 'next/server';
import { guardMarketRequest } from '@/lib/market/route-guard';
import { dcfPlanFor, getFundamentalsBundle } from '@/lib/market/services/fundamentals';

// Premier chargement d'une société américaine : comptes SEC (plusieurs Mo) à lire.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const guard = await guardMarketRequest(request);
  if (guard instanceof NextResponse) return guard;

  const bundle = await getFundamentalsBundle(guard.symbol);
  if (!bundle) return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });
  if (!bundle.available) return NextResponse.json({ available: false });

  return NextResponse.json({
    available: true,
    currency: bundle.currency,
    priceCurrency: bundle.priceCurrency,
    priceInStatementCurrency: bundle.priceInStatementCurrency,
    fxRate: bundle.fxRate,
    annual: bundle.annualRows.slice(-5),
    ttm: bundle.statements.ttm,
    history: bundle.history,
    periods: bundle.periods,
    ratios: bundle.ratios,
    summary: bundle.summary,
    sources: bundle.sources,
    dcf: dcfPlanFor(bundle.ratios, bundle.summary),
    asOf: bundle.asOf,
    stale: bundle.stale,
  });
}
