// Import de plusieurs documents en une fois (ex. 5 relevés PDF ou captures).
// Chaque fichier est analysé par son propre appel à /api/import/parse (un
// import_job par fichier, requêtes sous la limite de taille des fonctions) ;
// le client fusionne ensuite les propositions en une seule vérification, puis
// /api/import/commit insère le lot en une transaction et clôt tous les jobs.

import { detectImportSourceType } from './file-types';
import { findDuplicateTransaction } from '@/lib/transaction-duplicates';
import { MAX_IMPORT_FILES } from './types';
import type { ImportNote, ProposedTransaction } from './types';
import type { Transaction } from '@/lib/types';

export { MAX_IMPORT_FILES };
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // aligné sur /api/import/parse

export interface ImportFileLike {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export type RejectedImportFileReason = 'unsupported_format' | 'too_large' | 'too_many' | 'duplicate';

export interface RejectedImportFile {
  name: string;
  reason: RejectedImportFileReason;
}

const fileKey = (file: ImportFileLike) => `${file.name}:${file.size}:${file.lastModified}`;

// Ajoute les fichiers choisis à la sélection courante : ignore les doublons
// (même nom, taille et date), les formats non pris en charge, les fichiers
// trop lourds et tout ce qui dépasse MAX_IMPORT_FILES.
export function addImportFiles<T extends ImportFileLike>(
  current: readonly T[],
  incoming: readonly T[]
): { files: T[]; rejected: RejectedImportFile[] } {
  const files = [...current];
  const keys = new Set(files.map(fileKey));
  const rejected: RejectedImportFile[] = [];

  for (const file of incoming) {
    if (keys.has(fileKey(file))) {
      rejected.push({ name: file.name, reason: 'duplicate' });
    } else if (!detectImportSourceType(file.name, file.type)) {
      rejected.push({ name: file.name, reason: 'unsupported_format' });
    } else if (file.size > MAX_IMPORT_FILE_BYTES) {
      rejected.push({ name: file.name, reason: 'too_large' });
    } else if (files.length >= MAX_IMPORT_FILES) {
      rejected.push({ name: file.name, reason: 'too_many' });
    } else {
      files.push(file);
      keys.add(fileKey(file));
    }
  }

  return { files, rejected };
}

export function describeRejectedFiles(rejected: readonly RejectedImportFile[]): string | null {
  if (rejected.length === 0) return null;
  const reasons: Record<RejectedImportFileReason, string> = {
    unsupported_format: 'format non pris en charge',
    too_large: 'plus de 10 MB',
    too_many: `${MAX_IMPORT_FILES} documents maximum par import`,
    duplicate: 'déjà sélectionné',
  };
  return rejected.map((file) => `${file.name} : ${reasons[file.reason]}`).join(' · ');
}

export interface ParsedImportDocument {
  filename: string;
  transactions: ProposedTransaction[];
  notes: ImportNote[];
}

// Fusionne les propositions de plusieurs documents dans l'ordre de sélection.
// Les remarques sont préfixées par le nom du document quand il y en a
// plusieurs, et leur numéro de ligne est décalé pour pointer la ligne fusionnée.
export function mergeParsedDocuments(documents: readonly ParsedImportDocument[]): {
  rows: ProposedTransaction[];
  notes: ImportNote[];
  rowSources: string[];
} {
  const rows: ProposedTransaction[] = [];
  const notes: ImportNote[] = [];
  const rowSources: string[] = [];
  const labelled = documents.length > 1;

  for (const document of documents) {
    const offset = rows.length;
    rows.push(...document.transactions);
    rowSources.push(...document.transactions.map(() => document.filename));
    for (const note of document.notes) {
      notes.push({
        ...note,
        message: labelled ? `${document.filename} — ${note.message}` : note.message,
        row: typeof note.row === 'number' ? note.row + offset : note.row,
      });
    }
  }

  return { rows, notes, rowSources };
}

// Doublons à l'intérieur du lot importé (relevés qui se chevauchent, même
// capture envoyée deux fois…). Renvoie, pour chaque ligne concernée, l'index
// de la première ligne identique qui la précède. Mêmes critères que la
// détection face aux transactions existantes.
export function findInBatchDuplicates(
  rows: readonly ProposedTransaction[],
  accountId: string,
  accountCurrency: string
): Map<number, number> {
  const duplicates = new Map<number, number>();
  const seen: Transaction[] = [];

  rows.forEach((row, index) => {
    if (!row.date || !Number.isFinite(row.amount)) return;
    const currency = (row.currency ?? accountCurrency).toUpperCase();
    const candidate = {
      type: row.type,
      date: row.date,
      amount: row.amount,
      currency,
      stock_symbol: row.stock_symbol ?? null,
      quantity: row.quantity ?? null,
      price_per_unit: row.price_per_unit ?? null,
      target_amount: row.target_amount ?? null,
      target_currency: row.target_currency?.toUpperCase() ?? null,
    };
    const match = findDuplicateTransaction(candidate, seen, { accountId });
    if (match) duplicates.set(index, Number(match.id));

    seen.push({
      id: String(index),
      account_id: accountId,
      type: row.type,
      amount: row.amount,
      currency,
      description: row.description ?? '',
      date: row.date,
      stock_symbol: row.stock_symbol ?? undefined,
      quantity: row.quantity ?? undefined,
      price_per_unit: row.price_per_unit ?? undefined,
      target_amount: row.target_amount ?? null,
      target_currency: row.target_currency ?? null,
      created_at: '',
    });
  });

  return duplicates;
}
