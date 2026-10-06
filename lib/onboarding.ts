// Tunnel d'onboarding des nouveaux utilisateurs : profil, premier compte,
// première opération, puis présentation de l'import (offre Pro, facultatif).
// Logique pure partagée par le composant (components/onboarding) et les tests.

import { accountSupportsPositions, accountTypeAllowsAsset, assetAccountMismatchMessage } from './utils';
import type { Account, AccountType } from './types';

export type OnboardingStep = 'profile' | 'account' | 'transaction' | 'import';

export const ONBOARDING_STEPS: ReadonlyArray<{ id: OnboardingStep; label: string }> = [
  { id: 'profile', label: 'Profil' },
  { id: 'account', label: 'Premier compte' },
  { id: 'transaction', label: 'Première opération' },
  { id: 'import', label: 'Pour aller plus loin' },
];

// Étape de reprise : un utilisateur qui recharge la page ou revient plus tard
// reprend là où il s'était arrêté, sans recréer ce qui existe déjà.
export function resolveOnboardingStep(state: {
  profileSaved: boolean;
  accountCount: number;
  transactionCount: number;
}): OnboardingStep {
  if (!state.profileSaved) return 'profile';
  if (state.accountCount === 0) return 'account';
  if (state.transactionCount === 0) return 'transaction';
  return 'import';
}

export const ONBOARDING_ACCOUNT_TYPES: ReadonlyArray<{
  type: AccountType;
  label: string;
  hint: string;
  defaultName: string;
}> = [
  { type: 'PEA', label: 'PEA', hint: 'Actions et ETF européens', defaultName: 'Mon PEA' },
  { type: 'CTO', label: 'Compte-titres', hint: 'Actions et ETF du monde entier', defaultName: 'Mon compte-titres' },
  { type: 'ASSURANCE_VIE', label: 'Assurance-vie', hint: 'Fonds euros et unités de compte', defaultName: 'Mon assurance-vie' },
  { type: 'LIVRET_A', label: 'Livret A', hint: 'Épargne disponible', defaultName: 'Mon Livret A' },
  { type: 'LDDS', label: 'LDDS', hint: 'Épargne disponible', defaultName: 'Mon LDDS' },
  { type: 'PEL', label: 'PEL', hint: 'Épargne logement', defaultName: 'Mon PEL' },
  { type: 'CRYPTO', label: 'Crypto', hint: 'Bitcoin, Ethereum…', defaultName: 'Mon portefeuille crypto' },
  { type: 'AUTRE', label: 'Autre', hint: 'Toute autre enveloppe', defaultName: 'Mon compte' },
];

export function defaultAccountName(type: AccountType): string {
  return ONBOARDING_ACCOUNT_TYPES.find((t) => t.type === type)?.defaultName ?? 'Mon compte';
}

export type FirstTransactionInput =
  | { kind: 'deposit'; amount: number; date: string; description?: string }
  | { kind: 'buy'; symbol: string; quantity: number; price: number; date: string; currency?: string | null };

// Corps envoyés à POST /api/transactions (un par appel, dans l'ordre).
export interface TransactionPayload {
  account_id: string;
  type: 'DEPOSIT' | 'BUY';
  amount: number;
  fees: number;
  description: string;
  date: string;
  currency: string;
  stock_symbol?: string;
  quantity?: number;
  price_per_unit?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Prépare la première opération du compte. Un achat sur un compte neuf
// s'accompagne du versement qui l'a financé (même jour, même montant) :
// sans lui, les liquidités du compte deviendraient négatives et l'achat
// serait refusé.
export function buildFirstTransactions(
  account: Pick<Account, 'id' | 'type' | 'currency' | 'supports_positions'>,
  input: FirstTransactionInput
): { ok: true; payloads: TransactionPayload[] } | { ok: false; error: string } {
  if (!ISO_DATE.test(input.date)) return { ok: false, error: 'Indiquez une date valide.' };
  const accountCurrency = (account.currency || 'EUR').toUpperCase();

  if (input.kind === 'deposit') {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: false, error: 'Le montant doit être supérieur à 0.' };
    }
    return {
      ok: true,
      payloads: [{
        account_id: account.id,
        type: 'DEPOSIT',
        amount: round2(input.amount),
        fees: 0,
        description: input.description?.trim() || 'Versement initial',
        date: input.date,
        currency: accountCurrency,
      }],
    };
  }

  if (!accountSupportsPositions(account)) {
    return { ok: false, error: 'Ce compte ne peut pas détenir de titres : ajoutez plutôt un versement.' };
  }
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) return { ok: false, error: 'Choisissez un titre dans la liste.' };
  if (!accountTypeAllowsAsset(account.type, symbol)) {
    return { ok: false, error: assetAccountMismatchMessage(account.type) };
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: 'La quantité doit être supérieure à 0.' };
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: 'Le prix unitaire doit être supérieur à 0.' };
  }

  const currency = (input.currency || accountCurrency).toUpperCase();
  const amount = round2(input.quantity * input.price);
  return {
    ok: true,
    payloads: [
      {
        account_id: account.id,
        type: 'DEPOSIT',
        amount,
        fees: 0,
        description: `Versement pour l’achat de ${symbol}`,
        date: input.date,
        currency,
      },
      {
        account_id: account.id,
        type: 'BUY',
        amount,
        fees: 0,
        description: `Achat ${input.quantity} x ${symbol}`,
        date: input.date,
        currency,
        stock_symbol: symbol,
        quantity: input.quantity,
        price_per_unit: input.price,
      },
    ],
  };
}
