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
        required: [
          'type', 'amount', 'fees', 'description', 'date',
          'stock_symbol', 'quantity', 'price_per_unit',
          'currency', 'target_amount', 'target_currency',
        ],
        properties: {
          type: {
            type: 'string',
            enum: ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'CONVERSION'],
          },
          amount: { type: 'number', description: 'Montant absolu positif dans la devise native (champ currency). Le signe est porté par le type.' },
          fees: { type: 'number', description: 'Frais dans la même devise que amount/currency. Si le document indique des frais dans une AUTRE devise, mets 0 et signale cette devise dans notes.' },
          description: { type: 'string', description: 'Libellé original ou reformulé (max 500 char).' },
          date: { type: 'string', description: 'Date au format ISO YYYY-MM-DD.' },
          stock_symbol: {
            type: ['string', 'null'],
            description: 'Symbole Yahoo Finance pour BUY/SELL/DIVIDEND. Null sinon. Actions: .PA (Paris), .DE (Xetra), .L (Londres). Crypto: BTC-USD, ETH-USD, SOL-USD (jamais de paire stable -USDC, mappée sur -USD). Null pour CONVERSION.',
          },
          quantity: { type: ['number', 'null'], description: 'Nombre de titres / quantité de crypto (BUY/SELL uniquement). Null sinon.' },
          price_per_unit: { type: ['number', 'null'], description: 'Prix unitaire dans la devise native (BUY/SELL uniquement). Null sinon.' },
          currency: {
            type: 'string',
            description: 'Code devise du montant (3-10 majuscules). Préserve la devise NATIVE du document : EUR, USD, USDC, USDT, GBP, etc. Ne convertis JAMAIS toi-même. Si non précisée, retombe sur la devise du compte fournie en hint.',
          },
          target_amount: {
            type: ['number', 'null'],
            description: 'CONVERSION uniquement : montant crédité dans la devise cible (ex: 1085 si 1000 EUR donnent 1085 USDC). Null pour tous les autres types.',
          },
          target_currency: {
            type: ['string', 'null'],
            description: 'CONVERSION uniquement : code devise cible (3-10 majuscules), différent de currency. Null pour tous les autres types.',
          },
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

const SYSTEM_PROMPT = `Tu es un assistant qui extrait des transactions financières structurées depuis des exports CSV/Excel ou du texte collé. (Les PDF sont traités séparément par un OCR document-aware en amont — tu ne les vois jamais ici.)

Règles d'extraction :
- type : DEPOSIT (versement cash entrant), WITHDRAWAL (retrait/virement sortant), BUY (achat titre/crypto), SELL (vente titre/crypto), DIVIDEND, INTEREST, FEE, CONVERSION (échange de devises explicite, ex: EUR→USDC, USD→EUR).
- amount : montant absolu positif **dans la devise native du document**. Ne convertis JAMAIS toi-même en EUR ou autre devise — la conversion réelle est faite par le système avec le taux du marché. Signale dans notes si la devise est ambiguë.
- currency : code 3-10 majuscules (EUR, USD, GBP, USDC, USDT, BUSD, BTC, ETH...). Préserve la devise NATIVE telle qu'elle apparaît dans le document. Si non explicite, retombe sur la devise du compte fournie en hint et signale-le.
- fees : frais associés, **dans la même devise que amount**. 0 si non précisé. Si les frais sont dans une autre devise (ex: amount en USDC, frais en SOL), mets fees=0 et signale-le dans notes : le champ fees ne peut pas représenter une autre devise.
- date : YYYY-MM-DD strict. Si la date est lisible en format européen courant (DD-MM-YY ou DD/MM/YYYY), convertis-la sans note. Signale seulement une ambiguïté réelle (ex: 03/04/24 sans contexte).
- stock_symbol : pour BUY/SELL/DIVIDEND uniquement. Actions Yahoo (.PA, .DE, .L, .MI, .SW). Crypto Yahoo : -USD (BTC-USD, ETH-USD, SOL-USD) — même si l'exchange affiche -USDC ou -USDT, mappe-le sur -USD car c'est le ticker Yahoo standard et signale la devise réelle dans currency. Null sinon (et toujours null pour CONVERSION).
- quantity, price_per_unit : pour BUY/SELL uniquement. price_per_unit dans la devise native (currency), calculée = (amount - fees) / quantity si non donnée explicitement.
- target_amount, target_currency : **uniquement** pour type=CONVERSION. amount = montant débité (devise source), target_amount = montant crédité (devise cible). Ex : EUR→USDC pour 1000 EUR → 1085 USDC : { type: CONVERSION, amount: 1000, currency: EUR, target_amount: 1085, target_currency: USDC }. target_currency doit être différent de currency. Null pour tous les autres types.
- description : conserve le libellé original tronqué à 500 char.

Reconnaissance des relevés bancaires français :
- "ACHAT ACTION <NOM>" / "ACHAT TITRE" → BUY ; "VENTE ACTION <NOM>" / "VENTE TITRE" → SELL.
- Le code ISIN (FR..., US..., NL..., DE..., LU..., IE...) figure souvent sur la ligne suivante du libellé. Convertis-le en ticker Yahoo Finance que tu connais (ex: FR0000121014 → MC.PA, FR0000120271 → TTE.PA, NL0000235190 → AIR.PA, US5949181045 → MSFT, US0378331005 → AAPL). Si l'ISIN est inconnu, mets stock_symbol à null et signale-le dans notes.
- Colonnes Débit/Crédit : Débit → BUY/WITHDRAWAL/FEE, Crédit → SELL/DEPOSIT/DIVIDEND/INTEREST. Le solde n'est PAS une transaction.
- "FRAIS DE COURTAGE", "DROITS DE GARDE", "COMMISSION" → FEE.
- "VIREMENT", "VRT" entrant → DEPOSIT ; sortant → WITHDRAWAL (note : un VIREMENT EUR→USD ou un échange de devise explicite serait CONVERSION).
- "COUPON", "DIVIDENDE" → DIVIDEND.
- "ÉCHANGE", "CONVERSION", "CHANGE EUR/USD", "CONVERT" → CONVERSION.

Reconnaissance des relevés crypto (Binance, Kraken, Coinbase) :
- Colonnes "Pair / Market" type "SOLUSDC", "BTCUSDC" : BUY/SELL d'actif sur compte crypto. stock_symbol = ticker Yahoo (SOL-USD, BTC-USD), currency = devise réelle (USDC). amount/price_per_unit en USDC.
- Pair devise↔devise/stable type "EURUSDC", "USDEUR", "USDCUSDT", "EURUSDT" : type=CONVERSION, stock_symbol=null, quantity=null, price_per_unit=null. N'utilise JAMAIS "-USD" comme ticker par défaut. Pour une paire Binance BASEQUOTE : côté SELL = BASE débité, QUOTE crédité ; côté BUY = QUOTE débité, BASE crédité. amount = montant débité, currency = devise débitée, target_amount = montant crédité, target_currency = devise créditée.
- "Buy Crypto" / "Sell Crypto" depuis fiat (EUR→BTC en une étape) : émets une CONVERSION (EUR→USDC implicite ou EUR→BTC selon le doc) puis si pertinent un BUY. Si le doc fusionne les deux, traite-le comme une seule CONVERSION pour préserver le taux réel.
- Frais payés dans une crypto ou autre devise (BNB, SOL, USDC...) différente de currency : mets fees=0 et signale la devise/le montant dans notes.

Notes : remonte les lignes ignorées, les données non représentables (ex: frais dans une autre devise), les ISIN/tickers non reconnus et les ambiguïtés réelles. Ne crée pas de note pour une devise explicitement visible dans le montant, ni pour une date DD-MM-YY clairement convertible.

Sois exhaustif : extrais TOUTES les lignes d'opération du tableau, pas seulement les premières. Ne renvoie un tableau vide que si le document ne contient réellement aucune transaction (ex: page de garde, conditions générales). N'invente jamais de transaction.`;

function buildUserPrompt(input: LLMExtractionInput): string {
  const hint = input.hint ? `\n\nIndice contextuel : ${input.hint}` : '';
  const currencyHint = input.accountCurrency
    ? `\n\nDevise par défaut du compte cible : ${input.accountCurrency} (utilise-la uniquement si la devise n'est pas explicite dans le document).`
    : '';
  if (input.kind === 'tabular') {
    const headers = input.headers ?? [];
    const rows = input.rows ?? [];
    const sample = rows.slice(0, 200).map((r, i) => `[row ${i}] ${JSON.stringify(r)}`).join('\n');
    const truncated = rows.length > 200 ? `\n\n(... ${rows.length - 200} lignes supplémentaires non envoyées)` : '';
    return `Format : tabulaire (CSV/Excel).
En-têtes : ${JSON.stringify(headers)}
Lignes (${rows.length} au total) :
${sample}${truncated}${hint}${currencyHint}

Extrais toutes les transactions visibles.`;
  }
  const text = input.text ?? '';
  const MAX = 80_000;
  const truncated = text.length > MAX ? text.slice(0, MAX) + '\n[... contenu tronqué ...]' : text;
  return `Format : texte libre (collé).${hint}${currencyHint}

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
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
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
    const model = process.env.LLM_MODEL ?? 'gpt-5.4-nano';
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
