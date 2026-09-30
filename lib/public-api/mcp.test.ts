import { describe, it, expect, vi } from 'vitest';
import { handleMcpMessage, MCP_TOOLS, type McpDataSource } from './mcp';
import { PublicApiError } from './errors';

function dataSource(overrides: Partial<McpDataSource> = {}): McpDataSource {
  return {
    getProfile: vi.fn(async () => ({ email: 'a@b.c', plan: 'pro' })),
    getPortfolio: vi.fn(async () => ({
      base_currency: 'EUR',
      as_of: '2026-09-30T10:00:00Z',
      totals: { total_value: 100 },
      accounts: [{ id: 'acc-1' }],
      positions: [{ account_id: 'acc-1', symbol: 'AI.PA' }, { account_id: 'acc-2', symbol: 'AAPL' }],
    })),
    listTransactions: vi.fn(async () => ({ items: [], next_cursor: null })),
    ...overrides,
  };
}

const call = (method: string, params?: Record<string, unknown>) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  ...(params ? { params } : {}),
});

describe('handleMcpMessage', () => {
  it('negotiates the protocol version on initialize', async () => {
    const known = await handleMcpMessage(call('initialize', { protocolVersion: '2025-03-26' }), dataSource());
    expect(known).toMatchObject({ result: { protocolVersion: '2025-03-26', serverInfo: { name: 'fi-hub' } } });

    const unknown = await handleMcpMessage(call('initialize', { protocolVersion: '1999-01-01' }), dataSource());
    expect(unknown).toMatchObject({ result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } } });
  });

  it('ignores notifications', async () => {
    expect(await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, dataSource())).toBeNull();
  });

  it('lists read-only tools', async () => {
    const response = await handleMcpMessage(call('tools/list'), dataSource());
    const tools = (response as { result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> } }).result.tools;
    expect(tools.map((tool) => tool.name)).toEqual(MCP_TOOLS.map((tool) => tool.name));
    expect(tools.every((tool) => tool.annotations.readOnlyHint)).toBe(true);
  });

  it('runs tools and returns structured content', async () => {
    const response = await handleMcpMessage(
      call('tools/call', { name: 'list_positions', arguments: { account_id: '11111111-1111-4111-8111-111111111111' } }),
      dataSource({
        getPortfolio: async () => ({
          base_currency: 'EUR',
          as_of: 'now',
          totals: {},
          accounts: [],
          positions: [{ account_id: '11111111-1111-4111-8111-111111111111' }, { account_id: 'other' }],
        }),
      })
    );
    const result = (response as { result: { structuredContent: { items: unknown[] }; isError: boolean; content: Array<{ text: string }> } }).result;
    expect(result.isError).toBe(false);
    expect(result.structuredContent.items).toHaveLength(1);
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });

  it('omits positions from the summary tool', async () => {
    const response = await handleMcpMessage(call('tools/call', { name: 'get_portfolio_summary' }), dataSource());
    const content = (response as { result: { structuredContent: Record<string, unknown> } }).result.structuredContent;
    expect(content).not.toHaveProperty('positions');
    expect(content).toHaveProperty('totals');
  });

  it('reports invalid arguments as tool errors', async () => {
    const response = await handleMcpMessage(
      call('tools/call', { name: 'list_transactions', arguments: { from: '2026-02-01', to: '2026-01-01' } }),
      dataSource()
    );
    expect(response).toMatchObject({ result: { isError: true } });
  });

  it('hides unexpected error details but exposes public ones', async () => {
    const failing = await handleMcpMessage(
      call('tools/call', { name: 'get_profile' }),
      dataSource({ getProfile: async () => { throw new Error('db password leaked'); } })
    );
    expect(JSON.stringify(failing)).not.toContain('leaked');

    const publicError = await handleMcpMessage(
      call('tools/call', { name: 'list_transactions', arguments: { cursor: 'x' } }),
      dataSource({ listTransactions: async () => { throw new PublicApiError('invalid_cursor', 'Curseur invalide'); } })
    );
    expect(JSON.stringify(publicError)).toContain('Curseur invalide');
  });

  it('returns JSON-RPC errors for unknown tools, methods and malformed messages', async () => {
    expect(await handleMcpMessage(call('tools/call', { name: 'delete_everything' }), dataSource())).toMatchObject({ error: { code: -32602 } });
    expect(await handleMcpMessage(call('resources/list'), dataSource())).toMatchObject({ error: { code: -32601 } });
    expect(await handleMcpMessage({ id: 3, method: 'ping' }, dataSource())).toMatchObject({ id: 3, error: { code: -32600 } });
  });
});
