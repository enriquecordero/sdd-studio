import { describe, expect, it } from 'vitest';
import { PowerSourceInput, validatePowerSource } from '../../../src/powers/validateSource';
import { presentation } from '../../support/powerFixtures';

function input(over: Partial<PowerSourceInput> = {}): PowerSourceInput {
  return {
    dirName: 'alpha',
    pluginJson: { name: 'alpha', version: '1.0.0', description: 'Desc', author: { name: 'Autora' }, license: 'MIT' },
    presentation: presentation(),
    skillDirs: ['alpha'],
    skillFiles: { 'SKILL.md': '---\nname: alpha\ndescription: Use when testing. En español: probar.\n---\n# Alpha\n' },
    hasLicense: true,
    hasUpstream: true,
    ...over,
  };
}

describe('validatePowerSource', () => {
  it('acepta un Power correcto', () => {
    expect(validatePowerSource(input())).toEqual([]);
  });
  it('exige LICENSE y UPSTREAM.md', () => {
    const errs = validatePowerSource(input({ hasLicense: false, hasUpstream: false })).join('\n');
    expect(errs).toMatch(/falta LICENSE/);
    expect(errs).toMatch(/falta UPSTREAM.md/);
  });
  it('el name de SKILL.md y plugin.json deben coincidir con la carpeta', () => {
    const errs = validatePowerSource(
      input({ pluginJson: { name: 'otro', version: '1.0.0', description: 'd', author: { name: 'a' }, license: 'MIT' }, skillFiles: { 'SKILL.md': '---\nname: otro\ndescription: d\n---\n' } }),
    ).join('\n');
    expect(errs).toMatch(/plugin.json "name" debe ser "alpha"/);
    expect(errs).toMatch(/"name" de SKILL.md debe ser "alpha"/);
  });
  it('limita la description a 1024 caracteres', () => {
    const errs = validatePowerSource(input({ skillFiles: { 'SKILL.md': `---\nname: alpha\ndescription: ${'x'.repeat(1025)}\n---\n` } })).join();
    expect(errs).toMatch(/supera 1024/);
  });
  it.each(['TodoWrite', 'the Task tool', 'AskUserQuestion', 'mcp__github', 'Claude Code', 'Cursor', 'claude-opus-4', 'gpt-5'])(
    'detecta el término prohibido %s',
    (term) => {
      const errs = validatePowerSource(input({ skillFiles: { 'SKILL.md': `---\nname: alpha\ndescription: d\n---\nUse ${term} here.\n` } })).join();
      expect(errs).toMatch(/término prohibido/);
    },
  );
  it('exige exactamente una carpeta skills/<id>/', () => {
    expect(validatePowerSource(input({ skillDirs: ['alpha', 'beta'] })).join()).toMatch(/exactamente una carpeta/);
  });
});
