import { decodeCursor, encodeCursor, type Cursor } from '@/lib/pagination';
import type { Transaction } from '@/lib/types';

// Champs exposés par l'API (ni user_id, ni colonnes techniques).
export function toPublicTransaction(tx: Transaction) {
  return {
    id: tx.id,
    account_id: tx.account_id,
    type: tx.type,
    date: tx.date,
    time: tx.time ?? null,
    amount: tx.amount,
    currency: tx.currency,
    stock_symbol: tx.stock_symbol ?? null,
    quantity: tx.quantity ?? null,
    price_per_unit: tx.price_per_unit ?? null,
    target_amount: tx.target_amount ?? null,
    target_currency: tx.target_currency ?? null,
    description: tx.description ?? null,
  };
}

/** Curseur opaque validé strictement (date, heure, uuid). */
export function decodeTransactionCursor(raw: string | undefined): Cursor | null {
  const cursor = decodeCursor(raw);
  if (!cursor) return null;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(cursor.date) &&
    /^\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(cursor.effective_time) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id);
  return valid ? cursor : null;
}

export function encodeTransactionCursor(tx: Transaction): string {
  return encodeCursor({ date: tx.date, effective_time: tx.effective_time ?? '00:00:00', id: tx.id });
}
