import { afterEach, describe, expect, it, vi } from 'vitest';
import { MistralOCRProvider, OCRRateLimitError } from './ocr';

const validOCRResponse = {
  pages: [{ index: 0, markdown: 'Aucune transaction' }],
  model: 'test-model',
  document_annotation: JSON.stringify({ transactions: [], notes: [] }),
};

describe('MistralOCRProvider rate limits', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries a temporary 429 response before returning the OCR result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(Response.json(validOCRResponse));
    const provider = new MistralOCRProvider('test-key', 'test-model', 'https://ocr.test');

    const result = await provider.extractDocument(Buffer.from('image'), {
      sourceType: 'image', filename: 'statement.png', contentType: 'image/png',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.detectedFormat).toBe('ocr:test-model');
  });

  it('returns a typed error after bounded retries on a persistent 429', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 429, headers: { 'Retry-After': '0' } })
    );
    const provider = new MistralOCRProvider('test-key', 'test-model', 'https://ocr.test');

    await expect(provider.extractDocument(Buffer.from('pdf'), {
      sourceType: 'pdf', filename: 'statement.pdf',
    })).rejects.toBeInstanceOf(OCRRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
