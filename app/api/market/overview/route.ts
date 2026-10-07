// GET /api/market/overview?symbol=CW8.PA — fiche valeur de l'explorateur de
// marchés, hors graphique : identité, séance, statistiques et dividendes
// (docs/specs/explorateur-marches.md §6-7).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { stockLookupSymbolSchema } from '@/lib/schemas';
import { getMarketChart, getStockQuote } from '@/lib/stock-api';
import {
  annualizedVolatility,
  averageVolume,
  dividendsByYear,
  maxDrawdown,
  performanceByPeriod,
  trailingDividendYield,
} from '@/lib/market/analytics';

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

  // Cinq ans de clôtures quotidiennes (statistiques) + la séance du jour.
  const [history, quote] = await Promise.all([
    getMarketChart(symbol.data, { range: '5y', interval: '1d', events: true, revalidate: 3600 }),
    getStockQuote(symbol.data),
  ]);
  if (history.status === 'not_found' && !quote) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (history.status !== 'ok') return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });

  const { meta, points, dividends, splits } = history.chart;
  const now = new Date();
  const price = quote?.price ?? meta.regularMarketPrice ?? points[points.length - 1]?.c ?? 0;
  const isCrypto = meta.instrumentType === 'CRYPTOCURRENCY';

  return NextResponse.json({
    symbol: meta.symbol,
    name: meta.name || quote?.name || meta.symbol,
    exchange: meta.exchange,
    currency: meta.currency || quote?.currency || '',
    instrumentType: meta.instrumentType,
    timezone: meta.timezone,
    price,
    change: quote?.change ?? null,
    changePercent: quote?.changePercent ?? null,
    previousClose: quote?.previousClose ?? null,
    dayHigh: quote?.high || meta.dayHigh,
    dayLow: quote?.low || meta.dayLow,
    volume: quote?.volume || meta.volume,
    regularMarketStart: quote?.regularMarketStart ?? meta.regularMarketStart,
    regularMarketEnd: quote?.regularMarketEnd ?? meta.regularMarketEnd,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    averageVolume3M: averageVolume(points, now),
    performance: performanceByPeriod(points, price, now),
    volatility1Y: annualizedVolatility(points, now, isCrypto ? 365 : 252),
    maxDrawdown1Y: maxDrawdown(points, now),
    dividends: dividends.slice(-12).reverse(),
    dividendsByYear: dividendsByYear(dividends, now),
    trailingYield: trailingDividendYield(dividends, price, now),
    splits,
  });
}
