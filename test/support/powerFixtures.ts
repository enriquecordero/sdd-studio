import { powerHash } from '../../src/powers/hash';
import type { McpSpec } from '../../src/powers/mcp/spec';
import { Catalog, CatalogPower, Presentation } from '../../src/powers/types';

export function presentation(over: Partial<Presentation> = {}): Presentation {
  return {
    displayName: 'Alpha',
    icon: '🧪',
    category: 'testing',
    summary: 'Resumen de prueba.',
    triggers: ['"implementa…"'],
    diagram: { kind: 'steps', nodes: [{ label: 'UNO', edge: 'luego' }, { label: 'DOS' }] },
    gets: ['Algo útil'],
    source: { repo: 'owner/repo', path: 'skills/alpha', commit: 'abc123', author: 'Autora', license: 'MIT' },
    ...over,
  };
}

export function power(
  id = 'alpha',
  files: Record<string, string> = { 'SKILL.md': `---\nname: ${id}\ndescription: Test skill\n---\nBody\n` },
  version = '1.0.0',
): CatalogPower {
  return { id, version, presentation: presentation({ displayName: id }), skillName: id, files, sha256: powerHash(files) };
}

export function catalog(powers: CatalogPower[], generatedAt = '2026-10-01T00:00:00.000Z'): Catalog {
  return { schemaVersion: 1, generatedAt, powers };
}

/** McpSpec válido de tipo "cloud": un servidor stdio con dos inputs y modo Operar. */
export function mcpSpec(over: Partial<McpSpec> = {}): McpSpec {
  return {
    prerequisites: ['uv'],
    inputs: [
      { id: 'sdd_x_profile', type: 'promptString', description: 'Perfil', default: 'default' },
      { id: 'sdd_x_region', type: 'promptString', description: 'Región', default: 'us-east-1' },
    ],
    servers: {
      'sdd-x': {
        type: 'stdio',
        command: 'uvx',
        args: ['x-mcp-server@1.0.0'],
        env: { PROFILE: '${input:sdd_x_profile}', REGION: '${input:sdd_x_region}', READ_ONLY: 'true' },
      },
    },
    approxTools: { 'sdd-x': 3 },
    beta: false,
    credentials: 'Perfil local',
    example: 'Lista mis recursos',
    operate: {
      servers: {
        'sdd-x': {
          type: 'stdio',
          command: 'uvx',
          args: ['x-mcp-server@1.0.0'],
          env: { PROFILE: '${input:sdd_x_profile}', REGION: '${input:sdd_x_region}', CONSENT: 'true' },
        },
      },
      warning: 'Copilot podrá cambiar recursos.',
    },
    ...over,
  };
}
