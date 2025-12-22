import { NextResponse } from 'next/server';
import { searchStocks } from '@/lib/stock-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const results = await searchStocks(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Stock search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search stocks' },
      { status: 500 }
    );
  }
}
