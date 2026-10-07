// GET /api/market/news?symbol=SU.PA&q=Schneider%20Electric — derniers articles
// (titre, média, date, lien) de la presse française et internationale.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { stockLookupSymbolSchema } from '@/lib/schemas';
import { getProviderNews } from '@/lib/stock-api';
import { getFrenchNews } from '@/lib/news-feed';
import { mergeNews, newsQuery } from '@/lib/market/news';

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

  // Nom de la société tel qu'affiché par la fiche (texte libre, borné).
  const name = (request.nextUrl.searchParams.get('q') ?? '').replace(/[\u0000-\u001f"]/g, ' ').slice(0, 100);
  const query = newsQuery(name, symbol.data);

  const [provider, french] = await Promise.all([getProviderNews(symbol.data), getFrenchNews(query)]);
  return NextResponse.json({ query, items: mergeNews([french, provider], 12) });
}
