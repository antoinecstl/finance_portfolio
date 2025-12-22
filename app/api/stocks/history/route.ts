import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalQuotes, getMultipleHistoricalQuotes } from '@/lib/stock-api';

export async function GET(request: NextRequest) {
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

  try {
    const symbolList = symbols.split(',').map(s => s.trim());

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
