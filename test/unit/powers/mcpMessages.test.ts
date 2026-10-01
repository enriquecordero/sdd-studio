import { describe, expect, it } from 'vitest';
import { activationDetail, activatedMcpMessage, overwriteQuestion } from '../../../src/powers/mcp/messages';
import { mcpSpec } from '../../support/powerFixtures';

describe('activationDetail', () => {
  it('lista servidores locales con su comando y remotos con su URL', () => {
    const spec = mcpSpec({
      inputs: [],
      servers: {
        'sdd-a': { type: 'stdio', command: 'npx', args: ['-y', 'a@1.0.0'] },
        'sdd-b': { type: 'http', url: 'https://b.dev/mcp' },
      },
      approxTools: { 'sdd-a': 1, 'sdd-b': 1 },
      operate: undefined,
    });
    const text = activationDetail(spec, [], { state: 'allowed' });
    expect(text).toContain('• sdd-a: LOCAL, ejecuta código en tu máquina: npx -y a@1.0.0');
    expect(text).toContain('• sdd-b: remoto, https://b.dev/mcp');
    expect(text).toContain('Credenciales: Perfil local.');
    expect(text).not.toContain('beta');
    expect(text).not.toContain('Falta en tu PATH');
  });
  it('avisa de prerrequisitos que faltan (con enlace), beta y política de registro', () => {
    const text = activationDetail(mcpSpec({ beta: true }), ['uv'], { state: 'registryOnly', reason: 'x' });
    expect(text).toContain('• uv: https://docs.astral.sh/uv/getting-started/installation/');
    expect(text).toContain('versión beta');
    expect(text).toContain('solo permite servidores de su registro');
  });
});

describe('activationDetail en modo Operar', () => {
  const spec = mcpSpec({
    servers: { 'sdd-a': { type: 'stdio', command: 'npx', args: ['-y', 'a@1.0.0', '--read-only'] } },
    operate: { servers: { 'sdd-a': { type: 'stdio', command: 'npx', args: ['-y', 'a@1.0.0'] } }, warning: 'w' },
  });
  it('muestra la línea de comando del modo y la cabecera de reescritura', () => {
    const text = activationDetail(spec, [], { state: 'allowed' }, 'operate', 'rewrite');
    expect(text).toContain('Se reescribirán en .vscode/mcp.json (modo Operar):');
    expect(text).toContain('npx -y a@1.0.0');
    expect(text).not.toContain('--read-only');
  });
  it('por defecto es Solo lectura y añade', () => {
    const text = activationDetail(spec, [], { state: 'allowed' });
    expect(text).toContain('Se añadirán a .vscode/mcp.json (modo Solo lectura):');
    expect(text).toContain('--read-only');
  });
});

describe('overwriteQuestion', () => {
  it('nombra el skill o mcp.json según el motivo', () => {
    expect(overwriteQuestion('SKILL_EDITED', 'AWS', 'aws', 'update')).toBe('"AWS" tiene cambios hechos a mano en .github/skills/aws/. ¿Sobrescribir esos cambios?');
    expect(overwriteQuestion('MCP_EDITED', 'AWS', 'aws', 'deactivate')).toBe(
      '"AWS" tiene cambios hechos a mano en sus servidores en .vscode/mcp.json. ¿Desactivarlo y descartar esos cambios?',
    );
  });
});

describe('activatedMcpMessage', () => {
  it('pide commitear .github y .vscode/mcp.json si no está ignorado', () => {
    const text = activatedMcpMessage('AWS', ['sdd-aws', 'sdd-aws-docs'], false);
    expect(text).toBe(
      'SDD Studio: listo. "AWS" añadió sdd-aws, sdd-aws-docs a .vscode/mcp.json. VS Code te pedirá confiar e iniciar el servidor. Commitea .github y .vscode/mcp.json para compartirlo.',
    );
  });
  it('si .gitignore ignora .vscode/mcp.json, avisa en lugar de pedir el commit', () => {
    const text = activatedMcpMessage('AWS', ['sdd-aws'], true);
    expect(text).toContain('añadió sdd-aws a .vscode/mcp.json');
    expect(text).toContain('⚠️ .vscode/mcp.json está ignorado por git: añade `!.vscode/mcp.json` a .gitignore o tu equipo no recibirá los servidores.');
    expect(text).not.toContain('Commitea .github y .vscode/mcp.json');
  });
});
