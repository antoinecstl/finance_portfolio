import { z } from 'zod';
import { isoDateSchema, transactionTypeSchema } from '@/lib/schemas';

// Paramètres partagés par l'API REST (/api/v1) et les outils MCP.

export const positionsQuerySchema = z.object({
  account_id: z.uuid().optional(),
});

export const transactionsQuerySchema = z
  .object({
    account_id: z.uuid().optional(),
    type: transactionTypeSchema.optional(),
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9.\-^=]{1,20}$/, 'Symbole invalide')
      .optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().max(500).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'from doit être antérieure ou égale à to',
    path: ['from'],
  });

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

/** Lit les paramètres d'URL non vides en objet simple, pour les passer à Zod. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    if (value !== '') result[key] = value;
  });
  return result;
}
