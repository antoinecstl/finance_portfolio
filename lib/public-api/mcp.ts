import { z } from 'zod';
import { PublicApiError } from './errors';
import { positionsQuerySchema, transactionsQuerySchema, type TransactionsQuery } from './schemas';

// Serveur MCP (Model Context Protocol) sans état, transport "Streamable HTTP" :
// chaque POST porte un message JSON-RPC 2.0 et reçoit sa réponse en JSON.
// Pas de session ni de flux SSE : tous les outils sont en lecture seule et rapides.

export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
const LATEST_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0];

export const MCP_SERVER_INFO = { name: 'fi-hub', title: 'Fi-Hub', version: '1.0.0' };

const INSTRUCTIONS =
  "Fi-Hub est une application française de suivi de patrimoine. Ces outils donnent un accès en lecture seule aux comptes (PEA, CTO, livrets, assurance-vie…), positions boursières et transactions de l'utilisateur. Les montants sont en EUR sauf mention *_native ou champ currency. Commencer par get_portfolio_summary pour une vue d'ensemble.";

export interface McpDataSource {
  getProfile(): Promise<unknown>;
  getPortfolio(): Promise<{ base_currency: string; as_of: string; totals: unknown; accounts: unknown[]; positions: Array<{ account_id: string }> }>;
  listTransactions(query: TransactionsQuery): Promise<unknown>;
}

interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: unknown, data: McpDataSource): Promise<unknown>;
}

const emptyInput = { type: 'object', properties: {}, additionalProperties: false };

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'get_portfolio_summary',
    title: 'Synthèse du patrimoine',
    description:
      'Patrimoine total, plus-value latente, variation du jour et liste des comptes valorisés (sans le détail des positions).',
    inputSchema: emptyInput,
    async run(_args, data) {
      const portfolio = await data.getPortfolio();
      return { base_currency: portfolio.base_currency, as_of: portfolio.as_of, totals: portfolio.totals, accounts: portfolio.accounts };
    },
  },
  {
    name: 'list_accounts',
    title: 'Comptes',
    description: 'Comptes (PEA, CTO, livrets, assurance-vie…) avec valeur, liquidités par devise et poids dans le patrimoine.',
    inputSchema: emptyInput,
    async run(_args, data) {
      const portfolio = await data.getPortfolio();
      return { base_currency: portfolio.base_currency, as_of: portfolio.as_of, items: portfolio.accounts };
    },
  },
  {
    name: 'list_positions',
    title: 'Positions',
    description:
      'Positions boursières ouvertes : quantité, PRU, dernier cours, valeur, plus-value latente et poids. Filtrable par compte.',
    inputSchema: {
      type: 'object',
      properties: { account_id: { type: 'string', format: 'uuid', description: 'Identifiant du compte (voir list_accounts)' } },
      additionalProperties: false,
    },
    async run(args, data) {
      const query = positionsQuerySchema.parse(args ?? {});
      const portfolio = await data.getPortfolio();
      const items = query.account_id
        ? portfolio.positions.filter((position) => position.account_id === query.account_id)
        : portfolio.positions;
      return { base_currency: portfolio.base_currency, as_of: portfolio.as_of, items };
    },
  },
  {
    name: 'list_transactions',
    title: 'Transactions',
    description:
      'Historique des transactions (dépôts, retraits, achats, ventes, dividendes, intérêts, frais, conversions), du plus récent au plus ancien. Paginé via next_cursor.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'CONVERSION'] },
        symbol: { type: 'string', description: 'Ticker (ex. AI.PA)' },
        from: { type: 'string', format: 'date', description: 'Date de début incluse (YYYY-MM-DD)' },
        to: { type: 'string', format: 'date', description: 'Date de fin incluse (YYYY-MM-DD)' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        cursor: { type: 'string', description: 'next_cursor de la page précédente' },
      },
      additionalProperties: false,
    },
    async run(args, data) {
      return data.listTransactions(transactionsQuerySchema.parse(args ?? {}));
    },
  },
  {
    name: 'get_profile',
    title: 'Profil',
    description: "Email et offre (free/pro) de l'utilisateur connecté.",
    inputSchema: emptyInput,
    async run(_args, data) {
      return data.getProfile();
    },
  },
];

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export const JSON_RPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (value as { method?: unknown }).method === 'string'
  );
}

/**
 * Traite un message JSON-RPC. Renvoie null pour une notification (pas d'id),
 * qui n'appelle pas de réponse.
 */
export async function handleMcpMessage(message: unknown, data: McpDataSource): Promise<JsonRpcResponse | null> {
  if (!isJsonRpcRequest(message)) {
    const id = (message as { id?: JsonRpcId } | null)?.id ?? null;
    return errorResponse(id, JSON_RPC_ERRORS.invalidRequest, 'Requête JSON-RPC 2.0 invalide');
  }

  const isNotification = message.id === undefined;
  if (isNotification) return null;
  const id = message.id ?? null;

  switch (message.method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion;
      const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(requested as (typeof MCP_PROTOCOL_VERSIONS)[number])
        ? (requested as string)
        : LATEST_PROTOCOL_VERSION;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS.map(({ name, title, description, inputSchema }) => ({
            name,
            title,
            description,
            inputSchema,
            annotations: { readOnlyHint: true, openWorldHint: false },
          })),
        },
      };
    case 'tools/call': {
      const name = message.params?.name;
      const tool = MCP_TOOLS.find((candidate) => candidate.name === name);
      if (!tool) return errorResponse(id, JSON_RPC_ERRORS.invalidParams, `Outil inconnu : ${String(name)}`);
      try {
        const result = await tool.run(message.params?.arguments, data);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
            isError: false,
          },
        };
      } catch (error) {
        // Erreur d'exécution : renvoyée au modèle (isError) pour qu'il corrige ses arguments.
        const text =
          error instanceof z.ZodError
            ? `Arguments invalides : ${error.issues.map((issue) => `${issue.path.join('.') || 'arguments'} ${issue.message}`).join(' ; ')}`
            : error instanceof PublicApiError
              ? error.message
              : 'Erreur interne, réessayez plus tard.';
        if (!(error instanceof z.ZodError) && !(error instanceof PublicApiError)) {
          console.error('[mcp] tool failed', name, error);
        }
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: true } };
      }
    }
    default:
      return errorResponse(id, JSON_RPC_ERRORS.methodNotFound, `Méthode non prise en charge : ${message.method}`);
  }
}
