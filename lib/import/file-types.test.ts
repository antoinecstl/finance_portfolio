import { describe, expect, it } from 'vitest';
import { detectImportSourceType, resolveImageMimeType } from './file-types';

describe('detectImportSourceType', () => {
  it.each([
    ['releve.jpg', '', 'image'],
    ['releve.JPEG', 'application/octet-stream', 'image'],
    ['capture.png', 'image/png', 'image'],
    ['capture.webp', 'image/webp', 'image'],
    ['upload', 'image/jpeg; charset=binary', 'image'],
    ['releve.pdf', 'application/pdf', 'pdf'],
    ['operations.csv', 'text/csv', 'csv'],
    ['operations.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ])('detects %s (%s) as %s', (filename, mime, expected) => {
    expect(detectImportSourceType(filename, mime)).toBe(expected);
  });

  it('rejects unsupported image formats', () => {
    expect(detectImportSourceType('capture.heic', 'image/heic')).toBeNull();
    expect(detectImportSourceType('notes.txt', 'text/plain')).toBeNull();
  });
});

describe('resolveImageMimeType', () => {
  it('uses a supported MIME type when supplied', () => {
    expect(resolveImageMimeType('upload', 'image/webp')).toBe('image/webp');
  });

  it('falls back to the file extension', () => {
    expect(resolveImageMimeType('CAPTURE.PNG', 'application/octet-stream')).toBe('image/png');
    expect(resolveImageMimeType('photo.jpg')).toBe('image/jpeg');
  });
});
