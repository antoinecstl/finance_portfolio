import { afterEach, describe, expect, it, vi } from 'vitest';
import { runImportPipeline } from './orchestrator';
import { __setOCRProviderForTesting, OCRRateLimitError } from './ocr';
import { __setLLMProviderForTesting } from './llm';
import type { LLMProvider } from './llm';
import type { OCRProvider } from './ocr';

const tx = {
  type: 'BUY' as const,
  amount: 100,
  fees: 1,
  description: 'ACHAT ACTION LVMH',
  date: '2026-09-01',
  stock_symbol: 'MC.PA',
  quantity: 1,
  price_per_unit: 99,
  currency: 'EUR',
  target_amount: null,
  target_currency: null,
};

function ocrProvider(extractDocument: OCRProvider['extractDocument']): OCRProvider {
  return { name: 'mock-ocr', model: 'mock', extractDocument };
}

function llmProvider(extractTransactions: LLMProvider['extractTransactions']): LLMProvider {
  return { name: 'mock-llm', model: 'mock', extractTransactions };
}

describe('runImportPipeline visual documents', () => {
  afterEach(() => {
    __setOCRProviderForTesting(null);
    __setLLMProviderForTesting(null);
    vi.restoreAllMocks();
  });

  it('uses OCR when available', async () => {
    const llm = vi.fn();
    __setOCRProviderForTesting(ocrProvider(async () => ({
      transactions: [tx], notes: [], detectedFormat: 'ocr:mock', rawExcerpt: 'x',
    })));
    __setLLMProviderForTesting(llmProvider(llm));

    const result = await runImportPipeline({ sourceType: 'image', buffer: Buffer.from('img'), filename: 'a.png' });

    expect(result.detectedFormat).toBe('ocr:mock');
    expect(llm).not.toHaveBeenCalled();
  });

  it('falls back to the vision LLM when OCR is rate limited', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const llm = vi.fn<LLMProvider['extractTransactions']>(async () => ({
      transactions: [tx], notes: [], detectedFormat: 'llm:mock',
    }));
    __setOCRProviderForTesting(ocrProvider(async () => { throw new OCRRateLimitError(1000, 'capacity'); }));
    __setLLMProviderForTesting(llmProvider(llm));

    const result = await runImportPipeline({
      sourceType: 'image', buffer: Buffer.from('img'), filename: 'Image.jpg', contentType: 'image/jpeg',
    });

    expect(result.detectedFormat).toBe('llm:mock');
    expect(result.transactions).toHaveLength(1);
    expect(llm).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'document',
      document: expect.objectContaining({ mimeType: 'image/jpeg', filename: 'Image.jpg' }),
    }));
  });

  it('rethrows the OCR error when the fallback also fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ocrError = new OCRRateLimitError(1000, 'capacity');
    __setOCRProviderForTesting(ocrProvider(async () => { throw ocrError; }));
    __setLLMProviderForTesting(llmProvider(async () => { throw new Error('llm down'); }));

    await expect(runImportPipeline({
      sourceType: 'pdf', buffer: Buffer.from('pdf'), filename: 'releve.pdf',
    })).rejects.toBe(ocrError);
  });
});
