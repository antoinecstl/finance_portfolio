import type { Transaction } from './types';
import { compareTransactionSequence } from './transaction-ordering';
import { formatCurrency, formatDate, formatNumber, getTransactionTypeLabel } from './utils';

export type ValidationFailure = {
  ok: false;
  reason: string;
  code:
    | 'cash_negative'
    | 'shares_negative'
    | 'orphan_sell'
    | 'orphan_dividend'
    | 'invalid_sell_order';
  offendingTxId?: string;
  offendingDate?: string;
};

export type ValidationSuccess = { ok: true };

export type ValidationResult = ValidationSuccess | ValidationFailure;

function formatSequenceDate(date: string): string {
  try {
    return formatDate(`${date}T00:00:00`);
  } catch {
    return date;
  }
}

function formatCashFailure(tx: Transaction, currency: string): string {
  const amount = Math.abs(cashDelta(tx));
  const label = getTransactionTypeLabel(tx.type).toLowerCase();
  return `Solde ${currency} insuffisant au ${formatSequenceDate(tx.date)}. Cette opération (${label} de ${formatCurrency(amount, currency)}) dépasserait le solde disponible à cette date.`;
}

function formatShareFailure(tx: Transaction, symbol: string): string {
  const quantity = Math.abs(sharesDelta(tx));
  return `Position ${symbol} insuffisante au ${formatSequenceDate(tx.date)}. Cette vente de ${formatNumber(quantity, 4)} titres dépasserait la quantité disponible à cette date.`;
}

// Cash impact of a transaction on its account, dans sa devise source.
// Les frais sont portés par une ligne FEE séparée (liée via fee_transaction_id) :
// cette fonction n'en tient donc pas compte directement. Elle verra la ligne FEE
// passer dans la séquence et la traitera comme un débit standard.
// CONVERSION : débit dans la devise source uniquement ; le crédit cible est
// appliqué séparément dans simulateAccountSequence.
export function cashDelta(tx: Transaction): number {
  const amount = Number(tx.amount) || 0;
  switch (tx.type) {
    case 'DEPOSIT':
    case 'DIVIDEND':
    case 'INTEREST':
    case 'SELL':
      return amount;
    case 'WITHDRAWAL':
    case 'BUY':
    case 'FEE':
    case 'CONVERSION':
      return -amount;
    default:
      return 0;
  }
}

// Share impact per (account_id, symbol).
export function sharesDelta(tx: Transaction): number {
  if (!tx.stock_symbol) return 0;
  const qty = Number(tx.quantity) || 0;
  if (tx.type === 'BUY') return qty;
  if (tx.type === 'SELL') return -qty;
  return 0;
}

// Replays the transactions of a single account chronologically and ensures:
//   - cash per (account, currency) never goes negative
//   - shares (per symbol within the account) never go negative
// `epsilon` absorbs floating-point rounding from amount / fees computed client-side.
export function simulateAccountSequence(
  txs: Transaction[],
  epsilon = 0.005
): ValidationResult {
  const ordered = [...txs].sort(compareTransactionSequence);
  const cashByCurrency = new Map<string, number>();
  const shares = new Map<string, number>();

  for (const tx of ordered) {
    // Share update happens first so a SELL that depletes BUY on same date is OK.
    if (tx.stock_symbol) {
      const symbol = tx.stock_symbol.toUpperCase();
      const current = shares.get(symbol) ?? 0;
      const next = current + sharesDelta(tx);
      if (next < -epsilon) {
        return {
          ok: false,
          code: tx.type === 'SELL' ? 'shares_negative' : 'orphan_sell',
          reason: formatShareFailure(tx, symbol),
          offendingTxId: tx.id,
          offendingDate: tx.date,
        };
      }
      shares.set(symbol, next);
    }

    const currency = (tx.currency ?? 'EUR').toUpperCase();
    const currentCash = cashByCurrency.get(currency) ?? 0;
    const nextCash = currentCash + cashDelta(tx);
    if (nextCash < -epsilon) {
      return {
        ok: false,
        code: 'cash_negative',
        reason: formatCashFailure(tx, currency),
        offendingTxId: tx.id,
        offendingDate: tx.date,
      };
    }
    cashByCurrency.set(currency, nextCash);

    // CONVERSION credits the target currency after the source debit.
    if (tx.type === 'CONVERSION' && tx.target_currency && tx.target_amount) {
      const targetCurrency = tx.target_currency.toUpperCase();
      const targetCurrent = cashByCurrency.get(targetCurrency) ?? 0;
      cashByCurrency.set(targetCurrency, targetCurrent + Number(tx.target_amount));
    }
  }

  return { ok: true };
}

// Checks whether a transaction can safely be deleted without creating impossible
// downstream states on its account.
export function validateDeletion(
  accountTransactions: Transaction[],
  txToDeleteId: string
): ValidationResult {
  const remaining = accountTransactions.filter((t) => t.id !== txToDeleteId);
  return simulateAccountSequence(remaining);
}
