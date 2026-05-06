import type { Transaction, TransactionType } from './types';

type OrderedTransactionFields = Pick<
  Transaction,
  'date' | 'type' | 'created_at' | 'id' | 'time'
>;

// Heure synthétique pour les transactions sans heure explicite. Reproduit
// exactement la priorité par type historique :
//   priorité 0 (cash inflows) -> 06:00
//   priorité 1 (CONVERSION)   -> 12:00
//   priorité 2 (cash outflows) -> 18:00
//   priorité 3 (autre)         -> 23:00
// Synchronisé avec la colonne générée effective_time en BDD.
export function syntheticTimeForType(type: TransactionType): string {
  switch (type) {
    case 'DEPOSIT':
    case 'DIVIDEND':
    case 'INTEREST':
    case 'SELL':
      return '06:00:00';
    case 'CONVERSION':
      return '12:00:00';
    case 'WITHDRAWAL':
    case 'BUY':
    case 'FEE':
      return '18:00:00';
    default:
      return '23:00:00';
  }
}

// Heure effective utilisée pour le tri : valeur saisie si présente,
// sinon heure synthétique dérivée du type.
export function effectiveTime(tx: OrderedTransactionFields): string {
  const raw = tx.time;
  if (raw && raw.length > 0) {
    // Normalise HH:MM en HH:MM:00 pour des comparaisons lexicographiques sûres.
    return raw.length === 5 ? `${raw}:00` : raw;
  }
  return syntheticTimeForType(tx.type);
}

// Stable chronological replay order shared by validation, positions and charts.
// Same date -> effective_time -> created_at -> id.
export function compareTransactionSequence(
  a: OrderedTransactionFields,
  b: OrderedTransactionFields
): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);

  const timeDelta = effectiveTime(a).localeCompare(effectiveTime(b));
  if (timeDelta !== 0) return timeDelta;

  const createdDelta = (a.created_at ?? '').localeCompare(b.created_at ?? '');
  if (createdDelta !== 0) return createdDelta;

  return a.id.localeCompare(b.id);
}
