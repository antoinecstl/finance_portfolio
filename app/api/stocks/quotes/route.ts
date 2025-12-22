import { NextResponse } from 'next/server';
import { getStockQuotes } from '@/lib/stock-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get('symbols');

  if (!symbols) {
    return NextResponse.json(
      { error: 'Symbols parameter is required' },
      { status: 400 }
    );
  }

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  
  if (symbolList.length === 0) {
    return NextResponse.json(
      { error: 'At least one symbol is required' },
      { status: 400 }
    );
  }

  if (symbolList.length > 50) {
    return NextResponse.json(
      { error: 'Maximum 50 symbols allowed per request' },
      { status: 400 }
    );
  }

  try {
    const quotes = await getStockQuotes(symbolList);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error('Stock quotes API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock quotes' },
      { status: 500 }
    );
  }
}
