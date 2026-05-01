import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { parsePDF } from './parsers';

describe('parsePDF', () => {
  it('extracts text under Node without DOMMatrix being pre-defined', async () => {
    const doc = new jsPDF();
    doc.text('Achat AAPL 10 actions a 150 EUR', 10, 10);
    const buffer = Buffer.from(doc.output('arraybuffer'));

    const result = await parsePDF(buffer);

    expect(result.kind).toBe('text');
    expect(result.text).toContain('Achat AAPL');
  });
});
