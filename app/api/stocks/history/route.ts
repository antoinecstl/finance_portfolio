import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalQuotes, getMultipleHistoricalQuotes } from '@/lib/stock-api';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = rateLimit(clientKey(request, user.id), 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const interval = (searchParams.get('interval') || '1d') as '1d' | '1wk' | '1mo';

  if (!symbols) {
    return NextResponse.json(
      { error: 'Le paramètre symbols est requis' },
      { status: 400 }
    );
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Les paramètres startDate et endDate sont requis' },
      { status: 400 }
    );
  }

  if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
    return NextResponse.json(
      { error: 'Format de date invalide (attendu YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  try {
    const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
    if (symbolList.length === 0 || symbolList.length > 50) {
      return NextResponse.json(
        { error: '1 à 50 symboles requis' },
        { status: 400 }
      );
    }

    if (symbolList.length === 1) {
      const quotes = await getHistoricalQuotes(symbolList[0], startDate, endDate, interval);
      return NextResponse.json({ [symbolList[0]]: quotes });
    } else {
      const quotes = await getMultipleHistoricalQuotes(symbolList, startDate, endDate, interval);
      return NextResponse.json(quotes);
    }
  } catch (error) {
    console.error('Error fetching historical quotes:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cours historiques' },
      { status: 500 }
    );
  }
}
