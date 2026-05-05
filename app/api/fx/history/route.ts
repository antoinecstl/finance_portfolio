import { NextRequest, NextResponse } from 'next/server';
import { getMultipleHistoricalQuotes, type HistoricalQuote } from '@/lib/stock-api';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { isoDateSchema } from '@/lib/schemas';
import { fxYahooSymbol, normalizeToFiat, BASE_CURRENCY } from '@/lib/fx';

// Renvoie les séries Yahoo `EUR{fiat}=X` pour une liste de devises. La route
// /api/stocks/history rejette le `=` du symbole FX (regex stockSymbolSchema),
// d'où cette route dédiée qui traduit code devise → symbole Yahoo en interne.

const MAX_FIATS = 10;

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
  const currenciesParam = searchParams.get('currencies');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!currenciesParam) {
    return NextResponse.json({ error: 'Le paramètre currencies est requis' }, { status: 400 });
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

  const rawCodes = currenciesParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawCodes.length === 0) {
    return NextResponse.json({ error: 'At least one currency is required' }, { status: 400 });
  }
  if (rawCodes.length > MAX_FIATS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FIATS} currencies per request` },
      { status: 400 }
    );
  }

  // Normalisation : USDC → USD, déduplication, exclusion de la devise de base.
  const fiats: string[] = [];
  const seen = new Set<string>();
  for (const code of rawCodes) {
    if (!/^[A-Z]{3,10}$/i.test(code)) {
      return NextResponse.json({ error: `Code devise invalide: ${code}` }, { status: 400 });
    }
    const fiat = normalizeToFiat(code);
    if (fiat === BASE_CURRENCY || seen.has(fiat)) continue;
    seen.add(fiat);
    fiats.push(fiat);
  }

  if (fiats.length === 0) {
    return NextResponse.json({});
  }

  const symbolByFiat = new Map<string, string>();
  for (const fiat of fiats) {
    const sym = fxYahooSymbol(fiat);
    if (sym) symbolByFiat.set(fiat, sym);
  }

  try {
    const symbols = Array.from(symbolByFiat.values());
    const yahooData = await getMultipleHistoricalQuotes(
      symbols,
      parsedStartDate.data,
      parsedEndDate.data,
      '1d'
    );

    // Réindexe par code fiat plutôt que par symbole Yahoo (côté client on
    // pense en USD/GBP, pas en EURUSD=X).
    const result: Record<string, HistoricalQuote[]> = {};
    for (const [fiat, sym] of symbolByFiat.entries()) {
      result[fiat] = yahooData[sym] ?? [];
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching FX history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des taux de change' },
      { status: 500 }
    );
  }
}
