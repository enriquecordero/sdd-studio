import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { frontMatterFields } from '../../src/specs/frontMatter';

const root = join(__dirname, '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const AGENTS = ['sdd-spec', 'sdd-requirements', 'sdd-design', 'sdd-tasks', 'sdd-implement', 'sdd-steering'];

describe('manifiesto', () => {
  it('registra los 6 agentes y sus archivos existen con name correcto', () => {
    const paths: string[] = pkg.contributes.chatAgents.map((a: { path: string }) => a.path);
    expect(paths).toHaveLength(6);
    for (const name of AGENTS) {
      const file = join(root, 'agents', `${name}.agent.md`);
      expect(paths).toContain(`./agents/${name}.agent.md`);
      expect(existsSync(file)).toBe(true);
      expect(frontMatterFields(readFileSync(file, 'utf8')).get('name')).toBe(name);
    }
  });

  it('los handoffs apuntan a agentes existentes', () => {
    for (const name of AGENTS) {
      const text = readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8');
      for (const match of text.matchAll(/^\s+agent: (\S+)$/gm)) expect(AGENTS).toContain(match[1]);
    }
  });

  it('si un handoff pide approvePhase o setTaskStatus, el agente destino tiene esa herramienta', () => {
    const toolsOf = (name: string) =>
      frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
    for (const name of AGENTS) {
      const text = readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8');
      for (const m of text.matchAll(/^\s+agent: (\S+)\n\s+prompt: "([^"]*)"/gm)) {
        for (const tool of ['approvePhase', 'setTaskStatus']) {
          if (m[2].includes(tool)) expect(toolsOf(m[1]), `${name} → ${m[1]} necesita ${tool}`).toContain(`'${tool}'`);
        }
      }
    }
  });

  it('requisitos y diseño piden diagramas ASCII / wireframes', () => {
    const req = readFileSync(join(root, 'agents', 'sdd-requirements.agent.md'), 'utf8');
    const design = readFileSync(join(root, 'agents', 'sdd-design.agent.md'), 'utf8');
    expect(req).toMatch(/## Wireframes/);
    expect(design).toMatch(/diagrama ASCII de arquitectura/);
    expect(design).toMatch(/diagrama ASCII de flujo/);
  });

  it('cada agente incluye sus reglas clave (superpowers / mattpocock) y sigue siendo conciso', () => {
    const markers: Record<string, (string | RegExp)[]> = {
      'sdd-spec': ['HECHO CON DUDAS', 'respuesta recomendada'],
      'sdd-requirements': ['## Fuera de alcance', /autorrevisión/i],
      'sdd-design': ['enfoques', 'seam'],
      'sdd-tasks': ['Bloqueada por', 'Verificación:', 'Interfaces'],
      'sdd-implement': ['HECHO CON DUDAS', '3 arreglos', 'evidencia'],
      'sdd-steering': ['evidencia'],
    };
    for (const name of AGENTS) {
      const file = join(root, 'agents', `${name}.agent.md`);
      const text = readFileSync(file, 'utf8');
      for (const marker of markers[name]) {
        if (typeof marker === 'string') expect(text, `${name} debe contener "${marker}"`).toContain(marker);
        else expect(text, `${name} debe cumplir ${marker}`).toMatch(marker);
      }
      expect(readFileSync(file).length, `${name} pesa demasiado`).toBeLessThan(7000);
    }
  });

  it('los agentes de fase no tienen la herramienta de edición genérica', () => {
    for (const name of ['sdd-requirements', 'sdd-design', 'sdd-tasks']) {
      const tools = frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
      expect(tools).toContain('writeSpecDoc');
      expect(tools).not.toMatch(/'edit'/);
    }
  });

  it('los agentes no listan herramientas de servidores MCP (plan B del spec §6.6)', () => {
    for (const name of AGENTS) {
      const tools = frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
      expect(tools, name).not.toMatch(/'sdd-[a-z0-9-]+\/\*'/);
    }
  });

  it('registra los 5 prompt files y existen', () => {
    const paths: string[] = pkg.contributes.chatPromptFiles.map((p: { path: string }) => p.path);
    expect(paths.sort()).toEqual(
      ['spec-bugfix', 'spec-new', 'spec-quick', 'spec-run', 'spec-steering'].map((n) => `./prompts/${n}.prompt.md`),
    );
    paths.forEach((p) => expect(existsSync(join(root, p))).toBe(true));
  });

  it('sdd-spec pregunta con tarjetas y delega en subagentes de fase', () => {
    const fields = frontMatterFields(readFileSync(join(root, 'agents', 'sdd-spec.agent.md'), 'utf8'));
    const tools = fields.get('tools')!;
    expect(tools).toContain("'vscode/askQuestions'");
    expect(tools).toContain("'agent/runSubagent'");
    expect(tools).not.toMatch(/'edit'/);
    expect(fields.get('agents')).toBe("['sdd-requirements', 'sdd-design', 'sdd-tasks']");
  });

  it('los prompts de creación abren sdd-spec', () => {
    for (const name of ['spec-new', 'spec-bugfix', 'spec-quick']) {
      expect(frontMatterFields(readFileSync(join(root, 'prompts', `${name}.prompt.md`), 'utf8')).get('agent')).toBe('sdd-spec');
    }
  });

  it('cada herramienta registrada en código está declarada en el manifiesto', () => {
    const names = pkg.contributes.languageModelTools.map((t: { name: string }) => t.name);
    expect(names).toEqual(['sdd_writeSpecDoc', 'sdd_approvePhase', 'sdd_setTaskStatus']);
  });

  it('la extensión tiene icono PNG y mascota Speccy', () => {
    expect(pkg.icon).toBe('media/icon.png');
    const png = readFileSync(join(root, 'media', 'icon.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(256);
    expect(readFileSync(join(root, 'media', 'speccy.svg'), 'utf8')).toContain('aria-label="Speccy');
  });

  it('el icono de la barra lateral es el rayo monocromo (currentColor)', () => {
    const svg = readFileSync(join(root, 'media', 'sdd-studio.svg'), 'utf8');
    expect(svg).toContain('currentColor');
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(svg).toContain('M13 2 4 14h6l-1 8 9-12h-6l1-8z');
  });
});
