// Types pour le suivi de portefeuille financier

export type AccountType = 'PEA' | 'LIVRET_A' | 'LDDS' | 'CTO' | 'ASSURANCE_VIE' | 'PEL' | 'AUTRE';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BUY' | 'SELL' | 'DIVIDEND' | 'INTEREST' | 'FEE';
  amount: number;
  description: string;
  date: string;
  stock_symbol?: string;
  quantity?: number;
  price_per_unit?: number;
  created_at: string;
}

export interface StockPosition {
  id: string;
  account_id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_price: number;
  current_price: number;
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

// Types pour l'API Yahoo Finance
export interface YahooQuoteResponse {
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
