// Orchestrateur : route chaque source vers le pipeline adapté.
// - PDF        : OCR document-aware (Mistral) avec extraction structurée en 1 appel.
// - CSV / XLSX : parsing local + parseur déclaratif si reconnu, sinon fallback LLM.
// - Texte collé: LLM directement.
// C'est le seul point d'entrée appelé par la route /api/import/parse.

import { parseCSV, parseXLSX, parsePlainText, buildExcerpt } from './parsers';
import { tryDeclarativeParsers } from './declarative';
import { getLLMProvider } from './llm';
import { getOCRProvider } from './ocr';
import type { ParseResult, ImportSourceType, ProposedTransaction, ImportNote } from './types';

export interface OrchestratorInput {
  sourceType: ImportSourceType;
  buffer?: Buffer;          // pour csv/xlsx/pdf
  text?: string;            // pour text
  filename?: string;        // hint pour le LLM ou l'OCR
  accountCurrency?: string; // devise du compte cible (défaut LLM si devise absente)
}

const FIAT_AND_STABLE_CODES = ['EUR', 'USD', 'GBP', 'CHF', 'USDC', 'USDT', 'BUSD', 'DAI'] as const;
const FIAT_STABLE_PAIR_RE = new RegExp(`\\b(${FIAT_AND_STABLE_CODES.join('|')})[-_/ ]?(${FIAT_AND_STABLE_CODES.join('|')})\\b`, 'i');

function findCurrencyPair(tx: ProposedTransaction): { base: string; quote: string } | null {
  const candidates = [
    tx.stock_symbol,
    tx.description,
  ].filter((v): v is string => Boolean(v));

  for (const candidate of candidates) {
    const normalized = candidate.toUpperCase().replace(/[^A-Z]/g, '');
    const match = normalized.match(FIAT_STABLE_PAIR_RE);
    if (!match) continue;
    const base = match[1].toUpperCase();
    const quote = match[2].toUpperCase();
    if (base !== quote) return { base, quote };
  }

  return null;
}

function normalizeExtractedTransactions(
  transactions: ProposedTransaction[],
  notes: ImportNote[]
): { transactions: ProposedTransaction[]; notes: ImportNote[] } {
  const nextNotes = notes.filter((note) => {
    const message = note.message.toLowerCase();
    // Ces notes provenaient de mauvaises classifications que l'on corrige ici.
    if (message.includes('stock_symbol') && message.includes('-usd')) return false;
    // Bruit normal : devise/date clairement lisibles, pas une anomalie utile.
    if (message.includes('devise native déduite') || message.includes('currency=')) return false;
    if (message.includes('dates lues au format') || message.includes('date lue au format')) return false;
    if (message.includes('jj-mm-yy') && message.includes('convert')) return false;
    return true;
  });

  const nextTransactions = transactions.map((tx, index): ProposedTransaction => {
    const pair = findCurrencyPair(tx);
    const side = `${tx.type} ${tx.description ?? ''}`.toUpperCase();
    const shouldBeConversion =
      tx.type === 'CONVERSION'
      || Boolean(pair && (tx.type === 'BUY' || tx.type === 'SELL' || tx.stock_symbol?.toUpperCase() === '-USD'));

    if (!shouldBeConversion) {
      return tx.stock_symbol?.toUpperCase() === '-USD' ? { ...tx, stock_symbol: null } : tx;
    }

    let sourceCurrency = (tx.currency ?? pair?.base ?? 'EUR').toUpperCase();
    let targetCurrency = tx.target_currency?.toUpperCase() ?? null;

    if (pair) {
      if (side.includes('BUY')) {
        sourceCurrency = pair.quote;
        targetCurrency = pair.base;
      } else {
        sourceCurrency = pair.base;
        targetCurrency = pair.quote;
      }
    }

    const normalized: ProposedTransaction = {
      ...tx,
      type: 'CONVERSION',
      currency: sourceCurrency,
      fees: 0,
      stock_symbol: null,
      quantity: null,
      price_per_unit: null,
      target_currency: targetCurrency,
    };

    if (tx.type !== 'CONVERSION' || tx.stock_symbol) {
      nextNotes.push({
        code: 'conversion_normalized',
        row: index,
        message: `Paire de devises détectée${pair ? ` (${pair.base}/${pair.quote})` : ''} : ligne traitée comme conversion, sans ticker.`,
      });
    }

    if (!normalized.target_amount || !normalized.target_currency) {
      nextNotes.push({
        code: 'conversion_target_missing',
        row: index,
        message: 'Conversion détectée : vérifiez ou renseignez le montant cible avant validation si la ligne est marquée invalide.',
      });
    }

    return normalized;
  });

  return { transactions: nextTransactions, notes: nextNotes };
}

export async function runImportPipeline(input: OrchestratorInput): Promise<ParseResult> {
  // PDF → OCR. Mistral OCR gère nativement les PDF-image / scans et renvoie
  // directement les transactions structurées via document_annotation_format,
  // donc on court-circuite le pipeline parsing → LLM.
  if (input.sourceType === 'pdf') {
    if (!input.buffer) throw new Error('pdf_buffer_missing');
    const pdfResult = await getOCRProvider().extractFromPDF(input.buffer, input.filename);
    const normalized = normalizeExtractedTransactions(pdfResult.transactions, pdfResult.notes);
    return { ...pdfResult, ...normalized };
  }

  // Sources tabulaires / texte : parsing local d'abord.
  const content = await (async () => {
    switch (input.sourceType) {
      case 'csv':
        if (!input.buffer) throw new Error('csv_buffer_missing');
        return parseCSV(input.buffer);
      case 'xlsx':
        if (!input.buffer) throw new Error('xlsx_buffer_missing');
        return parseXLSX(input.buffer);
      case 'text':
        if (input.text === undefined) throw new Error('text_missing');
        return parsePlainText(input.text);
      case 'pdf':
        // Géré au-dessus, ne devrait jamais atteindre cette branche.
        throw new Error('unreachable_pdf_in_switch');
    }
  })();

  const rawExcerpt = buildExcerpt(content);

  // Pour les sources tabulaires, on tente d'abord les parseurs déclaratifs.
  // S'ils matchent → zéro coût LLM. Sinon → fallback LLM.
  if (content.kind === 'tabular') {
    const declarative = tryDeclarativeParsers(content);
    if (declarative) {
      const normalized = normalizeExtractedTransactions(declarative.transactions, declarative.notes);
      return {
        transactions: normalized.transactions,
        notes: normalized.notes,
        detectedFormat: declarative.parser.id,
        rawExcerpt,
      };
    }
  }

  // Fallback LLM : tabulaire non reconnu ou texte collé.
  const llm = getLLMProvider();
  const llmResult = await llm.extractTransactions(
    content.kind === 'tabular'
      ? { kind: 'tabular', headers: content.headers, rows: content.rows, hint: input.filename, accountCurrency: input.accountCurrency }
      : { kind: 'text', text: content.text, hint: input.filename, accountCurrency: input.accountCurrency }
  );

  const normalized = normalizeExtractedTransactions(llmResult.transactions, llmResult.notes);

  return {
    transactions: normalized.transactions,
    detectedFormat: llmResult.detectedFormat,
    notes: normalized.notes,
    rawExcerpt,
  };
}

// Hash SHA256 stable du contenu + account, utilisé comme idempotency_key.
// Les imports identiques (même fichier sur même compte) renvoient le même job.
import { createHash } from 'crypto';

export function buildIdempotencyKey(
  accountId: string,
  sourceType: ImportSourceType,
  rawContent: Buffer | string
): string {
  const h = createHash('sha256');
  h.update(accountId);
  h.update(':');
  h.update(sourceType);
  h.update(':');
  h.update(rawContent);
  return h.digest('hex');
}
