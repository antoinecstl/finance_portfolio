import { z } from 'zod';

// Schémas Zod centralisés pour valider les inputs côté API ET côté formulaire.
// Le même schéma est importé des deux côtés : contrat unique = zéro dérive.

export const accountTypeSchema = z.enum([
  'PEA', 'LIVRET_A', 'LDDS', 'CTO', 'ASSURANCE_VIE', 'PEL', 'AUTRE',
]);

export const transactionTypeSchema = z.enum([
  'DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE',
]);

// Un symbole Yahoo Finance est alphanumérique + points/tirets (ex. "AAPL", "MC.PA", "BRK-B").
// Limite à 15 char pour laisser de la marge (symboles européens ~6-7 char).
// Volontairement strict (mirror des contraintes DB transactions_stock_symbol_format /
// stock_positions_symbol_format) : pas de `^` ici car on ne stocke pas d'indices.
export const stockSymbolSchema = z
  .string()
  .trim()
  .min(1, 'Symbole requis')
  .max(15, 'Symbole trop long')
  .regex(/^[A-Za-z0-9.\-]+$/, 'Symbole invalide (A-Z, 0-9, . et - uniquement)')
  .transform((s) => s.toUpperCase());

// Schéma plus permissif réservé aux lookups Yahoo (cours, historique, benchmarks).
// Accepte un préfixe `^` optionnel pour les indices (^FCHI, ^GSPC, ^NDX, ...).
// À NE PAS utiliser pour les transactions/positions persistées en BDD.
export const stockLookupSymbolSchema = z
  .string()
  .trim()
  .min(1, 'Symbole requis')
  .max(15, 'Symbole trop long')
  .regex(/^\^?[A-Za-z0-9.\-]+$/, 'Symbole invalide (A-Z, 0-9, ^ en tête, . et - autorisés)')
  .transform((s) => s.toUpperCase());

export const stockHistoryIntervalSchema = z.enum(['1d', '1wk', '1mo']);

export function parseStockSymbolList(
  value: string,
  max = 50
): { success: true; symbols: string[] } | { success: false; error: string } {
  const rawSymbols = value.split(',').map((s) => s.trim()).filter(Boolean);

  if (rawSymbols.length === 0) {
    return { success: false, error: 'At least one symbol is required' };
  }

  if (rawSymbols.length > max) {
    return { success: false, error: `Maximum ${max} symbols allowed per request` };
  }

  const symbols: string[] = [];
  for (const raw of rawSymbols) {
    const parsed = stockLookupSymbolSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: `Invalid symbol: ${raw}` };
    }
    symbols.push(parsed.data);
  }

  return { success: true, symbols: Array.from(new Set(symbols)) };
}

// ISO date YYYY-MM-DD. Refuse les dates du futur lointain et antérieures à 1970.
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu: YYYY-MM-DD')
  .refine((d) => {
    const ts = Date.parse(d);
    if (Number.isNaN(ts)) return false;
    const year = Number(d.slice(0, 4));
    return year >= 1970 && year <= 2100;
  }, 'Date hors plage [1970, 2100]');

// ISO currency 3 lettres majuscules (EUR, USD, GBP).
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Code devise ISO 4217 requis (ex: EUR, USD)')
  .default('EUR');

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(100, 'Nom trop long'),
  type: accountTypeSchema,
  currency: currencySchema.optional(),
  // Surcharge optionnelle. Si omis, le défaut du type s'applique côté client via le helper.
  // Stocké tel quel : NULL = pas de surcharge.
  supports_positions: z.boolean().nullable().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// Transaction : montants positifs (le signe est déterminé par le type de transaction).
// Les frais peuvent être 0 ou positifs.
export const createTransactionSchema = z
  .object({
    account_id: z.string().uuid('Compte invalide'),
    type: transactionTypeSchema,
    amount: z.number().positive('Le montant doit être > 0').finite(),
    fees: z.number().nonnegative().finite().optional(),
    description: z.string().max(500, 'Description trop longue').optional(),
    date: isoDateSchema,
    stock_symbol: stockSymbolSchema.optional(),
    quantity: z.number().positive('Quantité > 0 requise').finite().optional(),
    price_per_unit: z.number().positive('Prix unitaire > 0 requis').finite().optional(),
  })
  // Pour BUY/SELL : symbole, quantité et prix unitaire sont obligatoires.
  .refine(
    (v) => (v.type === 'BUY' || v.type === 'SELL')
      ? Boolean(v.stock_symbol && v.quantity && v.price_per_unit)
      : true,
    {
      message: 'BUY/SELL requièrent stock_symbol, quantity, et price_per_unit',
      path: ['stock_symbol'],
    }
  )
  .refine(
    (v) => v.type === 'DIVIDEND' ? Boolean(v.stock_symbol) : true,
    {
      message: 'DIVIDEND requiert stock_symbol',
      path: ['stock_symbol'],
    }
  );
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const createPositionSchema = z.object({
  account_id: z.string().uuid('Compte invalide'),
  symbol: stockSymbolSchema,
  name: z.string().trim().min(1, 'Nom requis').max(255),
  quantity: z.number().positive('Quantité > 0 requise').finite(),
  average_price: z.number().positive('Prix > 0 requis').finite(),
  currency: currencySchema.optional(),
  sector: z.string().trim().max(100).nullish(),
});
export type CreatePositionInput = z.infer<typeof createPositionSchema>;

export const deleteAccountSchema = z.object({
  confirmName: z.string().trim().min(1),
});

// Pagination cursor : encodé en base64 JSON côté serveur, opaque côté client.
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

// Helper : formate les erreurs Zod en message lisible pour l'API.
export function formatZodError(error: z.ZodError): { error: string; issues: Array<{ path: string; message: string }> } {
  return {
    error: 'invalid_payload',
    issues: error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  };
}
