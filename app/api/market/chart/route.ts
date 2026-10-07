// GET /api/market/chart?symbol=CW8.PA&period=1A — graphique de l'explorateur
// de marchés (docs/specs/explorateur-marches.md §7). L'historique renvoyé
// déborde la période (préchauffage des moyennes mobiles) : `displayFrom`
// indique le premier point à afficher.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { stockLookupSymbolSchema } from '@/lib/schemas';
import { getMarketChart } from '@/lib/stock-api';
import { cacheSecondsFor, displayStart, getChartPeriod, isChartPeriod } from '@/lib/market/periods';

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

  const params = request.nextUrl.searchParams;
  const symbol = stockLookupSymbolSchema.safeParse(params.get('symbol') ?? '');
  if (!symbol.success) return NextResponse.json({ error: 'invalid_symbol' }, { status: 400 });
  const periodParam = params.get('period') ?? '1A';
  if (!isChartPeriod(periodParam)) return NextResponse.json({ error: 'invalid_period' }, { status: 400 });
  const period = getChartPeriod(periodParam);

  const result = await getMarketChart(symbol.data, {
    range: period.range,
    interval: period.interval,
    revalidate: cacheSecondsFor(period.interval),
  });
  if (result.status === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (result.status === 'error') return NextResponse.json({ error: 'provider_unavailable' }, { status: 502 });

  const { meta, points } = result.chart;
  return NextResponse.json({
    symbol: meta.symbol,
    period: period.id,
    interval: period.interval,
    intraday: period.intraday,
    currency: meta.currency,
    timezone: meta.timezone,
    displayFrom: points.length > 0 ? displayStart(period.id, points[0].t) : null,
    points,
  });
}
