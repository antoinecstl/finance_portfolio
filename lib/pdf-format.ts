const HIGH_PRECISION_CURRENCY_CODES = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'DOT', 'AVAX', 'MATIC',
  'USDC', 'USDT', 'BUSD', 'DAI',
]);

const PDF_UNSAFE_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' '],
  [/[\u2010-\u2015\u2212]/g, '-'],
  [/\u20ac/g, 'EUR'],
  [/\u00d7/g, 'x'],
  [/\u2026/g, '...'],
  [/[\u2018\u2019\u201a\u201b]/g, "'"],
  [/[\u201c\u201d\u201e\u201f]/g, '"'],
  [/[\u00b7\u2022]/g, '-'],
  [/\u2192/g, '->'],
  [/\u2190/g, '<-'],
  [/\uFEFF/g, ''],
];

export function toPdfText(value: unknown): string {
  let text = String(value ?? '').normalize('NFC');

  for (const [pattern, replacement] of PDF_UNSAFE_TEXT_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/[^\S\r\n]+/g, ' ').trim();
}

export function formatPdfNumber(num: number, decimals: number = 2): string {
  return toPdfText(new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num));
}

export function formatPdfCurrency(amount: number, currency: string = 'EUR'): string {
  const normalizedCurrency = (currency || 'EUR').toUpperCase();
  const decimals =
    amount !== 0 &&
    Math.abs(amount) < 1 &&
    (!/^[A-Z]{3}$/.test(normalizedCurrency) || HIGH_PRECISION_CURRENCY_CODES.has(normalizedCurrency))
      ? 8
      : 2;

  return `${formatPdfNumber(amount, decimals)} ${toPdfText(normalizedCurrency)}`;
}

export function formatPdfCurrencyBreakdown(
  buckets: Record<string, number> | undefined,
  fallbackCurrency: string = 'EUR'
): string {
  const entries = Object.entries(buckets ?? {})
    .filter(([, amount]) => Math.abs(amount) > 0.0001)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return formatPdfCurrency(0, fallbackCurrency);
  }

  return entries
    .map(([currency, amount]) => formatPdfCurrency(amount, currency))
    .join(' + ');
}
