import { type ClassValue, clsx } from 'clsx';
import type { Account, AccountType } from './types';

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
    CRYPTO: 'Crypto',
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
    DEPOSIT: 'text-emerald-600',
    WITHDRAWAL: 'text-red-600',
    BUY: 'text-blue-600',
    SELL: 'text-violet-600',
    DIVIDEND: 'text-emerald-600',
    INTEREST: 'text-emerald-600',
    FEE: 'text-red-600',
  };
  return colors[type] || 'text-zinc-600';
}

// Couleurs pour les graphiques de répartition, alignées avec app/globals.css.
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
];

export function getSectorColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Défaut "peut détenir des positions" pour un type donné.
// PEA, CTO, ASSURANCE_VIE, CRYPTO → true. Livrets / PEL / AUTRE → false.
export function defaultSupportsPositions(type: AccountType): boolean {
  return type === 'PEA' || type === 'CTO' || type === 'ASSURANCE_VIE' || type === 'CRYPTO';
}

// Source de vérité unique pour savoir si un compte peut détenir des positions actions.
// Si `supports_positions` est explicitement défini en BDD, il prime.
// Sinon, fallback sur le défaut du type. Permet à un compte AUTRE d'être marqué éligible.
export function accountSupportsPositions(account: Pick<Account, 'type' | 'supports_positions'>): boolean {
  if (account.supports_positions === true || account.supports_positions === false) {
    return account.supports_positions;
  }
  return defaultSupportsPositions(account.type);
}

// Détection : un symbole est crypto si son suffixe -USD/-USDT/-EUR/-GBP/-BTC/-ETH
// correspond à une paire de quote Yahoo (ex: BTC-USD, ETH-USDT). Les actions
// utilisent des suffixes de bourse (.PA, .L, .DE, ...) qui ne matchent pas.
const CRYPTO_QUOTE_SUFFIXES = /-(USD|USDT|EUR|GBP|BTC|ETH)$/i;

export function isCryptoSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  return CRYPTO_QUOTE_SUFFIXES.test(symbol.trim());
}

// Compatibilité actif ↔ type de compte.
// CRYPTO n'accepte que des cryptos ; tous les autres types refusent les cryptos.
// Sans symbole (DEPOSIT/WITHDRAWAL/INTEREST/FEE), la transaction est toujours valide.
export function accountTypeAllowsAsset(
  accountType: AccountType,
  stockSymbol: string | null | undefined
): boolean {
  if (!stockSymbol) return true;
  const isCrypto = isCryptoSymbol(stockSymbol);
  if (accountType === 'CRYPTO') return isCrypto;
  return !isCrypto;
}

export function assetAccountMismatchMessage(accountType: AccountType): string {
  return accountType === 'CRYPTO'
    ? 'Un compte Crypto ne peut contenir que des actifs crypto (ex: BTC-USD).'
    : 'Les cryptos ne peuvent être ajoutées que dans un compte de type Crypto.';
}
