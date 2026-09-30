import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildOpenApiSpec } from './openapi';

describe('buildOpenApiSpec', () => {
  const spec = buildOpenApiSpec('https://fi-hub.subleet.com');

  it('declares bearer auth and the server url', () => {
    expect(spec.servers).toEqual([{ url: 'https://fi-hub.subleet.com' }]);
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('documents only routes that exist, each with a unique operationId', () => {
    const operationIds = new Set<string>();
    for (const [route, methods] of Object.entries(spec.paths)) {
      const file = path.join(process.cwd(), 'app', ...route.split('/').filter(Boolean), 'route.ts');
      expect(existsSync(file), `${route} → ${file}`).toBe(true);
      for (const operation of Object.values(methods)) {
        expect(operationIds.has(operation.operationId)).toBe(false);
        operationIds.add(operation.operationId);
      }
    }
    expect(operationIds.size).toBe(5);
  });
});
