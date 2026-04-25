import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalQuotes, getMultipleHistoricalQuotes } from '@/lib/stock-api';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import {
  isoDateSchema,
  parseStockSymbolList,
  stockHistoryIntervalSchema,
} from '@/lib/schemas';

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
  const rawInterval = searchParams.get('interval') || '1d';

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

  const parsedStartDate = isoDateSchema.safeParse(startDate);
  const parsedEndDate = isoDateSchema.safeParse(endDate);
  if (!parsedStartDate.success || !parsedEndDate.success) {
    return NextResponse.json(
      { error: 'Format de date invalide (attendu YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  if (parsedStartDate.data > parsedEndDate.data) {
    return NextResponse.json(
      { error: 'startDate doit être antérieure ou égale à endDate' },
      { status: 400 }
    );
  }

  const parsedInterval = stockHistoryIntervalSchema.safeParse(rawInterval);
  if (!parsedInterval.success) {
    return NextResponse.json(
      { error: 'Intervalle invalide (attendu 1d, 1wk ou 1mo)' },
      { status: 400 }
    );
  }

  const parsedSymbols = parseStockSymbolList(symbols);
  if (!parsedSymbols.success) {
    return NextResponse.json({ error: parsedSymbols.error }, { status: 400 });
  }

  try {
    const symbolList = parsedSymbols.symbols;
    const interval = parsedInterval.data;

    if (symbolList.length === 1) {
      const quotes = await getHistoricalQuotes(
        symbolList[0],
        parsedStartDate.data,
        parsedEndDate.data,
        interval
      );
      return NextResponse.json({ [symbolList[0]]: quotes });
    }

    const quotes = await getMultipleHistoricalQuotes(
      symbolList,
      parsedStartDate.data,
      parsedEndDate.data,
      interval
    );
    return NextResponse.json(quotes);
  } catch (error) {
    console.error('Error fetching historical quotes:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cours historiques' },
      { status: 500 }
    );
  }
}
