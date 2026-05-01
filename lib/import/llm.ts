// Abstraction LLMProvider : permet de remplacer OpenAI par Gemini/Anthropic/Mistral
// sans toucher au code métier. Le contrat est minimal : extraire des transactions
// normalisées depuis du texte ou un tableau.
//
// Sélection : env LLM_PROVIDER (défaut "openai"). LLM_MODEL surcharge le modèle par défaut.

import OpenAI from 'openai';
import type { LLMExtractionInput, ProposedTransaction, ImportNote } from './types';

export interface LLMExtractionResult {
  transactions: ProposedTransaction[];
  detectedFormat: string;       // utilisé pour traçabilité (ex: "llm:gpt-4o-mini")
  notes: ImportNote[];
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  extractTransactions(input: LLMExtractionInput): Promise<LLMExtractionResult>;
}

// Schéma JSON envoyé à OpenAI Structured Outputs : garantit que la réponse
// a exactement la forme attendue (pas de parsing best-effort).
const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['transactions', 'notes'],
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'amount', 'fees', 'description', 'date', 'stock_symbol', 'quantity', 'price_per_unit'],
        properties: {
          type: {
            type: 'string',
            enum: ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE'],
          },
          amount: { type: 'number', description: 'Montant absolu en EUR (toujours positif). Le signe est porté par le type.' },
          fees: { type: 'number', description: 'Frais associés en EUR. 0 si aucun.' },
          description: { type: 'string', description: 'Libellé original ou reformulé (max 500 char).' },
          date: { type: 'string', description: 'Date au format ISO YYYY-MM-DD.' },
          stock_symbol: {
            type: ['string', 'null'],
            description: 'Symbole Yahoo Finance pour BUY/SELL/DIVIDEND. Null sinon. Utiliser .PA pour Euronext Paris (ex: MC.PA), .DE pour Xetra, etc.',
          },
          quantity: { type: ['number', 'null'], description: 'Nombre de titres (BUY/SELL uniquement). Null sinon.' },
          price_per_unit: { type: ['number', 'null'], description: 'Prix unitaire EUR (BUY/SELL uniquement). Null sinon.' },
        },
      },
    },
    notes: {
      type: 'array',
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
      description: 'Lignes ignorées, ambiguïtés détectées, hypothèses faites par le modèle.',
    },
  },
} as const;

const SYSTEM_PROMPT = `Tu es un assistant qui extrait des transactions financières structurées depuis des relevés de courtiers, banques ou exports CSV/Excel.

Sources possibles : CSV/Excel tabulaire, texte brut, ou PDF (relevé bancaire, avis d'opéré broker, extrait de compte). Pour les PDF, le fichier brut peut t'être attaché : si le texte extrait paraît tronqué, désordonné ou vide, lis directement la version visuelle du document.

Règles d'extraction :
- type : mappe précisément vers DEPOSIT (versement de cash, virement entrant), WITHDRAWAL (retrait, virement sortant), BUY (achat de titre), SELL (vente de titre), DIVIDEND, INTEREST, FEE.
- amount : montant absolu positif en EUR. Convertis si la devise est USD/GBP en utilisant un taux raisonnable, et signale-le dans notes.
- fees : frais associés à la transaction (commissions de courtage, droits de garde). 0 si non précisé.
- date : YYYY-MM-DD strict. Si la date est ambigüe (DD/MM vs MM/DD), choisis le format européen DD/MM/YYYY par défaut, et signale-le dans notes.
- stock_symbol : pour BUY/SELL/DIVIDEND uniquement. Utilise les suffixes Yahoo Finance (.PA, .DE, .L, .MI, .SW). Null sinon.
- quantity, price_per_unit : pour BUY/SELL uniquement. Si le document ne donne pas la quantité (relevés bancaires "ACHAT ACTION X" sans détail), laisse les deux à null mais conserve le montant. Sinon calcule price_per_unit = (amount - fees) / quantity.
- description : conserve le libellé original tronqué à 500 char.

Reconnaissance des relevés bancaires français :
- "ACHAT ACTION <NOM>" / "ACHAT TITRE" → BUY ; "VENTE ACTION <NOM>" / "VENTE TITRE" → SELL.
- Le code ISIN (FR..., US..., NL..., DE..., LU..., IE...) figure souvent sur la ligne suivante du libellé. Convertis-le en ticker Yahoo Finance que tu connais (ex: FR0000121014 → MC.PA, FR0000120271 → TTE.PA, NL0000235190 → AIR.PA, US5949181045 → MSFT, US0378331005 → AAPL). Si l'ISIN est inconnu, mets stock_symbol à null et signale-le dans notes.
- Colonnes Débit/Crédit : Débit → BUY/WITHDRAWAL/FEE, Crédit → SELL/DEPOSIT/DIVIDEND/INTEREST. Le solde n'est PAS une transaction.
- "FRAIS DE COURTAGE", "DROITS DE GARDE", "COMMISSION" → FEE.
- "VIREMENT", "VRT" entrant → DEPOSIT ; sortant → WITHDRAWAL.
- "COUPON", "DIVIDENDE" → DIVIDEND.

Notes : remonte toute ligne ignorée (avec row index 0-based si tabulaire), toute hypothèse faite, toute conversion de devise, tout ISIN non reconnu. Sois honnête sur l'incertitude.

Sois exhaustif : extrais TOUTES les lignes d'opération du tableau, pas seulement les premières. Ne renvoie un tableau vide que si le document ne contient réellement aucune transaction (ex: page de garde, conditions générales). N'invente jamais de transaction.`;

function buildUserPrompt(input: LLMExtractionInput): string {
  const hint = input.hint ? `\n\nIndice contextuel : ${input.hint}` : '';
  if (input.kind === 'tabular') {
    const headers = input.headers ?? [];
    const rows = input.rows ?? [];
    const sample = rows.slice(0, 200).map((r, i) => `[row ${i}] ${JSON.stringify(r)}`).join('\n');
    const truncated = rows.length > 200 ? `\n\n(... ${rows.length - 200} lignes supplémentaires non envoyées)` : '';
    return `Format : tabulaire (CSV/Excel).
En-têtes : ${JSON.stringify(headers)}
Lignes (${rows.length} au total) :
${sample}${truncated}${hint}

Extrais toutes les transactions visibles.`;
  }
  const text = input.text ?? '';
  const MAX = 80_000;
  const truncated = text.length > MAX ? text.slice(0, MAX) + '\n[... contenu tronqué ...]' : text;
  const trimmed = truncated.trim();
  if (input.pdfBuffer) {
    const textBlock = trimmed.length > 0
      ? `Texte extrait par la couche PDF (peut être bruité, désordonné ou partiel — le rendu visuel fait foi) :
"""
${truncated}
"""`
      : `La couche texte du PDF est vide (document scanné ou rendu en image). Lis directement le PDF visuellement.`;
    return `Format : PDF (le fichier est attaché à ce message).${hint}

${textBlock}

Extrais TOUTES les transactions du tableau du PDF (chaque ligne d'opération = une transaction). Si le tableau a 10 lignes, renvoie 10 transactions. Ne te limite pas au texte extrait s'il paraît incomplet.`;
  }
  return `Format : texte libre (collé).${hint}

Contenu :
"""
${truncated}
"""

Extrais toutes les transactions visibles.`;
}

class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async extractTransactions(input: LLMExtractionInput): Promise<LLMExtractionResult> {
    // Si on a un buffer PDF, on le passe en file input à OpenAI : gpt-4o-mini et
    // gpt-4.1 supportent les PDF natifs (vision + texte intégré). C'est la voie
    // robuste pour les PDF-image / scans dont la couche texte est vide.
    const userPrompt = buildUserPrompt(input);
    const userContent = input.pdfBuffer
      ? ([
          { type: 'text', text: userPrompt },
          {
            type: 'file',
            file: {
              filename: input.hint && input.hint.toLowerCase().endsWith('.pdf') ? input.hint : 'document.pdf',
              file_data: `data:application/pdf;base64,${input.pdfBuffer.toString('base64')}`,
            },
          },
        ] as OpenAI.Chat.Completions.ChatCompletionContentPart[])
      : userPrompt;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'transaction_extraction',
          strict: true,
          schema: EXTRACTION_JSON_SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('llm_empty_response');
    }
    const parsed = JSON.parse(content) as {
      transactions: ProposedTransaction[];
      notes: ImportNote[];
    };
    return {
      transactions: parsed.transactions ?? [],
      notes: parsed.notes ?? [],
      detectedFormat: `llm:${this.model}`,
    };
  }
}

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;

  const provider = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY manquant : configure-le dans .env.local pour activer l\'import intelligent.');
    }
    const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';
    cached = new OpenAIProvider(apiKey, model);
    return cached;
  }

  // Note d'extension : pour ajouter Gemini/Anthropic/Mistral, implémente LLMProvider
  // ici et branche-le sur la valeur correspondante de LLM_PROVIDER. Aucun autre
  // fichier n'a besoin de changer (le reste du code consomme l'interface).
  throw new Error(`LLM_PROVIDER inconnu : "${provider}". Valeurs supportées : "openai".`);
}

// Helper de tests : permet d'injecter un mock provider.
export function __setLLMProviderForTesting(p: LLMProvider | null): void {
  cached = p;
}
