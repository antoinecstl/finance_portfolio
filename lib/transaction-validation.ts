import type { Transaction } from './types';

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

// Tuple used to stabilize ordering across transactions on the same date.
function orderKey(tx: Transaction): [string, string, string] {
  return [tx.date, tx.created_at ?? '', tx.id];
}

function cmpOrder(a: Transaction, b: Transaction): number {
  const [ad, ac, ai] = orderKey(a);
  const [bd, bc, bi] = orderKey(b);
  if (ad !== bd) return ad.localeCompare(bd);
  if (ac !== bc) return ac.localeCompare(bc);
  return ai.localeCompare(bi);
}

// Cash impact of a transaction on its account.
// Les frais sont portés par une ligne FEE séparée (liée via fee_transaction_id) :
// cette fonction n'en tient donc pas compte directement — elle verra la ligne FEE
// passer dans la séquence et la traitera comme un débit standard.
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
//   - cash (per account) never goes negative
//   - shares (per symbol within the account) never go negative
// `epsilon` absorbs floating-point rounding from amount / fees computed client-side.
export function simulateAccountSequence(
  txs: Transaction[],
  epsilon = 0.005
): ValidationResult {
  const ordered = [...txs].sort(cmpOrder);
  let cash = 0;
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
          reason: `Position insuffisante : ${symbol} descendrait à ${next.toFixed(4)} titres au ${tx.date}.`,
          offendingTxId: tx.id,
          offendingDate: tx.date,
        };
      }
      shares.set(symbol, next);
    }

    cash += cashDelta(tx);
    if (cash < -epsilon) {
      return {
        ok: false,
        code: 'cash_negative',
        reason: `Solde négatif (${cash.toFixed(2)} €) au ${tx.date} — la transaction ${tx.type} ${tx.id.slice(0, 8)} n'est plus finançable.`,
        offendingTxId: tx.id,
        offendingDate: tx.date,
      };
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
