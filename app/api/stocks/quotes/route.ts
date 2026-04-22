import { NextResponse } from 'next/server';
import { getStockQuotes } from '@/lib/stock-api';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = rateLimit(clientKey(request, user.id), 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
    );
  }

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
