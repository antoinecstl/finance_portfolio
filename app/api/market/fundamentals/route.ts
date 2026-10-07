// GET /api/market/fundamentals?symbol=SU.PA — comptes, ratios de valorisation
// calculés par Fi-Hub, consensus des analystes et profil de la société
// (docs/specs/explorateur-marches.md §12). Actions uniquement.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { stockLookupSymbolSchema } from '@/lib/schemas';
import { getFundamentalsSeries, getQuoteSummary, getStockQuote } from '@/lib/stock-api';
import { buildStatements, computeRatios, defaultDcfGrowth, majorCurrency } from '@/lib/market/fundamentals';

export async function GET(request: NextRequest) {
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

  const [series, summary, quote] = await Promise.all([
    getFundamentalsSeries(symbol.data),
    getQuoteSummary(symbol.data),
    getStockQuote(symbol.data),
  ]);
  if (series === null && summary === null) return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });

  const statements = buildStatements(series ?? {});
  if (statements.annual.length === 0 && !statements.ttm && !summary) {
    return NextResponse.json({ available: false });
  }

  // Les ratios se calculent dans la devise des comptes : le cours y est converti
  // si la cotation se fait dans une autre devise (ou en centimes, ex. GBp).
  const priceCurrency = quote?.currency ?? '';
  const major = majorCurrency(priceCurrency || statements.currency || '');
  const currency = statements.currency ?? major.currency;
  let fxRate: number | null = 1;
  if (quote && major.currency && currency && major.currency !== currency) {
    const fx = await getStockQuote(`${major.currency}${currency}=X`);
    fxRate = fx?.price && fx.price > 0 ? fx.price : null;
  }
  const price = quote && fxRate !== null ? (quote.price / major.divisor) * fxRate : 0;
  const ratios = computeRatios(statements, price);

  return NextResponse.json({
    available: true,
    currency,
    priceCurrency,
    priceInStatementCurrency: price > 0 ? price : null,
    fxRate: fxRate !== 1 ? fxRate : null,
    annual: statements.annual,
    ttm: statements.ttm,
    ratios,
    summary,
    dcfDefaults: { growth: defaultDcfGrowth(ratios), discountRate: 0.09, terminalGrowth: 0.02 },
  });
}
