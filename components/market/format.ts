import { formatCurrency } from '@/lib/utils';

const NBSP = ' ';

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const body = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value * 100));
  return `${sign}${body}${NBSP}%`;
}

export function fmtPrice(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  // Indices : des points, toujours avec deux décimales.
  if (currency === 'pts') return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}${NBSP}pts`;
  if (!currency) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
  // Moins d'un centime (variation d'un ETF à 5 €, crypto à 0,00001 $) : deux chiffres significatifs plutôt que « 0,00 ».
  if (value !== 0 && Math.abs(value) < 0.01 && /^[A-Z]{3}$/.test(currency.toUpperCase())) {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase(), maximumSignificantDigits: 2 }).format(value);
    } catch {
      // devise inconnue d'Intl : format générique ci-dessous
    }
  }
  return formatCurrency(value, currency);
}

export function fmtCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function changeClass(value: number | null | undefined): string {
  if (!value) return 'text-[color:var(--ink-soft)]';
  return value > 0 ? 'text-[color:var(--gain)]' : 'text-[color:var(--loss)]';
}

export function marketHref(symbol: string): string {
  return `/marches/${encodeURIComponent(symbol)}`;
}

export function instrumentLabel(type: string): string {
  switch (type) {
    case 'EQUITY': return 'Action';
    case 'ETF': return 'ETF';
    case 'INDEX': return 'Indice';
    case 'CRYPTOCURRENCY': return 'Crypto';
    case 'MUTUALFUND': return 'Fonds';
    case 'CURRENCY': return 'Devise';
    default: return type ? type.charAt(0) + type.slice(1).toLowerCase() : '';
  }
}

/** Multiple de valorisation : « 18,4 × ». */
export function fmtMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}${NBSP}×`;
}

/** Pourcentage sans signe « + » (marges, rendements, parts). */
export function fmtShare(value: number | null | undefined, digits = 1): string {
  return fmtPct(value, digits).replace('+', '');
}

/** Montant abrégé avec devise : « 12,3 Md € ». */
export function fmtMoneyCompact(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch {
    return `${fmtCompact(value)} ${currency}`.trim();
  }
}
