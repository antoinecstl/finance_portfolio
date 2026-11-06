// Noms lisibles des titres (L'Oréal plutôt que OR.PA). Le fournisseur de cours
// renvoie un nom avec chaque cotation ; certains sont en majuscules
// (« BNP PARIBAS EASY S&P 500 UCITS ETF ») ou suffixés pour les cryptos
// (« Bitcoin USD »). Fonctions pures, partagées par le serveur et le client.

import { isCryptoSymbol } from './utils';

// Sigles conservés en majuscules quand un nom est remis en casse normale.
const ACRONYMS = new Set([
  'ETF', 'UCITS', 'MSCI', 'S&P', 'ESG', 'PEA', 'SRI', 'ACC', 'DIST', 'USD', 'EUR', 'GBP', 'CHF', 'JPY',
  'SA', 'SE', 'NV', 'AG', 'PLC', 'SPA', 'ASA', 'AB', 'OYJ', 'SCA', 'SCS', 'INC', 'LTD', 'CO',
  'CAC', 'DAX', 'FTSE', 'STOXX', 'EMU', 'USA', 'UK', 'US', 'EM', 'EMEA', 'BNP', 'AXA', 'LVMH', 'TTE',
  'II', 'III', 'IV', 'REIT', 'ADR', 'NASDAQ', 'ETC', 'C', 'D', 'H', 'NYSE', 'BTP', 'OAT',
]);
// Mots de liaison laissés en minuscules au milieu d'un nom.
const LOWER_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'of', 'the', 'and', 'en', 'au', 'aux']);

function isMostlyUppercase(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length;
  return upper / letters.length > 0.8;
}

function titleCaseWord(word: string, index: number): string {
  if (ACRONYMS.has(word.toUpperCase().replace(/[.,]$/, ''))) return word.toUpperCase();
  if (/\d/.test(word)) return word.toUpperCase();
  const lower = word.toLowerCase();
  if (index > 0 && LOWER_WORDS.has(lower)) return lower;
  // Respecte les apostrophes et les tirets (l'oréal → L'Oréal, saint-gobain → Saint-Gobain).
  return lower.replace(/(^|['’\-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

/** Remet en casse normale un nom fourni en majuscules ; laisse les autres intacts. */
export function prettifyInstrumentName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!isMostlyUppercase(name)) return name;
  return name.split(' ').map(titleCaseWord).join(' ');
}

/**
 * Nom à afficher pour un titre, ou null s'il n'est pas connu (ou n'est que le
 * code). Les paires crypto perdent leur devise de cotation (« Bitcoin USD » →
 * « Bitcoin »).
 */
export function instrumentName(symbol: string, rawName?: string | null): string | null {
  if (!rawName) return null;
  let name = prettifyInstrumentName(rawName);
  if (isCryptoSymbol(symbol)) name = name.replace(/\s+(USD|EUR|USDT|USDC)$/i, '');
  if (!name || name.toUpperCase() === symbol.toUpperCase()) return null;
  return name;
}

/** Libellé principal : le nom s'il est connu, sinon le code. */
export function instrumentLabel(symbol: string, name?: string | null): string {
  return instrumentName(symbol, name) ?? symbol;
}

// Émetteurs d'ETF retirés des noms courts : « Amundi MSCI World ETF » → « MSCI World ETF ».
const ETF_ISSUERS = /^(Amundi|BNP Paribas Easy|BNP Paribas|iShares|Lyxor|Xtrackers|SPDR|Vanguard|Invesco|HSBC|UBS|WisdomTree|VanEck)\s+/i;

/** Nom raccourci pour les axes de graphiques et les puces (… au-delà de `max`). */
export function shortInstrumentName(label: string, max = 18): string {
  let clean = label
    .replace(/\s+UCITS ETF.*$/i, ' ETF')
    .replace(/\s+(S\.?A\.?|S\.?E\.?|N\.?V\.?|Inc\.?|PLC|AG)$/i, '')
    .trim();
  if (/\bETF\b/.test(clean)) clean = clean.replace(ETF_ISSUERS, '');
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
