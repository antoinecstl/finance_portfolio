import { findClosestQuote, type HistoricalQuote } from './stock-api';

// Stablecoins → fiat sous-jacent. On peg à 1:1 avec le fiat (c'est leur conception
// par construction). Tient bien 99 % du temps ; peut diverger en stress (ex.
// USDC mars 2023 ≈ 0,87 USD pendant 2 jours). Acceptable pour un suivi perso
// — l'alternative serait un feed CoinGecko payant pour <0,5 % d'erreur.
const STABLECOIN_TO_FIAT: Record<string, string> = {
  USDC: 'USD',
  USDT: 'USD',
  BUSD: 'USD',
  DAI: 'USD',
  FDUSD: 'USD',
  PYUSD: 'USD',
  FRAX: 'USD',
  TUSD: 'USD',
  USDP: 'USD',
  GUSD: 'USD',
  EURC: 'EUR',
  EURT: 'EUR',
  EURS: 'EUR',
};

export const BASE_CURRENCY = 'EUR';

/**
 * Devises pour lesquelles on connaît un fiat sous-jacent. Une devise inconnue
 * (ex. BTC utilisé comme cash) tombe sur 1:1 EUR avec un warning.
 */
const KNOWN_FIATS = new Set(['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK']);

export function normalizeToFiat(currency: string | null | undefined): string {
  const code = (currency ?? 'EUR').toUpperCase();
  return STABLECOIN_TO_FIAT[code] ?? code;
}

export function isSupportedFiat(currency: string): boolean {
  return KNOWN_FIATS.has(normalizeToFiat(currency));
}

/**
 * Symbole Yahoo Finance pour le taux EUR ↔ {fiat}. Renvoie null pour la devise
 * de base. Convention Yahoo : `EURUSD=X` ⇒ close = USD pour 1 EUR.
 */
export function fxYahooSymbol(fiatCode: string): string | null {
  const normalized = normalizeToFiat(fiatCode);
  if (normalized === BASE_CURRENCY) return null;
  return `${BASE_CURRENCY}${normalized}=X`;
}

export type FxRateMap = Record<string, HistoricalQuote[]>;

/**
 * Liste les devises non-EUR (après normalisation stablecoin → fiat) présentes
 * dans un jeu de transactions. Sert à déterminer quels taux FX charger.
 */
export function uniqueForeignFiats(
  transactions: Array<{ currency?: string | null; target_currency?: string | null }>
): string[] {
  const seen = new Set<string>();
  for (const tx of transactions) {
    const c = normalizeToFiat(tx.currency ?? 'EUR');
    if (c !== BASE_CURRENCY) seen.add(c);
    if (tx.target_currency) {
      const t = normalizeToFiat(tx.target_currency);
      if (t !== BASE_CURRENCY) seen.add(t);
    }
  }
  return Array.from(seen);
}

/**
 * Convertit `amount` libellé en `currency` vers EUR au taux Yahoo le plus
 * proche de `date`. Si pas de série dispo (devise inconnue, bug réseau), on
 * fallback à l'identité 1:1 — meilleur que zéroïser le portefeuille.
 *
 * Convention : EURUSD=X.close = X pour 1 EUR ⇒ amount(X) / close = montant(EUR).
 */
export function convertToBase(
  amount: number,
  currency: string,
  date: string,
  fxRates: FxRateMap
): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const fiat = normalizeToFiat(currency);
  if (fiat === BASE_CURRENCY) return amount;

  const series = fxRates[fiat];
  if (!series || series.length === 0) return amount;

  const quote = findClosestQuote(series, date);
  if (!quote || quote.close <= 0) return amount;

  return amount / quote.close;
}
