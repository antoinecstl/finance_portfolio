// Abstraction OCRProvider : extrait des transactions depuis un PDF en passant
// par un OCR document-aware (ici Mistral OCR). Contrat : un seul appel renvoie
// le ParseResult complet (transactions + notes + excerpt + format détecté).
//
// Pourquoi un provider distinct du LLMProvider :
// - Les PDF (souvent des scans / PDF-image) demandent un OCR, pas un LLM texte.
// - Mistral OCR avec document_annotation_format combine OCR + extraction
//   structurée en un seul appel, court-circuitant le pipeline pdfjs → LLM.
// - On garde l'abstraction (env OCR_PROVIDER) pour pouvoir brancher d'autres
//   moteurs OCR (Google Document AI, Azure Form Recognizer, etc.) sans toucher
//   au code métier.

import { z } from 'zod';
import { proposedTransactionSchema, importNoteSchema } from './types';
import type { ParseResult } from './types';

export interface OCRProvider {
  readonly name: string;
  readonly model: string;
  extractFromPDF(buffer: Buffer, filename?: string): Promise<ParseResult>;
}

// Schéma JSON envoyé en document_annotation_format. Mistral OCR applique le
// schéma directement pendant l'OCR — il n'y a pas de "system prompt" séparé,
// donc toute la guidance d'extraction tient dans les `description` de chaque
// champ. Strict mode : chaque clé de `properties` doit apparaître dans
// `required` (même contrainte qu'OpenAI structured outputs).
const OCR_EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['transactions', 'notes'],
  properties: {
    transactions: {
      type: 'array',
      description:
        "Une entrée par ligne d'opération du tableau. Inclus TOUTES les lignes (achats, ventes, virements, dividendes, frais). Le solde n'est PAS une transaction. Si le tableau a 10 lignes d'opérations, renvoie 10 transactions.",
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'amount',
          'fees',
          'description',
          'date',
          'stock_symbol',
          'quantity',
          'price_per_unit',
        ],
        properties: {
          type: {
            type: 'string',
            enum: ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE'],
            description:
              "ACHAT ACTION/TITRE → BUY. VENTE ACTION/TITRE → SELL. VIREMENT entrant → DEPOSIT, sortant → WITHDRAWAL. DIVIDENDE/COUPON → DIVIDEND. INTERETS → INTEREST. FRAIS DE COURTAGE / DROITS DE GARDE / COMMISSION → FEE.",
          },
          amount: {
            type: 'number',
            description:
              "Montant absolu positif en EUR. Si la devise originale est USD/GBP/CHF, convertis avec un taux raisonnable et signale-le dans notes.",
          },
          fees: {
            type: 'number',
            description: "Frais associés (commission, droits de garde). 0 si non précisé.",
          },
          description: {
            type: 'string',
            description:
              "Libellé original tronqué à 500 caractères. Conserve l'ISIN s'il figure sur la ligne.",
          },
          date: {
            type: 'string',
            description:
              "Date au format ISO YYYY-MM-DD strict. Format européen DD/MM/YYYY par défaut si ambigu.",
          },
          stock_symbol: {
            type: ['string', 'null'],
            description:
              "Pour BUY/SELL/DIVIDEND uniquement : ticker Yahoo Finance (suffixes .PA Euronext Paris, .DE Xetra, .L London, .MI Milan, .SW SIX). Convertis l'ISIN en ticker quand possible (ex: FR0000121014→MC.PA, FR0000120271→TTE.PA, NL0000235190→AIR.PA, US5949181045→MSFT, US0378331005→AAPL). Si l'ISIN est inconnu, mets null et signale-le dans notes. Null pour DEPOSIT/WITHDRAWAL/INTEREST/FEE.",
          },
          quantity: {
            type: ['number', 'null'],
            description:
              "Pour BUY/SELL uniquement : nombre de titres. Si le relevé bancaire ne le précise pas, laisse null. Null sinon.",
          },
          price_per_unit: {
            type: ['number', 'null'],
            description:
              "Pour BUY/SELL uniquement : prix unitaire EUR. Calcule (amount - fees) / quantity si quantity est connu, sinon null. Null pour les autres types.",
          },
        },
      },
    },
    notes: {
      type: 'array',
      description:
        "Toute remarque utile : ISIN non reconnu, conversion de devise, ligne ambigüe ignorée, hypothèse faite. row = numéro de ligne 0-based si pertinent, sinon null.",
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message', 'row'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          row: { type: ['integer', 'null'] },
        },
      },
    },
  },
} as const;

const annotationOutputSchema = z.object({
  transactions: z.array(proposedTransactionSchema),
  notes: z.array(importNoteSchema),
});

interface MistralOCRPage {
  index: number;
  markdown?: string;
}

interface MistralOCRResponse {
  pages?: MistralOCRPage[];
  model?: string;
  document_annotation?: string;
  usage_info?: { pages_processed?: number; doc_size_bytes?: number };
}

class MistralOCRProvider implements OCRProvider {
  readonly name = 'mistral';
  readonly model: string;
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey: string, model: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint ?? 'https://api.mistral.ai/v1/ocr';
  }

  async extractFromPDF(buffer: Buffer, filename?: string): Promise<ParseResult> {
    const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
    const requestBody = {
      model: this.model,
      document: {
        type: 'document_url',
        document_url: dataUrl,
        document_name: filename ?? 'document.pdf',
      },
      document_annotation_format: {
        type: 'json_schema',
        json_schema: {
          name: 'transaction_extraction',
          strict: true,
          schema: OCR_EXTRACTION_SCHEMA,
        },
      },
      include_image_base64: false,
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`mistral_ocr_${res.status}: ${errBody.slice(0, 500)}`);
    }

    const data = (await res.json()) as MistralOCRResponse;
    const markdown = (data.pages ?? [])
      .map((p) => p.markdown ?? '')
      .join('\n\n')
      .trim();
    const rawExcerpt = markdown.slice(0, 2000);
    const detectedFormat = `ocr:${data.model ?? this.model}`;

    if (!data.document_annotation) {
      // L'OCR a réussi mais aucune annotation structurée : on remonte un état
      // honnête (pas d'invention) avec le markdown pour audit.
      return {
        transactions: [],
        notes: [
          {
            code: 'OCR_NO_ANNOTATION',
            message:
              "Mistral OCR n'a renvoyé aucune annotation structurée. Vérifie que le document contient bien un tableau d'opérations.",
          },
        ],
        detectedFormat,
        rawExcerpt,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data.document_annotation);
    } catch (err) {
      throw new Error(`mistral_ocr_invalid_json: ${(err as Error).message}`);
    }

    const validated = annotationOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`mistral_ocr_schema_invalid: ${validated.error.message.slice(0, 300)}`);
    }

    return {
      transactions: validated.data.transactions,
      notes: validated.data.notes,
      detectedFormat,
      rawExcerpt,
    };
  }
}

let cached: OCRProvider | null = null;

export function getOCRProvider(): OCRProvider {
  if (cached) return cached;

  const provider = (process.env.OCR_PROVIDER ?? 'mistral').toLowerCase();
  if (provider === 'mistral') {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "MISTRAL_API_KEY manquant : configure-le dans .env.local pour activer l'extraction PDF par OCR."
      );
    }
    const model = process.env.OCR_MODEL ?? 'mistral-ocr-latest';
    cached = new MistralOCRProvider(apiKey, model);
    return cached;
  }

  // Pour ajouter un autre moteur OCR (Google Document AI, Azure...), implémente
  // OCRProvider et branche-le sur la valeur correspondante de OCR_PROVIDER.
  throw new Error(`OCR_PROVIDER inconnu : "${provider}". Valeurs supportées : "mistral".`);
}

// Helper de tests : permet d'injecter un mock provider.
export function __setOCRProviderForTesting(p: OCRProvider | null): void {
  cached = p;
}
