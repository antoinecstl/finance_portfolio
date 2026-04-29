// Types et schémas Zod dédiés à la feature d'import.
// Le schéma final d'une transaction reste celui de lib/schemas.ts (source de vérité).
// Ces types décrivent le format intermédiaire entre extraction (parser/LLM) et validation finale.

import { z } from 'zod';
import { transactionTypeSchema } from '@/lib/schemas';

export type ImportSourceType = 'csv' | 'xlsx' | 'pdf' | 'text';

// Transaction normalisée proposée par un parseur (déclaratif ou LLM), avant validation Zod stricte.
// Les champs sont volontairement permissifs : la conversion en CreateTransactionInput se fait
// au moment du commit (et c'est là qu'on rejette les lignes invalides).
export const proposedTransactionSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().finite(),
  fees: z.number().finite().nonnegative().optional().default(0),
  description: z.string().max(500).optional().default(''),
  date: z.string(),                                 // YYYY-MM-DD attendu, validé au commit
  stock_symbol: z.string().nullable().optional(),
  quantity: z.number().finite().positive().nullable().optional(),
  price_per_unit: z.number().finite().positive().nullable().optional(),
});
export type ProposedTransaction = z.infer<typeof proposedTransactionSchema>;

export const importNoteSchema = z.object({
  code: z.string(),
  message: z.string(),
  row: z.number().int().nonnegative().optional(),
});
export type ImportNote = z.infer<typeof importNoteSchema>;

// Sortie d'un parseur (déclaratif ou LLM).
export interface ParseResult {
  transactions: ProposedTransaction[];
  detectedFormat: string;       // "boursorama" | "trade-republic" | "llm:gpt-4o-mini" | "manual"
  notes: ImportNote[];
  rawExcerpt: string;           // tronqué à ~2000 char pour audit
}

// Payload envoyé au LLM pour l'extraction. On garde le contexte minimum :
// - tabular : headers + lignes (chaque ligne = objet { header: value })
// - text/pdf : raw text tronqué
export interface LLMExtractionInput {
  kind: 'tabular' | 'text';
  headers?: string[];
  rows?: Array<Record<string, string>>;
  text?: string;
  hint?: string;                // ex: nom du fichier, indice broker
}

// Schémas pour les routes API.
export const parseRequestSchema = z.object({
  account_id: z.string().uuid('Compte invalide'),
});

export const commitRequestSchema = z.object({
  import_job_id: z.string().uuid(),
  account_id: z.string().uuid(),
  transactions: z.array(proposedTransactionSchema).min(1).max(5000),
});
export type CommitRequest = z.infer<typeof commitRequestSchema>;
