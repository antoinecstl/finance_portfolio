import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_FILES,
  MAX_IMPORT_FILE_BYTES,
  addImportFiles,
  describeRejectedFiles,
  findInBatchDuplicates,
  mergeParsedDocuments,
  type ImportFileLike,
} from './multi-file';
import type { ProposedTransaction } from './types';

const file = (name: string, size = 1000, type = '', lastModified = 1): ImportFileLike => ({ name, size, type, lastModified });

const tx = (patch: Partial<ProposedTransaction>): ProposedTransaction => ({
  type: 'DEPOSIT',
  amount: 100,
  fees: 0,
  description: '',
  date: '2026-09-01',
  ...patch,
});

describe('addImportFiles', () => {
  it('accepts up to five supported documents', () => {
    const picked = ['a.pdf', 'b.png', 'c.jpg', 'd.csv', 'e.xlsx'].map((name) => file(name));
    const { files, rejected } = addImportFiles([], picked);
    expect(files.map((f) => f.name)).toEqual(['a.pdf', 'b.png', 'c.jpg', 'd.csv', 'e.xlsx']);
    expect(rejected).toEqual([]);
  });

  it('adds to the current selection and rejects what exceeds the limit', () => {
    const current = ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'].map((name) => file(name));
    const { files, rejected } = addImportFiles(current, [file('e.pdf'), file('f.pdf')]);
    expect(files).toHaveLength(MAX_IMPORT_FILES);
    expect(rejected).toEqual([{ name: 'f.pdf', reason: 'too_many' }]);
  });

  it('ignores a document already selected, an unsupported format and an oversized file', () => {
    const current = [file('releve.pdf', 500, 'application/pdf', 7)];
    const { files, rejected } = addImportFiles(current, [
      file('releve.pdf', 500, 'application/pdf', 7),
      file('notes.docx'),
      file('scan.png', MAX_IMPORT_FILE_BYTES + 1, 'image/png'),
    ]);
    expect(files).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual(['duplicate', 'unsupported_format', 'too_large']);
  });

  it('keeps two different files that share a name', () => {
    const { files } = addImportFiles([file('IMG_0001.jpg', 10, 'image/jpeg', 1)], [file('IMG_0001.jpg', 20, 'image/jpeg', 2)]);
    expect(files).toHaveLength(2);
  });
});

describe('describeRejectedFiles', () => {
  it('explains each rejection in French', () => {
    expect(describeRejectedFiles([])).toBeNull();
    expect(describeRejectedFiles([{ name: 'f.pdf', reason: 'too_many' }, { name: 'n.docx', reason: 'unsupported_format' }]))
      .toBe(`f.pdf : ${MAX_IMPORT_FILES} documents maximum par import · n.docx : format non pris en charge`);
  });
});

describe('mergeParsedDocuments', () => {
  it('concatenates rows in selection order and remembers their source', () => {
    const merged = mergeParsedDocuments([
      { filename: 'janvier.pdf', transactions: [tx({ amount: 1 }), tx({ amount: 2 })], notes: [] },
      { filename: 'fevrier.pdf', transactions: [tx({ amount: 3 })], notes: [] },
    ]);
    expect(merged.rows.map((r) => r.amount)).toEqual([1, 2, 3]);
    expect(merged.rowSources).toEqual(['janvier.pdf', 'janvier.pdf', 'fevrier.pdf']);
  });

  it('prefixes notes with the document and shifts their row to the merged index', () => {
    const merged = mergeParsedDocuments([
      { filename: 'a.pdf', transactions: [tx({}), tx({})], notes: [{ code: 'x', message: 'Date ambiguë', row: 1 }] },
      { filename: 'b.png', transactions: [tx({})], notes: [{ code: 'y', message: 'Ligne illisible', row: 0 }, { code: 'z', message: 'Global' }] },
    ]);
    expect(merged.notes).toEqual([
      { code: 'x', message: 'a.pdf — Date ambiguë', row: 1 },
      { code: 'y', message: 'b.png — Ligne illisible', row: 2 },
      { code: 'z', message: 'b.png — Global', row: undefined },
    ]);
  });

  it('leaves notes untouched for a single document', () => {
    const merged = mergeParsedDocuments([
      { filename: 'a.pdf', transactions: [tx({})], notes: [{ code: 'x', message: 'Date ambiguë', row: 0 }] },
    ]);
    expect(merged.notes).toEqual([{ code: 'x', message: 'Date ambiguë', row: 0 }]);
  });
});

describe('findInBatchDuplicates', () => {
  it('points a repeated row to its first occurrence', () => {
    const rows = [
      tx({ type: 'BUY', amount: 500, stock_symbol: 'CW8.PA', quantity: 1, price_per_unit: 500 }),
      tx({ amount: 200 }),
      tx({ type: 'BUY', amount: 500, stock_symbol: 'cw8.pa', quantity: 1, price_per_unit: 500 }),
      tx({ amount: 200, currency: 'EUR' }),
    ];
    const duplicates = findInBatchDuplicates(rows, 'acc', 'EUR');
    expect([...duplicates.entries()]).toEqual([[2, 0], [3, 1]]);
  });

  it('does not flag rows that differ by date, currency or quantity', () => {
    const rows = [
      tx({ amount: 200 }),
      tx({ amount: 200, date: '2026-09-02' }),
      tx({ amount: 200, currency: 'USD' }),
      tx({ type: 'BUY', amount: 500, stock_symbol: 'SU.PA', quantity: 2, price_per_unit: 250 }),
      tx({ type: 'BUY', amount: 500, stock_symbol: 'SU.PA', quantity: 4, price_per_unit: 125 }),
    ];
    expect(findInBatchDuplicates(rows, 'acc', 'EUR').size).toBe(0);
  });
});
