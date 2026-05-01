// Orchestrateur : route chaque source vers le pipeline adapté.
// - PDF        : OCR document-aware (Mistral) avec extraction structurée en 1 appel.
// - CSV / XLSX : parsing local + parseur déclaratif si reconnu, sinon fallback LLM.
// - Texte collé: LLM directement.
// C'est le seul point d'entrée appelé par la route /api/import/parse.

import { parseCSV, parseXLSX, parsePlainText, buildExcerpt } from './parsers';
import { tryDeclarativeParsers } from './declarative';
import { getLLMProvider } from './llm';
import { getOCRProvider } from './ocr';
import type { ParseResult, ImportSourceType } from './types';

export interface OrchestratorInput {
  sourceType: ImportSourceType;
  buffer?: Buffer;          // pour csv/xlsx/pdf
  text?: string;            // pour text
  filename?: string;        // hint pour le LLM ou l'OCR
}

export async function runImportPipeline(input: OrchestratorInput): Promise<ParseResult> {
  // PDF → OCR. Mistral OCR gère nativement les PDF-image / scans et renvoie
  // directement les transactions structurées via document_annotation_format,
  // donc on court-circuite le pipeline parsing → LLM.
  if (input.sourceType === 'pdf') {
    if (!input.buffer) throw new Error('pdf_buffer_missing');
    return getOCRProvider().extractFromPDF(input.buffer, input.filename);
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
      return {
        transactions: declarative.transactions,
        detectedFormat: declarative.parser.id,
        notes: declarative.notes,
        rawExcerpt,
      };
    }
  }

  // Fallback LLM : tabulaire non reconnu ou texte collé.
  const llm = getLLMProvider();
  const llmResult = await llm.extractTransactions(
    content.kind === 'tabular'
      ? { kind: 'tabular', headers: content.headers, rows: content.rows, hint: input.filename }
      : { kind: 'text', text: content.text, hint: input.filename }
  );

  return {
    transactions: llmResult.transactions,
    detectedFormat: llmResult.detectedFormat,
    notes: llmResult.notes,
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
