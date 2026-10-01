import { describe, expect, it } from 'vitest';
import { ActiveMcpPower, compareVersions, DoctorEnv, runChecks } from '../../../src/doctor/checks';

const healthy: DoctorEnv = {
  vscodeVersion: '1.140.0',
  minVersion: '1.140.0',
  copilotChatInstalled: true,
  githubSignedIn: true,
  agentModeEnabled: true,
  extensionToolsEnabled: true,
  strictPluginOnly: false,
  strictForMcp: false,
  mcpAccess: 'all',
  workspaceTrusted: true,
  mcpJsonIgnored: false,
  prereqs: {},
  activeMcp: [],
};

describe('compareVersions', () => {
  it('compara numéricamente e ignora sufijos', () => {
    expect(compareVersions('1.140.0', '1.139.9')).toBeGreaterThan(0);
    expect(compareVersions('1.99.0', '1.140.0')).toBeLessThan(0);
    expect(compareVersions('1.140.0-insider', '1.140.0')).toBe(0);
  });
});

describe('runChecks', () => {
  it('todo bien', () => {
    expect(runChecks(healthy).every((c) => c.ok)).toBe(true);
  });
  it('cada problema da su check con acción', () => {
    const results = runChecks({
      ...healthy,
      vscodeVersion: '1.120.0',
      copilotChatInstalled: false,
      githubSignedIn: false,
      agentModeEnabled: false,
      extensionToolsEnabled: false,
      strictPluginOnly: true,
      strictForMcp: true,
    });
    const failed = results.filter((c) => !c.ok);
    expect(failed.map((c) => c.id)).toEqual([
      'vscode-version',
      'copilot-chat',
      'github-session',
      'agent-mode',
      'extension-tools',
      'strict-policy',
      'mcp-strict',
    ]);
    expect(failed.every((c) => c.action)).toBe(true);
    expect(failed.find((c) => c.id === 'strict-policy')!.severity).toBe('warning');
    expect(failed.find((c) => c.id === 'copilot-chat')!.severity).toBe('error');
  });
  it('sesión de GitHub desconocida no es un problema (I2)', () => {
    const session = runChecks({ ...healthy, githubSignedIn: 'unknown' }).find((c) => c.id === 'github-session')!;
    expect(session).toMatchObject({
      ok: true,
      message: 'Sesión de GitHub no verificada (VS Code no lo permite sin permiso)',
    });
    expect(session.action).toBeUndefined();
  });
  it('solo una sesión ausente confirmada avisa', () => {
    const session = runChecks({ ...healthy, githubSignedIn: false }).find((c) => c.id === 'github-session')!;
    expect(session).toMatchObject({ ok: false, severity: 'warning' });
    expect(runChecks(healthy).find((c) => c.id === 'github-session')!.message).toBe('Sesión de GitHub activa');
  });
  it('el aviso de la política estricta dice "puede impedir"', () => {
    const strict = runChecks({ ...healthy, strictPluginOnly: true }).find((c) => c.id === 'strict-policy')!;
    expect(strict.message).toBe(
      'La política ChatStrictPluginOnlyCustomization está activa: puede impedir que se carguen las instructions de steering de .github/instructions (y, más adelante, los Powers del repo).',
    );
  });
});

describe('chequeos MCP (spec §7)', () => {
  const aws = (over: Partial<ActiveMcpPower> = {}): ActiveMcpPower => ({
    id: 'aws',
    displayName: 'AWS',
    mode: 'readOnly',
    prerequisites: ['uv', 'aws'],
    servers: [{ name: 'sdd-aws', inFile: true, approxTools: 3 }],
    ...over,
  });
  const withMcp: DoctorEnv = { ...healthy, activeMcp: [aws()], prereqs: { uv: true, aws: true } };
  const find = (env: DoctorEnv, id: string) => runChecks(env).filter((c) => c.id === id);

  it('sin Powers MCP activos solo aparecen mcp-policy y mcp-strict', () => {
    expect(runChecks(healthy).map((c) => c.id).filter((id) => id.startsWith('mcp-'))).toEqual(['mcp-policy', 'mcp-strict']);
  });
  it('con Powers MCP activos y todo bien, todo ok', () => {
    expect(runChecks(withMcp).every((c) => c.ok)).toBe(true);
  });
  it('mcp-policy con Powers MCP activos: none es error y registry es warning', () => {
    expect(find({ ...withMcp, mcpAccess: 'none' }, 'mcp-policy')[0]).toMatchObject({ ok: false, severity: 'error' });
    expect(find({ ...withMcp, mcpAccess: 'none' }, 'mcp-policy')[0].message).toMatch(/bloqueados/);
    expect(find({ ...withMcp, mcpAccess: 'registry' }, 'mcp-policy')[0]).toMatchObject({ ok: false, severity: 'warning' });
    expect(find({ ...withMcp, mcpAccess: 'registry' }, 'mcp-policy')[0].message).toMatch(/registro de tu organización/);
  });
  it('mcp-policy sin Powers MCP activos: none y registry son info y no cuentan como problema', () => {
    for (const mcpAccess of ['none', 'registry']) {
      const [c] = find({ ...healthy, mcpAccess }, 'mcp-policy');
      expect(c).toMatchObject({ ok: true, severity: 'info' });
      expect(runChecks({ ...healthy, mcpAccess }).every((r) => r.ok)).toBe(true);
    }
    expect(find({ ...healthy, mcpAccess: 'none' }, 'mcp-policy')[0].message).toMatch(/bloqueados/);
  });
  it('mcp-strict: error que nombra .vscode/mcp.json', () => {
    const [c] = find({ ...healthy, strictPluginOnly: true, strictForMcp: true }, 'mcp-strict');
    expect(c).toMatchObject({ ok: false, severity: 'error' });
    expect(c.message).toMatch(/\.vscode\/mcp\.json/);
  });
  it('mcp-strict: una política estricta que no incluye mcp no bloquea .vscode/mcp.json', () => {
    expect(find({ ...healthy, strictPluginOnly: true, strictForMcp: false }, 'mcp-strict')[0].ok).toBe(true);
    expect(find({ ...healthy, strictPluginOnly: true, strictForMcp: false }, 'strict-policy')[0].ok).toBe(false);
  });
  it('mcp-github-policy: info (no cuenta como problema) con el texto de la política', () => {
    const [c] = find(withMcp, 'mcp-github-policy');
    expect(c).toMatchObject({ ok: true, severity: 'info' });
    expect(c.message).toContain('MCP servers in Copilot');
    expect(find(healthy, 'mcp-github-policy')).toEqual([]);
  });
  it('mcp-prereq-<cmd>: error con enlace de instalación por cada ejecutable que falta', () => {
    const results = runChecks({ ...withMcp, prereqs: { uv: false, aws: true } });
    const [c] = results.filter((r) => r.id === 'mcp-prereq-uv');
    expect(c).toMatchObject({ ok: false, severity: 'error' });
    expect(c.message).toContain('AWS');
    expect(c.action).toContain('https://docs.astral.sh/uv/');
    expect(results.some((r) => r.id === 'mcp-prereq-aws')).toBe(false);
  });
  it('mcp-trust: warning en workspace sin confianza', () => {
    expect(find({ ...withMcp, workspaceTrusted: false }, 'mcp-trust')[0]).toMatchObject({ ok: false, severity: 'warning' });
  });
  it('mcp-gitignored: warning solo si se sabe que está ignorado', () => {
    expect(find({ ...withMcp, mcpJsonIgnored: true }, 'mcp-gitignored')[0]).toMatchObject({ ok: false, severity: 'warning' });
    expect(find({ ...withMcp, mcpJsonIgnored: 'unknown' }, 'mcp-gitignored')[0].ok).toBe(true);
  });
  it('mcp-drift: warning con acción Reparar que reescribe en el modo del lock y la carpeta', () => {
    const env = { ...withMcp, mcpFolder: 'app', activeMcp: [aws({ mode: 'operate', servers: [{ name: 'sdd-aws', inFile: false, approxTools: 3 }] })] };
    const [c] = find(env, 'mcp-drift');
    expect(c).toMatchObject({ ok: false, severity: 'warning' });
    expect(c.message).toContain('sdd-aws');
    expect(c.fix).toEqual({ label: 'Reparar', command: 'sddStudio.setPowerMode', args: [{ id: 'aws', mode: 'operate', folder: 'app' }] });
  });
  it('mcp-tools: warning si la suma de approxTools pasa de 100', () => {
    const many = (n: number) => aws({ servers: [{ name: 'sdd-aws', inFile: true, approxTools: n }] });
    expect(find({ ...withMcp, activeMcp: [many(100)] }, 'mcp-tools')[0].ok).toBe(true);
    const [c] = find({ ...withMcp, activeMcp: [many(60), aws({ id: 'azure', servers: [{ name: 'sdd-azure', inFile: true, approxTools: 50 }] })] }, 'mcp-tools');
    expect(c).toMatchObject({ ok: false, severity: 'warning' });
    expect(c.message).toMatch(/~110 herramientas/);
    expect(c.message).toMatch(/128/);
  });
});
