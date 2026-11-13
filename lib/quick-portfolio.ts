// Saisie rapide d'un portefeuille déjà constitué : l'utilisateur indique ses
// positions actuelles (titre, quantité, prix de revient) sans reconstituer
// l'historique. On en déduit les opérations qui donnent exactement cet état :
// un versement par devise (le montant investi, plus les liquidités éventuelles)
// puis un achat par titre, tous datés du même jour.
//
// Le PRU et la plus-value latente sont donc exacts. La performance de la
// période de départ inclut en revanche les gains accumulés avant cette date :
// pour une performance exacte, il faut l'historique (import ou saisie).

import { accountSupportsPositions, accountTypeAllowsAsset, assetAccountMismatchMessage } from './utils';
import type { Account } from './types';

export const QUICK_PORTFOLIO_MAX_ROWS = 30;

export interface QuickPositionInput {
  symbol: string;
  quantity: number;
  /** Prix de revient unitaire, dans la devise de cotation du titre. */
  averagePrice: number;
  /** Devise de cotation ; à défaut, celle du compte. */
  currency?: string | null;
}

export interface QuickPortfolioInput {
  positions: QuickPositionInput[];
  /** Liquidités non investies, dans la devise du compte. */
  cash?: number | null;
  date: string;
}

// Ligne acceptée par le RPC insert_transactions_batch.
export interface QuickPortfolioTransaction {
  type: 'DEPOSIT' | 'BUY';
  amount: number;
  fees: number;
  description: string;
  date: string;
  currency: string;
  stock_symbol: string | null;
  quantity: number | null;
  price_per_unit: number | null;
  target_amount: null;
  target_currency: null;
}

export type QuickPortfolioResult =
  | { ok: true; transactions: QuickPortfolioTransaction[]; symbols: string[] }
  | { ok: false; error: string; row?: number };

const round2 = (n: number) => Math.round(n * 100) / 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3,10}$/;

export function buildQuickPortfolio(
  account: Pick<Account, 'type' | 'currency' | 'supports_positions'>,
  input: QuickPortfolioInput
): QuickPortfolioResult {
  if (!ISO_DATE.test(input.date)) return { ok: false, error: 'Indiquez une date valide.' };
  if (!accountSupportsPositions(account)) {
    return { ok: false, error: 'Ce compte ne peut pas détenir de titres.' };
  }
  if (input.positions.length === 0) return { ok: false, error: 'Ajoutez au moins un titre.' };
  if (input.positions.length > QUICK_PORTFOLIO_MAX_ROWS) {
    return { ok: false, error: `${QUICK_PORTFOLIO_MAX_ROWS} titres au plus par saisie.` };
  }

  const cash = input.cash ?? 0;
  if (!Number.isFinite(cash) || cash < 0) {
    return { ok: false, error: 'Les liquidités doivent être un montant positif.' };
  }

  const accountCurrency = (account.currency || 'EUR').toUpperCase();
  const seen = new Set<string>();
  const buys: QuickPortfolioTransaction[] = [];
  const investedByCurrency = new Map<string, number>();

  for (let row = 0; row < input.positions.length; row += 1) {
    const position = input.positions[row];
    const symbol = position.symbol.trim().toUpperCase();
    if (!symbol) return { ok: false, error: 'Choisissez un titre dans la liste.', row };
    if (seen.has(symbol)) {
      return { ok: false, error: `${symbol} figure deux fois : regroupez-le sur une seule ligne.`, row };
    }
    seen.add(symbol);
    if (!accountTypeAllowsAsset(account.type, symbol)) {
      return { ok: false, error: assetAccountMismatchMessage(account.type), row };
    }
    if (!Number.isFinite(position.quantity) || position.quantity <= 0) {
      return { ok: false, error: `${symbol} : la quantité doit être supérieure à 0.`, row };
    }
    if (!Number.isFinite(position.averagePrice) || position.averagePrice <= 0) {
      return { ok: false, error: `${symbol} : le prix de revient doit être supérieur à 0.`, row };
    }
    const currency = (position.currency || accountCurrency).toUpperCase();
    if (!CURRENCY.test(currency)) return { ok: false, error: `${symbol} : devise invalide.`, row };

    const amount = round2(position.quantity * position.averagePrice);
    if (amount <= 0) return { ok: false, error: `${symbol} : montant trop faible.`, row };
    investedByCurrency.set(currency, round2((investedByCurrency.get(currency) ?? 0) + amount));
    buys.push({
      type: 'BUY',
      amount,
      fees: 0,
      description: `Position déjà détenue : ${position.quantity} x ${symbol}`,
      date: input.date,
      currency,
      stock_symbol: symbol,
      quantity: position.quantity,
      price_per_unit: position.averagePrice,
      target_amount: null,
      target_currency: null,
    });
  }

  // Les liquidités s'ajoutent au versement dans la devise du compte.
  if (cash > 0) {
    investedByCurrency.set(accountCurrency, round2((investedByCurrency.get(accountCurrency) ?? 0) + round2(cash)));
  }

  // Versements d'abord : chaque achat doit trouver les liquidités qui le financent.
  const deposits: QuickPortfolioTransaction[] = Array.from(investedByCurrency.entries()).map(([currency, amount]) => ({
    type: 'DEPOSIT',
    amount,
    fees: 0,
    description: 'Solde de départ (positions déjà détenues)',
    date: input.date,
    currency,
    stock_symbol: null,
    quantity: null,
    price_per_unit: null,
    target_amount: null,
    target_currency: null,
  }));

  return { ok: true, transactions: [...deposits, ...buys], symbols: Array.from(seen) };
}

/** Titres actuellement détenus (quantité nette positive), tous comptes confondus. */
export function heldSymbols(
  transactions: ReadonlyArray<{ type: string; stock_symbol?: string | null; quantity?: number | string | null }>
): Set<string> {
  const quantities = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.stock_symbol || (tx.type !== 'BUY' && tx.type !== 'SELL')) continue;
    const symbol = tx.stock_symbol.toUpperCase();
    const quantity = Number(tx.quantity) || 0;
    quantities.set(symbol, (quantities.get(symbol) ?? 0) + (tx.type === 'BUY' ? quantity : -quantity));
  }
  const held = new Set<string>();
  for (const [symbol, quantity] of quantities) {
    if (quantity > 1e-9) held.add(symbol);
  }
  return held;
}
