// Prix de revient unitaire (PRU) d'un titre à partir d'une suite d'achats et de
// ventes, selon la méthode du coût moyen pondéré utilisée par les courtiers
// français : un achat fait évoluer le PRU (frais inclus), une vente ne le
// change pas et dégage une plus ou moins-value par rapport à lui.

export interface PruOperation {
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees?: number;
}

export interface PruResult {
  /** Quantité encore détenue. */
  quantity: number;
  /** PRU frais inclus ; 0 si plus rien n'est détenu. */
  pru: number;
  /** Coût de revient des titres encore détenus (quantité × PRU). */
  cost: number;
  /** Plus ou moins-values réalisées sur les ventes, frais de vente déduits. */
  realizedGain: number;
  totalFees: number;
}

export type PruOutcome = { ok: true; result: PruResult } | { ok: false; error: string; row: number };

export function computePru(operations: PruOperation[]): PruOutcome {
  let quantity = 0;
  let cost = 0;
  let realizedGain = 0;
  let totalFees = 0;

  for (let row = 0; row < operations.length; row += 1) {
    const op = operations[row];
    const fees = op.fees ?? 0;
    if (!Number.isFinite(op.quantity) || op.quantity <= 0) return { ok: false, error: 'La quantité doit être supérieure à 0.', row };
    if (!Number.isFinite(op.price) || op.price <= 0) return { ok: false, error: 'Le prix doit être supérieur à 0.', row };
    if (!Number.isFinite(fees) || fees < 0) return { ok: false, error: 'Les frais ne peuvent pas être négatifs.', row };
    totalFees += fees;

    if (op.type === 'buy') {
      quantity += op.quantity;
      cost += op.quantity * op.price + fees;
      continue;
    }

    if (op.quantity > quantity + 1e-9) {
      return { ok: false, error: 'Cette vente porte sur plus de titres que vous n’en détenez à ce moment.', row };
    }
    const pru = quantity > 0 ? cost / quantity : 0;
    realizedGain += (op.price - pru) * op.quantity - fees;
    quantity -= op.quantity;
    cost = quantity > 1e-9 ? pru * quantity : 0;
    if (quantity <= 1e-9) quantity = 0;
  }

  return {
    ok: true,
    result: { quantity, pru: quantity > 0 ? cost / quantity : 0, cost, realizedGain, totalFees },
  };
}

/** Plus-value latente au cours indiqué ; null si rien n'est détenu. */
export function latentGain(result: PruResult, currentPrice: number): { value: number; gain: number; percent: number } | null {
  if (result.quantity <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  const value = result.quantity * currentPrice;
  const gain = value - result.cost;
  return { value, gain, percent: result.cost > 0 ? (gain / result.cost) * 100 : 0 };
}
