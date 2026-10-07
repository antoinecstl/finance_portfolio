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
  if (!currency) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
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
