// Parseurs de fichiers : convertissent un upload en représentation intermédiaire.
// - CSV / XLSX → tabulaire (headers + rows)
// - PDF / texte collé → texte brut
//
// Ces parseurs ne décident pas du sens des colonnes : c'est le rôle des
// parseurs déclaratifs (declarative.ts) ou du LLM en fallback.

import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import * as nodeModule from 'node:module';

export type TabularContent = {
  kind: 'tabular';
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type TextContent = {
  kind: 'text';
  text: string;
};

export type FileContent = TabularContent | TextContent;

const MAX_ROWS = 5000;
const MAX_TEXT_CHARS = 200_000;

type PdfJsCanvasPolyfills = {
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
  pdfjsWorker?: { WorkerMessageHandler?: unknown };
};

type ProcessWithBuiltinModule = NodeJS.Process & {
  getBuiltinModule?: (id: string) => unknown;
};

// Normalise une cellule : trim + remplace les espaces multiples + caps à 500 chars.
function normalizeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim().replace(/\s+/g, ' ');
  return s.length > 500 ? s.slice(0, 500) : s;
}

// CSV : auto-détection du séparateur (, ; tab) via PapaParse.
export async function parseCSV(buffer: Buffer): Promise<TabularContent> {
  const text = buffer.toString('utf8').replace(/^﻿/, ''); // strip BOM
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    delimiter: '',                  // auto-detect
    transform: (value) => normalizeCell(value),
  });
  const all = (result.data ?? []) as string[][];
  if (all.length === 0) {
    return { kind: 'tabular', headers: [], rows: [] };
  }
  const headers = all[0].map((h, i) => h || `col_${i + 1}`);
  const rows = all.slice(1, MAX_ROWS + 1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
  return { kind: 'tabular', headers, rows };
}

// XLSX : lit la première feuille non vide. Les dates Excel sont converties en YYYY-MM-DD,
// les nombres en string (le LLM ou les déclaratifs reparserent le format local).
export async function parseXLSX(buffer: Buffer): Promise<TabularContent> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets.find((w) => w.rowCount > 0);
  if (!sheet) {
    return { kind: 'tabular', headers: [], rows: [] };
  }

  const allRows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (allRows.length > MAX_ROWS + 1) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v instanceof Date) {
        cells.push(v.toISOString().slice(0, 10));
      } else if (v !== null && typeof v === 'object' && 'result' in (v as object)) {
        // Cellule formule : on prend le résultat calculé.
        cells.push(normalizeCell((v as { result: unknown }).result));
      } else {
        cells.push(normalizeCell(v));
      }
    });
    allRows.push(cells);
  });

  if (allRows.length === 0) return { kind: 'tabular', headers: [], rows: [] };
  const headers = allRows[0].map((h, i) => h || `col_${i + 1}`);
  const rows = allRows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
  return { kind: 'tabular', headers, rows };
}

async function ensurePdfJsNodePolyfills() {
  const nodeProcess = process as ProcessWithBuiltinModule;
  if (typeof nodeProcess.getBuiltinModule !== 'function') {
    nodeProcess.getBuiltinModule = (id: string) => {
      if (id === 'module') return nodeModule;
      throw new Error(`unsupported_builtin_module:${id}`);
    };
  }

  const runtime = globalThis as unknown as PdfJsCanvasPolyfills;

  if (!runtime.DOMMatrix || !runtime.ImageData || !runtime.Path2D) {
    const canvas = (await import('@napi-rs/canvas')) as PdfJsCanvasPolyfills;
    runtime.DOMMatrix ??= canvas.DOMMatrix;
    runtime.ImageData ??= canvas.ImageData;
    runtime.Path2D ??= canvas.Path2D;
  }

  if (!runtime.DOMMatrix) {
    throw new Error('pdf_runtime_missing_dommatrix');
  }

  // En serverless Next, le fallback worker relatif "./pdf.worker.mjs" de PDF.js
  // ne pointe pas vers un fichier réel dans .next/server/chunks. Charger le
  // worker ici initialise globalThis.pdfjsWorker et court-circuite ce fallback.
  if (!runtime.pdfjsWorker?.WorkerMessageHandler) {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }
}

// PDF : extraction texte best-effort. La structure tabulaire est perdue,
// donc on délègue toujours au LLM (pas de parseur déclaratif PDF).
// pdfjs-dist 5.x attend DOMMatrix dès l'import. Node 20 ne le fournit pas :
// on installe les polyfills canvas avant de charger pdf-parse.
export async function parsePDF(buffer: Buffer): Promise<TextContent> {
  await ensurePdfJsNodePolyfills();
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const data = await parser.getText({ pageJoiner: '\n' });
    const text = (data.text ?? '').slice(0, MAX_TEXT_CHARS);
    return { kind: 'text', text };
  } finally {
    await parser.destroy();
  }
}

// Texte collé : aucune transformation, juste un cap de taille.
export function parsePlainText(text: string): TextContent {
  return { kind: 'text', text: text.slice(0, MAX_TEXT_CHARS) };
}

// Aperçu textuel borné pour audit (stocké dans import_jobs.raw_excerpt).
export function buildExcerpt(content: FileContent): string {
  if (content.kind === 'text') {
    return content.text.slice(0, 2000);
  }
  const headerLine = content.headers.join(' | ');
  const sampleLines = content.rows.slice(0, 5)
    .map((r) => content.headers.map((h) => r[h] ?? '').join(' | '));
  return [headerLine, ...sampleLines].join('\n').slice(0, 2000);
}
