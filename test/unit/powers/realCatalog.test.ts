import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../scripts/build-catalog';

const EXPECTED = ['tdd', 'systematic-debugging', 'verification', 'grill-me', 'prototype', 'research', 'domain-modeling', 'code-review', 'codebase-design', 'poteto-mode'];

const EXPECTED_MCP: Record<string, string[]> = {
  context7: ['sdd-context7'],
  'microsoft-learn': ['sdd-mslearn'],
  'aws-docs': ['sdd-awsdocs'],
};

describe('catálogo real (powers/)', () => {
  it('todos los Powers pasan el guardián y están los esperados', () => {
    const { catalog, errors } = buildCatalog(join(__dirname, '../../../powers'));
    expect(errors).toEqual([]);
    expect(catalog.powers.map((p) => p.id).sort()).toEqual([...EXPECTED, ...Object.keys(EXPECTED_MCP)].sort());
  });

  it('los Powers con MCP traen sus servidores y versiones fijadas, sin @latest', () => {
    const { catalog } = buildCatalog(join(__dirname, '../../../powers'));
    const withMcp = catalog.powers.filter((p) => p.mcp);
    expect(Object.fromEntries(withMcp.map((p) => [p.id, Object.keys(p.mcp!.servers)]))).toEqual(EXPECTED_MCP);
    const text = JSON.stringify(withMcp.map((p) => p.mcp));
    expect(text).toContain('awslabs.aws-documentation-mcp-server@1.2.2');
    expect(text).not.toContain('@latest');
  });
});
