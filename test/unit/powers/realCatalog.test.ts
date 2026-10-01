import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../scripts/build-catalog';

const EXPECTED = ['tdd', 'systematic-debugging', 'verification', 'grill-me', 'prototype', 'research', 'domain-modeling', 'code-review', 'codebase-design', 'poteto-mode'];

const EXPECTED_MCP: Record<string, string[]> = {
  context7: ['sdd-context7'],
  'microsoft-learn': ['sdd-mslearn'],
  'aws-docs': ['sdd-awsdocs'],
  'github-mcp': ['sdd-github'],
  'playwright-mcp': ['sdd-playwright'],
  aws: ['sdd-aws'],
  azure: ['sdd-azure'],
};

describe('catálogo real (powers/)', () => {
  it('todos los Powers pasan el guardián y están los esperados', () => {
    const { catalog, errors } = buildCatalog(join(__dirname, '../../../powers'));
    expect(errors).toEqual([]);
    expect(catalog.powers.map((p) => p.id).sort()).toEqual([...EXPECTED, ...Object.keys(EXPECTED_MCP)].sort());
  });

  it('los Powers con MCP traen sus servidores, versiones fijadas y modo Operar solo en GitHub y la nube', () => {
    const { catalog } = buildCatalog(join(__dirname, '../../../powers'));
    const withMcp = catalog.powers.filter((p) => p.mcp);
    expect(Object.fromEntries(withMcp.map((p) => [p.id, Object.keys(p.mcp!.servers)]))).toEqual(EXPECTED_MCP);
    expect(withMcp.filter((p) => p.mcp!.operate).map((p) => p.id).sort()).toEqual(['aws', 'azure', 'github-mcp']);
    expect(withMcp.filter((p) => p.mcp!.beta).map((p) => p.id)).toEqual(['azure']);
    const text = JSON.stringify(withMcp.map((p) => p.mcp));
    for (const pin of ['@playwright/mcp@0.0.83', 'awslabs.aws-documentation-mcp-server@1.2.2', 'awslabs.aws-api-mcp-server@1.5.6', '@azure/mcp@3.0.0-beta.48']) {
      expect(text).toContain(pin);
    }
    expect(text).not.toContain('@latest');
  });

  it('el modo por defecto es de solo lectura y Operar se distingue', () => {
    const { catalog } = buildCatalog(join(__dirname, '../../../powers'));
    type Srv = { url?: string; env?: Record<string, string>; args?: string[] };
    const mcp = (id: string) => {
      const m = catalog.powers.find((p) => p.id === id)!.mcp!;
      return {
        def: Object.values(m.servers)[0] as Srv,
        op: Object.values(m.operate!.servers)[0] as Srv,
      };
    };
    const gh = mcp('github-mcp');
    expect(gh.def.url).toMatch(/\/mcp\/readonly$/);
    expect(gh.op.url).toBe('https://api.githubcopilot.com/mcp/');
    const aws = mcp('aws');
    expect(aws.def.env).toMatchObject({ READ_OPERATIONS_ONLY: 'true' });
    expect(aws.op.env).not.toHaveProperty('READ_OPERATIONS_ONLY');
    expect(aws.op.env).toMatchObject({ REQUIRE_MUTATION_CONSENT: 'true' });
    const az = mcp('azure');
    expect(az.def.args).toContain('--read-only');
    expect(az.op.args).not.toContain('--read-only');
  });
});
