// Types pour le suivi de portefeuille financier

export type AccountType = 'PEA' | 'LIVRET_A' | 'LDDS' | 'CTO' | 'ASSURANCE_VIE' | 'PEL' | 'CRYPTO' | 'AUTRE';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  // Si null/undefined : utilise le défaut du type (PEA/CTO/ASSURANCE_VIE → true, autres → false).
  // Si défini : surcharge explicite (utile pour AUTRE).
  supports_positions?: boolean | null;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'BUY' | 'SELL' | 'DIVIDEND' | 'INTEREST' | 'FEE' | 'CONVERSION';

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  // Devise du montant (et de price_per_unit / fees liés). 'EUR' par défaut sur
  // les transactions historiques (backfill de la migration multi-devise).
  currency: string;
  fee_transaction_id?: string | null;
  description: string;
  date: string;
  // Heure optionnelle (HH:MM:SS) saisie par l'utilisateur pour ordonner
  // explicitement les transactions du même jour. Null => l'ordre retombe sur
  // l'heure synthétique dérivée du type (effective_time côté DB).
  time?: string | null;
  // Colonne calculée côté DB : time si renseignée, sinon heure synthétique
  // dérivée du type. Sert à trier (date, effective_time, id) côté API et SQL.
  effective_time?: string | null;
  stock_symbol?: string;
  quantity?: number;
  price_per_unit?: number;
  // Spécifiques au type CONVERSION : montant et devise crédités après le swap.
  // null/undefined pour tous les autres types.
  target_amount?: number | null;
  target_currency?: string | null;
  created_at: string;
}

export interface StockPosition {
  id: string;
  account_id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_price: number;
  currency: string;
  sector?: string;
  created_at: string;
  updated_at: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap?: number;
  currency: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PortfolioHistory {
  id: string;
  date: string;
  total_value: number;
  created_at: string;
}

// Types pour l'API de cotation
export interface QuoteApiResponse {
  quoteResponse: {
    result: Array<{
      symbol: string;
      shortName: string;
      longName?: string;
      regularMarketPrice: number;
      regularMarketChange: number;
      regularMarketChangePercent: number;
      regularMarketPreviousClose: number;
      regularMarketOpen: number;
      regularMarketDayHigh: number;
      regularMarketDayLow: number;
      regularMarketVolume: number;
      marketCap?: number;
      currency: string;
    }>;
    error: null | { code: string; description: string };
  };
}
