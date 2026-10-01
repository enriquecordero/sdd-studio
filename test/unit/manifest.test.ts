import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { frontMatterFields } from '../../src/specs/frontMatter';

const root = join(__dirname, '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const AGENTS = ['sdd-requirements', 'sdd-design', 'sdd-tasks', 'sdd-implement', 'sdd-steering'];

describe('manifiesto', () => {
  it('registra los 5 agentes y sus archivos existen con name correcto', () => {
    const paths: string[] = pkg.contributes.chatAgents.map((a: { path: string }) => a.path);
    expect(paths).toHaveLength(5);
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

  it('los agentes de fase no tienen la herramienta de edición genérica', () => {
    for (const name of ['sdd-requirements', 'sdd-design', 'sdd-tasks']) {
      const tools = frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
      expect(tools).toContain('writeSpecDoc');
      expect(tools).not.toMatch(/'edit'/);
    }
  });

  it('registra los 4 prompt files y existen', () => {
    const paths: string[] = pkg.contributes.chatPromptFiles.map((p: { path: string }) => p.path);
    expect(paths.sort()).toEqual(
      ['spec-bugfix', 'spec-new', 'spec-run', 'spec-steering'].map((n) => `./prompts/${n}.prompt.md`),
    );
    paths.forEach((p) => expect(existsSync(join(root, p))).toBe(true));
  });

  it('cada herramienta registrada en código está declarada en el manifiesto', () => {
    const names = pkg.contributes.languageModelTools.map((t: { name: string }) => t.name);
    expect(names).toEqual(['sdd_writeSpecDoc', 'sdd_approvePhase', 'sdd_setTaskStatus']);
  });
});
