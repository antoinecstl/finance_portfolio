// Parseurs déclaratifs : pour les formats brokers connus, on bypass le LLM.
// Avantages : zéro coût API, ultra rapide, déterministe.
// Coût : maintenance manuelle quand un broker change son format.
//
// Pattern : chaque parseur expose un `signature` (fonction qui regarde les en-têtes
// pour reconnaître le format) et un `parse` (qui transforme les rows).
// On les essaie dans l'ordre, le premier qui matche gagne.

import type { TabularContent } from './parsers';
import type { ProposedTransaction, ImportNote } from './types';

export interface DeclarativeParser {
  id: string;                                                       // ex: "boursorama"
  label: string;                                                    // ex: "Boursorama Banque"
  matches: (headers: string[]) => boolean;
  parse: (content: TabularContent) => {
    transactions: ProposedTransaction[];
    notes: ImportNote[];
  };
}

// --- Helpers communs ---

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')           // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasAll(headers: string[], required: string[]): boolean {
  const set = new Set(headers.map(normalize));
  return required.every((r) => set.has(normalize(r)));
}

// Parse un nombre au format français ("1 234,56") ou international ("1,234.56" / "1234.56").
function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/ /g, ' ')                    // NBSP
    .replace(/[€$£\s]/g, '')
    .trim();
  if (!cleaned) return null;

  // Si on a , et . : le séparateur décimal est le dernier des deux.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    // Format FR : 1.234,56
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Format US : 1,234.56
    normalized = cleaned.replace(/,/g, '');
  } else {
    // Un seul ou zéro séparateur : ambigu. On suppose décimal si ≤ 2 chiffres après.
    normalized = cleaned.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// Parse une date FR (DD/MM/YYYY) ou ISO. Renvoie YYYY-MM-DD ou null.
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // ISO direct
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // FR DD/MM/YYYY
  const fr = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/.exec(s);
  if (fr) {
    const [, d, m, y] = fr;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function findValue(row: Record<string, string>, candidates: string[]): string {
  for (const key of Object.keys(row)) {
    const nk = normalize(key);
    if (candidates.some((c) => nk === normalize(c) || nk.includes(normalize(c)))) {
      return row[key] ?? '';
    }
  }
  return '';
}

// --- Boursorama Banque (CSV / XLSX export "historique mouvements") ---
//
// En-têtes typiques (FR) : Date, Date valeur, Libellé, Montant, Devise, Catégorie.
// Le mapping vers nos types est best-effort : on reconnaît achat/vente/dividende
// via des mots-clés du libellé.

const boursorama: DeclarativeParser = {
  id: 'boursorama',
  label: 'Boursorama Banque',
  matches: (headers) => hasAll(headers, ['date', 'libelle', 'montant'])
    || hasAll(headers, ['date operation', 'libelle', 'debit', 'credit']),
  parse: (content) => {
    const transactions: ProposedTransaction[] = [];
    const notes: ImportNote[] = [];

    content.rows.forEach((row, idx) => {
      const date = parseDate(findValue(row, ['date operation', 'date']));
      const libelle = findValue(row, ['libelle', 'description']);
      let amount = parseAmount(findValue(row, ['montant']));
      if (amount === null) {
        // Format banque : colonnes Debit / Credit séparées.
        const debit = parseAmount(findValue(row, ['debit']));
        const credit = parseAmount(findValue(row, ['credit']));
        amount = (credit ?? 0) - (debit ?? 0);
      }

      if (!date || amount === null) {
        notes.push({ code: 'row_skipped', message: 'Date ou montant manquant', row: idx });
        return;
      }

      const lower = libelle.toLowerCase();
      let type: ProposedTransaction['type'];
      if (/(achat|buy)/.test(lower)) type = 'BUY';
      else if (/(vente|sell)/.test(lower)) type = 'SELL';
      else if (/(dividende|coupon)/.test(lower)) type = 'DIVIDEND';
      else if (/(interet|interest)/.test(lower)) type = 'INTEREST';
      else if (/(frais|commission|droit de garde)/.test(lower)) type = 'FEE';
      else if (amount > 0) type = 'DEPOSIT';
      else type = 'WITHDRAWAL';

      transactions.push({
        type,
        amount: Math.abs(amount),
        fees: 0,
        description: libelle.slice(0, 500),
        date,
        stock_symbol: null,
        quantity: null,
        price_per_unit: null,
      });
    });

    if (transactions.some((t) => ['BUY', 'SELL', 'DIVIDEND'].includes(t.type))) {
      notes.push({
        code: 'broker_stock_symbol_missing',
        message: 'Boursorama n\'expose pas le symbole boursier dans cet export. Complète manuellement le champ Symbole sur les lignes Achat/Vente/Dividende avant de valider.',
      });
    }

    return { transactions, notes };
  },
};

// --- Trade Republic (CSV "Account Statement") ---
//
// En-têtes typiques (EN) : Date, Type, Asset, Quantity, Price per share, Amount, Fee.
// Plus structuré que Boursorama → mapping direct possible.

const tradeRepublic: DeclarativeParser = {
  id: 'trade-republic',
  label: 'Trade Republic',
  matches: (headers) => hasAll(headers, ['date', 'type', 'amount'])
    && headers.some((h) => /asset|isin|ticker/i.test(h)),
  parse: (content) => {
    const transactions: ProposedTransaction[] = [];
    const notes: ImportNote[] = [];

    const typeMap: Record<string, ProposedTransaction['type']> = {
      'buy': 'BUY',
      'sell': 'SELL',
      'dividend': 'DIVIDEND',
      'interest': 'INTEREST',
      'deposit': 'DEPOSIT',
      'withdrawal': 'WITHDRAWAL',
      'fee': 'FEE',
    };

    content.rows.forEach((row, idx) => {
      const date = parseDate(findValue(row, ['date']));
      const rawType = findValue(row, ['type']).toLowerCase().trim();
      const type = typeMap[rawType];
      const amount = parseAmount(findValue(row, ['amount', 'montant']));
      const fee = parseAmount(findValue(row, ['fee', 'frais', 'commission'])) ?? 0;
      const qty = parseAmount(findValue(row, ['quantity', 'shares', 'quantite']));
      const price = parseAmount(findValue(row, ['price per share', 'price', 'prix']));
      const symbol = findValue(row, ['ticker', 'symbol', 'asset']) || null;

      if (!date || !type || amount === null) {
        notes.push({ code: 'row_skipped', message: 'Date, type ou montant invalide', row: idx });
        return;
      }

      transactions.push({
        type,
        amount: Math.abs(amount),
        fees: Math.abs(fee),
        description: findValue(row, ['note', 'description', 'memo']) || rawType,
        date,
        stock_symbol: ['BUY', 'SELL', 'DIVIDEND'].includes(type) ? symbol : null,
        quantity: ['BUY', 'SELL'].includes(type) ? qty : null,
        price_per_unit: ['BUY', 'SELL'].includes(type) ? price : null,
      });
    });

    return { transactions, notes };
  },
};

const PARSERS: DeclarativeParser[] = [boursorama, tradeRepublic];

export function tryDeclarativeParsers(content: TabularContent): {
  parser: DeclarativeParser;
  transactions: ProposedTransaction[];
  notes: ImportNote[];
} | null {
  for (const parser of PARSERS) {
    if (!parser.matches(content.headers)) continue;
    const result = parser.parse(content);
    // Si zéro transaction extraite, on considère que la signature a matché par accident
    // et on laisse le LLM prendre le relais.
    if (result.transactions.length === 0) continue;
    return { parser, ...result };
  }
  return null;
}
