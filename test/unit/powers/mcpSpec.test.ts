import { describe, expect, it } from 'vitest';
import { serverCommandLine, serverIdentity, serverKind, serversForMode, validateMcpSpec } from '../../../src/powers/mcp/spec';
import { CATEGORIES, CATEGORY_LABELS } from '../../../src/powers/types';
import { mcpSpec } from '../../support/powerFixtures';

const errs = (x: unknown) => validateMcpSpec(x, 'p').join('\n');
const http = (url: string, headers?: Record<string, string>) => ({ type: 'http' as const, url, ...(headers ? { headers } : {}) });
const remote = (over: Record<string, unknown> = {}) =>
  mcpSpec({ inputs: [], servers: { 'sdd-r': http('https://example.com/mcp') }, approxTools: { 'sdd-r': 2 }, operate: undefined, ...over });

describe('validateMcpSpec', () => {
  it('acepta un spec válido (stdio con inputs y operate) y uno remoto sin operate', () => {
    expect(validateMcpSpec(mcpSpec(), 'p')).toEqual([]);
    expect(validateMcpSpec(remote(), 'p')).toEqual([]);
  });

  it('regla 1: nombres de servidor sdd-… e ids de input sdd_…', () => {
    expect(errs(remote({ servers: { github: http('https://x.dev') }, approxTools: { github: 1 } }))).toMatch(/\^sdd-\[a-z0-9-\]\+\$/);
    const badInput = mcpSpec({ inputs: [{ id: 'profile', type: 'promptString', description: 'P' }, mcpSpec().inputs[1]] });
    expect(errs(badInput)).toMatch(/\^sdd_\[a-z0-9_\]\+\$/);
  });

  it('regla 2: type stdio|http y url https', () => {
    expect(errs(remote({ servers: { 'sdd-r': { type: 'sse', url: 'https://x' } } }))).toMatch(/"type" debe ser stdio o http/);
    expect(errs(remote({ servers: { 'sdd-r': http('http://example.com/mcp') } }))).toMatch(/https:\/\//);
  });

  it('regla 3: sin @latest y npx/uvx con paquete fijado (admite prerelease)', () => {
    const stdio = (args: string[], command = 'npx') =>
      remote({ prerequisites: ['node'], servers: { 'sdd-r': { type: 'stdio', command, args } } });
    expect(errs(stdio(['-y', '@playwright/mcp@latest']))).toMatch(/@latest/);
    expect(errs(stdio(['-y', '@playwright/mcp']))).toMatch(/versión exacta/);
    expect(errs(stdio(['awslabs.aws-api-mcp-server'], 'uvx'))).toMatch(/versión exacta/);
    expect(validateMcpSpec(stdio(['-y', '@azure/mcp@3.0.0-beta.48', 'server', 'start']), 'p')).toEqual([]);
    expect(validateMcpSpec(stdio(['-y', '@playwright/mcp@0.0.83', '--headless']), 'p')).toEqual([]);
  });

  it('regla 4: rechaza secretos literales y acepta Bearer ${input:…}', () => {
    for (const secret of ['ghp_abc', 'gho_abc', 'github_pat_abc', 'AKIAABCDEF', 'xoxb-1', 'Bearer abc']) {
      expect(errs(remote({ servers: { 'sdd-r': http('https://x.dev', { Authorization: secret }) } })), secret).toMatch(/secreto literal/);
    }
    const env = mcpSpec();
    (env.servers['sdd-x'] as { env: Record<string, string> }).env.TOKEN = 'AKIAXXXX';
    expect(errs(env)).toMatch(/secreto literal/);
    const ok = remote({
      inputs: [{ id: 'sdd_r_key', type: 'promptString', description: 'K', password: true }],
      servers: { 'sdd-r': http('https://x.dev', { Authorization: 'Bearer ${input:sdd_r_key}' }) },
    });
    expect(validateMcpSpec(ok, 'p')).toEqual([]);
  });

  it('regla 5: operate con las mismas claves y warning no vacío', () => {
    const spec = mcpSpec();
    expect(errs({ ...spec, operate: { servers: {}, warning: 'w' } })).toMatch(/mismos servidores/);
    expect(errs({ ...spec, operate: { ...spec.operate, warning: ' ' } })).toMatch(/"operate.warning" no puede estar vacío/);
  });

  it('regla 6: todo input usado está declarado y todo declarado se usa', () => {
    expect(errs(mcpSpec({ inputs: [mcpSpec().inputs[0]] }))).toMatch(/\$\{input:sdd_x_region\} se usa pero no está declarado/);
    const extra = mcpSpec({ inputs: [...mcpSpec().inputs, { id: 'sdd_x_extra', type: 'promptString', description: 'E' }] });
    expect(errs(extra)).toMatch(/"sdd_x_extra" está declarado pero no se usa/);
  });

  it('regla 7: approxTools entero > 0 por servidor', () => {
    expect(errs(mcpSpec({ approxTools: {} }))).toMatch(/approxTools.sdd-x/);
    expect(errs(mcpSpec({ approxTools: { 'sdd-x': 0 } }))).toMatch(/entero mayor que 0/);
    expect(errs(mcpSpec({ approxTools: { 'sdd-x': 2.5 } }))).toMatch(/entero mayor que 0/);
  });

  it('campos de presentación: prerrequisitos conocidos, beta, credentials y example', () => {
    expect(errs(mcpSpec({ prerequisites: ['python' as never] }))).toMatch(/prerequisites/);
    expect(errs({ ...mcpSpec(), beta: 'no' })).toMatch(/"beta"/);
    expect(errs(mcpSpec({ credentials: '' }))).toMatch(/credentials/);
    expect(errs(mcpSpec({ example: '' }))).toMatch(/example/);
    expect(errs('x')).toMatch(/debe ser un objeto/);
  });
});

describe('prerrequisitos y propiedades heredadas', () => {
  it('rechaza nombres de Object.prototype como prerrequisito', () => {
    expect(errs(mcpSpec({ prerequisites: ['constructor' as never] }))).toMatch(/"prerequisites" debe ser una lista/);
    expect(errs(mcpSpec({ prerequisites: ['toString' as never] }))).toMatch(/"prerequisites" debe ser una lista/);
  });
});

describe('helpers de McpSpec', () => {
  it('serversForMode elige operate solo si existe', () => {
    const spec = mcpSpec();
    expect(serversForMode(spec, 'readOnly')).toBe(spec.servers);
    expect(serversForMode(spec, 'operate')).toBe(spec.operate!.servers);
    const r = remote();
    expect(serversForMode(r, 'operate')).toBe(r.servers);
  });
  it('serverKind y serverCommandLine', () => {
    const s = mcpSpec().servers['sdd-x'];
    expect(serverKind(s)).toBe('local');
    expect(serverCommandLine(s)).toBe('uvx x-mcp-server@1.0.0');
    expect(serverKind(http('https://x.dev'))).toBe('remote');
    expect(serverCommandLine(http('https://x.dev'))).toBe('https://x.dev');
  });
  it('serverIdentity: URL, paquete npx/uvx sin versión o línea de comando', () => {
    expect(serverIdentity(http('https://knowledge-mcp.global.api.aws'))).toBe('https://knowledge-mcp.global.api.aws');
    expect(serverIdentity({ type: 'stdio', command: 'uvx', args: ['awslabs.aws-api-mcp-server@1.5.6'], env: { READ_OPERATIONS_ONLY: 'true' } })).toBe(
      'uvx:awslabs.aws-api-mcp-server',
    );
    expect(serverIdentity({ type: 'stdio', command: 'npx', args: ['-y', '@azure/mcp@3.0.0-beta.48', 'server', 'start', '--read-only'] })).toBe('npx:@azure/mcp');
    expect(serverIdentity({ type: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@0.0.83', '--headless'] })).toBe('npx:@playwright/mcp');
    expect(serverIdentity({ type: 'stdio', command: 'docker', args: ['run', '-i', '--rm', 'img'] })).toBe('docker run -i --rm img');
    expect(serverIdentity({ type: 'stdio', command: 'my-server' })).toBe('my-server');
  });
});

describe('categorías nuevas', () => {
  it('Dev core, Documentación y Cloud al final, en ese orden', () => {
    expect(CATEGORIES.slice(-3)).toEqual(['devcore', 'docs', 'cloud']);
    expect(CATEGORIES.slice(-3).map((c) => CATEGORY_LABELS[c])).toEqual(['Dev core', 'Documentación', 'Cloud']);
  });
});
