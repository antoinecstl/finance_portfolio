// Spécification OpenAPI 3.1 de l'API publique Fi-Hub, consommable telle quelle
// par les "Actions" des GPT personnalisés de ChatGPT et tout client OpenAPI.

const money = { type: 'number', description: 'Montant en EUR' } as const;
const nullablePercent = { type: ['number', 'null'], description: 'Pourcentage (null si non calculable)' } as const;

const accountSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['PEA', 'CTO', 'LIVRET_A', 'LDDS', 'ASSURANCE_VIE', 'PEL', 'CRYPTO', 'AUTRE'] },
    currency: { type: 'string' },
    supports_positions: { type: 'boolean', description: 'Compte titres (positions) ou compte épargne' },
    value: money,
    cash: money,
    cash_by_currency: { type: 'object', additionalProperties: { type: 'number' }, description: 'Liquidités par devise, en devise native' },
    positions_value: money,
    positions_count: { type: 'integer' },
    weight_percent: { type: 'number', description: 'Poids dans le patrimoine total (%)' },
  },
} as const;

const positionSchema = {
  type: 'object',
  properties: {
    account_id: { type: 'string', format: 'uuid' },
    account_name: { type: 'string' },
    symbol: { type: 'string', description: 'Ticker Yahoo Finance (ex. AI.PA, AAPL, BTC-EUR)' },
    name: { type: 'string' },
    quantity: { type: 'number' },
    cost_currency: { type: 'string', description: 'Devise du PRU' },
    average_price: { type: 'number', description: 'Prix de revient unitaire (PRU), en cost_currency' },
    quote_currency: { type: 'string' },
    price: { type: ['number', 'null'], description: 'Dernier cours en quote_currency (null si indisponible)' },
    price_is_live: { type: 'boolean', description: 'false si la valorisation retombe sur le PRU faute de cours' },
    cost_basis: money,
    value: money,
    unrealized_gain: money,
    unrealized_gain_percent: nullablePercent,
    day_change: money,
    day_change_percent: nullablePercent,
    weight_percent: { type: 'number', description: 'Poids dans les positions (%)' },
  },
} as const;

const errorResponse = {
  description: 'Erreur',
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' }, message: { type: 'string' } } },
    },
  },
} as const;

const commonErrors = {
  '401': { ...errorResponse, description: 'Jeton manquant, invalide, expiré ou révoqué' },
  '429': { ...errorResponse, description: 'Trop de requêtes (60/min par jeton)' },
} as const;

export function buildOpenApiSpec(serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Fi-Hub API',
      version: '1.0.0',
      description:
        "API en lecture seule du patrimoine d'un utilisateur Fi-Hub : comptes (PEA, CTO, livrets, assurance-vie…), positions boursières valorisées et historique des transactions. Montants en EUR sauf mention contraire. Authentification par jeton personnel créé dans Fi-Hub > Paramètres > Accès API.",
    },
    servers: [{ url: serverUrl }],
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/me': {
        get: {
          operationId: 'getProfile',
          summary: "Profil du propriétaire du jeton (email, offre)",
          responses: {
            '200': {
              description: 'Profil',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      email: { type: ['string', 'null'] },
                      plan: { type: 'string', enum: ['free', 'pro'] },
                      base_currency: { type: 'string' },
                      token_scopes: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            ...commonErrors,
          },
        },
      },
      '/api/v1/portfolio': {
        get: {
          operationId: 'getPortfolio',
          summary: 'Synthèse complète du patrimoine : totaux, comptes et positions valorisés au dernier cours',
          responses: {
            '200': {
              description: 'Portefeuille',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      base_currency: { type: 'string' },
                      as_of: { type: 'string', format: 'date-time' },
                      totals: {
                        type: 'object',
                        properties: {
                          total_value: { ...money, description: 'Patrimoine total' },
                          positions_value: { ...money, description: 'Valeur des positions boursières' },
                          investment_cash: { ...money, description: 'Liquidités des comptes titres' },
                          savings_value: { ...money, description: 'Épargne (livrets, PEL…)' },
                          cost_basis: { ...money, description: 'Montant investi (PRU × quantité)' },
                          unrealized_gain: { ...money, description: 'Plus-value latente' },
                          unrealized_gain_percent: nullablePercent,
                          day_change: { ...money, description: 'Variation du jour des positions' },
                          day_change_percent: nullablePercent,
                        },
                      },
                      accounts: { type: 'array', items: accountSchema },
                      positions: { type: 'array', items: positionSchema },
                    },
                  },
                },
              },
            },
            ...commonErrors,
          },
        },
      },
      '/api/v1/accounts': {
        get: {
          operationId: 'listAccounts',
          summary: 'Liste des comptes avec leur valeur, leurs liquidités et leur poids',
          responses: {
            '200': {
              description: 'Comptes',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      base_currency: { type: 'string' },
                      as_of: { type: 'string', format: 'date-time' },
                      items: { type: 'array', items: accountSchema },
                    },
                  },
                },
              },
            },
            ...commonErrors,
          },
        },
      },
      '/api/v1/positions': {
        get: {
          operationId: 'listPositions',
          summary: 'Positions ouvertes : quantité, PRU, cours, valeur, plus-value latente',
          parameters: [
            { name: 'account_id', in: 'query', required: false, schema: { type: 'string', format: 'uuid' }, description: 'Filtrer sur un compte' },
          ],
          responses: {
            '200': {
              description: 'Positions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      base_currency: { type: 'string' },
                      as_of: { type: 'string', format: 'date-time' },
                      items: { type: 'array', items: positionSchema },
                    },
                  },
                },
              },
            },
            '400': errorResponse,
            ...commonErrors,
          },
        },
      },
      '/api/v1/transactions': {
        get: {
          operationId: 'listTransactions',
          summary: 'Historique des transactions, du plus récent au plus ancien, filtrable et paginé',
          parameters: [
            { name: 'account_id', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
            {
              name: 'type', in: 'query', required: false,
              schema: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'CONVERSION'] },
            },
            { name: 'symbol', in: 'query', required: false, schema: { type: 'string' }, description: 'Ticker de la position' },
            { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date' }, description: 'Date de début incluse (YYYY-MM-DD)' },
            { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date' }, description: 'Date de fin incluse (YYYY-MM-DD)' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' }, description: 'Valeur next_cursor de la page précédente' },
          ],
          responses: {
            '200': {
              description: 'Transactions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            account_id: { type: 'string', format: 'uuid' },
                            type: { type: 'string' },
                            date: { type: 'string', format: 'date' },
                            time: { type: ['string', 'null'] },
                            amount: { type: 'number', description: 'Montant en devise native (currency)' },
                            currency: { type: 'string' },
                            stock_symbol: { type: ['string', 'null'] },
                            quantity: { type: ['number', 'null'] },
                            price_per_unit: { type: ['number', 'null'] },
                            target_amount: { type: ['number', 'null'] },
                            target_currency: { type: ['string', 'null'] },
                            description: { type: ['string', 'null'] },
                          },
                        },
                      },
                      next_cursor: { type: ['string', 'null'] },
                    },
                  },
                },
              },
            },
            '400': errorResponse,
            ...commonErrors,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Jeton personnel Fi-Hub (fih_...)' },
      },
    },
  };
}
