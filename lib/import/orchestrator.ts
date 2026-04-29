// Orchestrateur : coordonne parsing → tentative déclarative → fallback LLM.
// C'est le seul point d'entrée appelé par la route /api/import/parse.

import { parseCSV, parseXLSX, parsePDF, parsePlainText, buildExcerpt } from './parsers';
import { tryDeclarativeParsers } from './declarative';
import { getLLMProvider } from './llm';
import type { ParseResult, ImportSourceType } from './types';

export interface OrchestratorInput {
  sourceType: ImportSourceType;
  buffer?: Buffer;          // pour csv/xlsx/pdf
  text?: string;            // pour text
  filename?: string;        // hint pour le LLM
}

export async function runImportPipeline(input: OrchestratorInput): Promise<ParseResult> {
  const content = await (async () => {
    switch (input.sourceType) {
      case 'csv':
        if (!input.buffer) throw new Error('csv_buffer_missing');
        return parseCSV(input.buffer);
      case 'xlsx':
        if (!input.buffer) throw new Error('xlsx_buffer_missing');
        return parseXLSX(input.buffer);
      case 'pdf':
        if (!input.buffer) throw new Error('pdf_buffer_missing');
        return parsePDF(input.buffer);
      case 'text':
        if (input.text === undefined) throw new Error('text_missing');
        return parsePlainText(input.text);
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

  // Fallback LLM : gère aussi les PDF / texte collé qui n'ont pas de structure tabulaire.
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
