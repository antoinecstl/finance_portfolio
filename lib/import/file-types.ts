import type { ImportSourceType } from './types';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function detectImportSourceType(
  filename: string,
  contentType: string | null
): ImportSourceType | null {
  const lower = filename.toLowerCase();
  const mime = contentType?.toLowerCase().split(';', 1)[0].trim() ?? '';

  if (lower.endsWith('.csv') || mime === 'text/csv') return 'csv';
  if (
    lower.endsWith('.xlsx')
    || lower.endsWith('.xls')
    || mime === 'application/vnd.ms-excel'
    || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'xlsx';
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (
    IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))
    || (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)
  ) return 'image';

  return null;
}

export function resolveImageMimeType(filename: string, contentType?: string): string {
  const mime = contentType?.toLowerCase().split(';', 1)[0].trim();
  if (mime && (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return mime;

  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
