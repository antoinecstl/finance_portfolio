import type { Transaction, TransactionType } from './types';

type OrderedTransactionFields = Pick<Transaction, 'date' | 'type' | 'created_at' | 'id'>;

export function transactionSameDayPriority(type: TransactionType): number {
  switch (type) {
    case 'DEPOSIT':
    case 'DIVIDEND':
    case 'INTEREST':
    case 'SELL':
      return 0;
    case 'CONVERSION':
      return 1;
    case 'WITHDRAWAL':
    case 'BUY':
    case 'FEE':
      return 2;
    default:
      return 3;
  }
}

// Stable chronological replay order shared by validation, positions and charts.
export function compareTransactionSequence(
  a: OrderedTransactionFields,
  b: OrderedTransactionFields
): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);

  const priorityDelta =
    transactionSameDayPriority(a.type) - transactionSameDayPriority(b.type);
  if (priorityDelta !== 0) return priorityDelta;

  const createdDelta = (a.created_at ?? '').localeCompare(b.created_at ?? '');
  if (createdDelta !== 0) return createdDelta;

  return a.id.localeCompare(b.id);
}
