import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${formatNumber(num, 2)}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PEA: 'PEA',
    LIVRET_A: 'Livret A',
    LDDS: 'LDDS',
    CTO: 'Compte-Titres',
    ASSURANCE_VIE: 'Assurance Vie',
    PEL: 'PEL',
    AUTRE: 'Autre',
  };
  return labels[type] || type;
}

export function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEPOSIT: 'Dépôt',
    WITHDRAWAL: 'Retrait',
    BUY: 'Achat',
    SELL: 'Vente',
    DIVIDEND: 'Dividende',
    INTEREST: 'Intérêts',
    FEE: 'Frais',
  };
  return labels[type] || type;
}

export function getTransactionColor(type: string): string {
  const colors: Record<string, string> = {
    DEPOSIT: 'text-green-600',
    WITHDRAWAL: 'text-red-600',
    BUY: 'text-blue-600',
    SELL: 'text-orange-600',
    DIVIDEND: 'text-green-600',
    INTEREST: 'text-green-600',
    FEE: 'text-red-600',
  };
  return colors[type] || 'text-gray-600';
}

// Couleurs pour les graphiques de répartition
export const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
];

export function getSectorColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
