import { StockQuote } from './types';

/**
 * Récupère les cours d'actions depuis Yahoo Finance via l'endpoint chart (plus fiable)
 * Note: Pour les actions françaises, ajoutez .PA (ex: MC.PA pour LVMH)
 * Pour les actions américaines, utilisez le symbole directement (ex: AAPL)
 */
export async function getStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];

  const quotes: StockQuote[] = [];

  // Utiliser l'endpoint chart pour chaque symbole (plus fiable que v7/quote)
  for (const symbol of symbols) {
    try {
      const quote = await getStockQuoteFromChart(symbol);
      if (quote) {
        quotes.push(quote);
      }
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
    }
  }

  return quotes;
}

/**
 * Récupère le cours d'une action via l'endpoint chart (v8)
 */
async function getStockQuoteFromChart(symbol: string): Promise<StockQuote | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error(`Chart API error for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return null;
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];
    
    // Obtenir les dernières valeurs
    const lastIndex = timestamps.length - 1;
    const prevIndex = lastIndex > 0 ? lastIndex - 1 : 0;
    
    const currentPrice = meta.regularMarketPrice || quote?.close?.[lastIndex] || 0;
    const previousClose = meta.previousClose || meta.chartPreviousClose || quote?.close?.[prevIndex] || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || symbol,
      price: currentPrice,
      change,
      changePercent,
      previousClose,
      open: meta.regularMarketOpen || quote?.open?.[lastIndex] || 0,
      high: meta.regularMarketDayHigh || quote?.high?.[lastIndex] || 0,
      low: meta.regularMarketDayLow || quote?.low?.[lastIndex] || 0,
      volume: meta.regularMarketVolume || quote?.volume?.[lastIndex] || 0,
      marketCap: undefined,
      currency: meta.currency || 'EUR',
    };
  } catch (error) {
    console.error(`Error fetching chart for ${symbol}:`, error);
    return null;
  }
}

/**
 * Récupère un seul cours d'action
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  const quotes = await getStockQuotes([symbol]);
  return quotes[0] || null;
}

/**
 * Recherche d'actions par nom ou symbole
 */
export async function searchStocks(query: string): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // Fallback: retourner les actions populaires qui correspondent
      console.warn(`Search API returned ${response.status}, using local fallback`);
      return POPULAR_FRENCH_STOCKS
        .filter(stock => 
          stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
          stock.name.toLowerCase().includes(query.toLowerCase())
        )
        .map(stock => ({ ...stock, exchange: 'Paris' }));
    }

    const data = await response.json();
    
    return (data.quotes || [])
      .filter((q: { quoteType?: string }) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .map((q: { symbol: string; shortname?: string; longname?: string; exchange?: string }) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || '',
      }));
  } catch (error) {
    console.error('Error searching stocks:', error);
    // Fallback local
    return POPULAR_FRENCH_STOCKS
      .filter(stock => 
        stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
        stock.name.toLowerCase().includes(query.toLowerCase())
      )
      .map(stock => ({ ...stock, exchange: 'Paris' }));
  }
}

/**
 * Symboles courants pour les actions françaises (Euronext Paris)
 */
export const FRENCH_STOCK_SUFFIXES = {
  EURONEXT_PARIS: '.PA',
};

/**
 * Exemples de symboles d'actions françaises populaires
 */
export const POPULAR_FRENCH_STOCKS = [
  { symbol: 'MC.PA', name: 'LVMH' },
  { symbol: 'OR.PA', name: "L'Oréal" },
  { symbol: 'TTE.PA', name: 'TotalEnergies' },
  { symbol: 'SAN.PA', name: 'Sanofi' },
  { symbol: 'AIR.PA', name: 'Airbus' },
  { symbol: 'BNP.PA', name: 'BNP Paribas' },
  { symbol: 'AI.PA', name: 'Air Liquide' },
  { symbol: 'SU.PA', name: 'Schneider Electric' },
  { symbol: 'KER.PA', name: 'Kering' },
  { symbol: 'DG.PA', name: 'Vinci' },
  { symbol: 'CS.PA', name: 'AXA' },
  { symbol: 'CAP.PA', name: 'Capgemini' },
  { symbol: 'RI.PA', name: 'Pernod Ricard' },
  { symbol: 'HO.PA', name: 'Thales' },
  { symbol: 'DSY.PA', name: 'Dassault Systèmes' },
];

/**
 * ETFs populaires pour PEA
 */
export const POPULAR_ETFS = [
  { symbol: 'CW8.PA', name: 'Amundi MSCI World' },
  { symbol: 'EWLD.PA', name: 'Lyxor MSCI World' },
  { symbol: 'PANX.PA', name: 'Amundi Nasdaq-100' },
  { symbol: 'ESE.PA', name: 'BNP S&P 500' },
  { symbol: 'PAEEM.PA', name: 'Amundi Emerging Markets' },
];

/**
 * Récupère les cours historiques d'une action depuis Yahoo Finance
 * @param symbol - Symbole de l'action (ex: MC.PA)
 * @param startDate - Date de début (format YYYY-MM-DD)
 * @param endDate - Date de fin (format YYYY-MM-DD)
 * @param interval - Intervalle: '1d' (jour), '1wk' (semaine), '1mo' (mois)
 */
export interface HistoricalQuote {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

export async function getHistoricalQuotes(
  symbol: string,
  startDate: string,
  endDate: string,
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<HistoricalQuote[]> {
  try {
    // Convertir les dates en timestamps Unix
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error(`Historical API error for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return [];
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];

    const historicalData: HistoricalQuote[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      // Ignorer les entrées avec des valeurs nulles
      if (quotes.close?.[i] != null) {
        historicalData.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          open: quotes.open?.[i] || 0,
          high: quotes.high?.[i] || 0,
          low: quotes.low?.[i] || 0,
          close: quotes.close?.[i] || 0,
          volume: quotes.volume?.[i] || 0,
          adjustedClose: adjClose?.[i] || quotes.close?.[i] || 0,
        });
      }
    }

    return historicalData;
  } catch (error) {
    console.error(`Error fetching historical quotes for ${symbol}:`, error);
    return [];
  }
}

/**
 * Récupère les cours historiques pour plusieurs actions
 * Retourne un objet avec les symboles comme clés
 */
export async function getMultipleHistoricalQuotes(
  symbols: string[],
  startDate: string,
  endDate: string,
  interval: '1d' | '1wk' | '1mo' = '1d'
): Promise<Record<string, HistoricalQuote[]>> {
  const results: Record<string, HistoricalQuote[]> = {};

  // Récupérer en parallèle mais avec une limite
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(symbol => getHistoricalQuotes(symbol, startDate, endDate, interval))
    );
    
    batch.forEach((symbol, index) => {
      results[symbol] = batchResults[index];
    });
  }

  return results;
}

/**
 * Trouve le cours de clôture le plus proche d'une date donnée
 */
export function findClosestQuote(
  historicalQuotes: HistoricalQuote[],
  targetDate: string
): HistoricalQuote | null {
  if (historicalQuotes.length === 0) return null;

  // Chercher la date exacte ou la plus récente avant
  for (let i = historicalQuotes.length - 1; i >= 0; i--) {
    if (historicalQuotes[i].date <= targetDate) {
      return historicalQuotes[i];
    }
  }

  // Si aucune date avant, retourner la première
  return historicalQuotes[0];
}
