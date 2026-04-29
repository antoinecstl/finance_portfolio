import type { Transaction, TransactionType } from './types';

// Tolérances de comparaison numérique. Volontairement larges côté `amount`
// (1 cent) car les imports peuvent ajouter/perdre une décimale ; serrées sur
// `quantity` car les ratios fractionnaires d'actions sont précis à 4 décimales.
const AMOUNT_EPSILON = 0.01;
const PRICE_EPSILON = 0.01;
const QUANTITY_EPSILON = 0.0001;

export interface DuplicateCandidate {
  type: TransactionType;
  date: string; // YYYY-MM-DD
  amount: number;
  stock_symbol?: string | null;
  quantity?: number | null;
  price_per_unit?: number | null;
}

export interface FindDuplicateOptions {
  accountId: string;
  // Quand on édite (futur usage) : exclut la transaction en cours de la
  // comparaison pour ne pas se matcher soi-même.
  excludeId?: string;
}

// Renvoie la première transaction existante qui ressemble fortement à la
// candidate, ou null. La similarité considère :
//   - même compte
//   - même type
//   - même date (jour calendaire YYYY-MM-DD)
//   - même montant à 1 cent près
//   - même ticker (case-insensitive) si la candidate en porte un
//   - pour BUY/SELL : même quantité et même prix unitaire à epsilon près
// Les lignes FEE rattachées à une autre tx (via fee_transaction_id) sont
// ignorées : elles ne sont pas saisies directement par l'utilisateur, donc
// inclure leur match créerait des faux-positifs sur les imports successifs.
export function findDuplicateTransaction(
  candidate: DuplicateCandidate,
  existing: Transaction[],
  opts: FindDuplicateOptions
): Transaction | null {
  const candidateSymbol = candidate.stock_symbol
    ? candidate.stock_symbol.toUpperCase()
    : null;
  const isStockMove =
    candidate.type === 'BUY' || candidate.type === 'SELL';

  // Set des FEE-children à ignorer : repérés par leur id présent dans le
  // fee_transaction_id d'une autre ligne du même utilisateur.
  const childFeeIds = new Set<string>();
  for (const t of existing) {
    if (t.fee_transaction_id) childFeeIds.add(t.fee_transaction_id);
  }

  for (const tx of existing) {
    if (opts.excludeId && tx.id === opts.excludeId) continue;
    if (tx.account_id !== opts.accountId) continue;
    if (childFeeIds.has(tx.id)) continue;
    if (tx.type !== candidate.type) continue;
    if (tx.date !== candidate.date) continue;
    if (Math.abs(Number(tx.amount) - candidate.amount) > AMOUNT_EPSILON) continue;

    const txSymbol = tx.stock_symbol ? tx.stock_symbol.toUpperCase() : null;
    if (candidateSymbol && txSymbol !== candidateSymbol) continue;
    // Si la candidate n'a pas de symbole mais l'existante en porte un (cas
    // type changé en cash), on rejette le match : transactions différentes.
    if (!candidateSymbol && txSymbol) continue;

    if (isStockMove) {
      const candidateQty = candidate.quantity ?? 0;
      const candidatePrice = candidate.price_per_unit ?? 0;
      const txQty = Number(tx.quantity ?? 0);
      const txPrice = Number(tx.price_per_unit ?? 0);
      if (Math.abs(txQty - candidateQty) > QUANTITY_EPSILON) continue;
      if (Math.abs(txPrice - candidatePrice) > PRICE_EPSILON) continue;
    }

    return tx;
  }

  return null;
}
