import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../scripts/build-catalog';
import { validateCatalog } from '../../../src/powers/catalog';
import { presentation } from '../../support/powerFixtures';

function writePower(root: string, id: string, opts: { license?: boolean; extra?: Record<string, string> } = {}): void {
  const dir = join(root, id);
  mkdirSync(join(dir, 'skills', id, 'references'), { recursive: true });
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: id, version: '1.2.0', description: 'D', author: { name: 'A' }, license: 'MIT' }));
  writeFileSync(join(dir, 'presentation.json'), JSON.stringify(presentation({ displayName: id })));
  writeFileSync(join(dir, 'skills', id, 'SKILL.md'), `---\nname: ${id}\ndescription: Use when x. En español: y.\n---\nBody\n`);
  writeFileSync(join(dir, 'skills', id, 'references', 'more.md'), 'More\n');
  for (const [p, c] of Object.entries(opts.extra ?? {})) writeFileSync(join(dir, 'skills', id, p), c);
  if (opts.license !== false) writeFileSync(join(dir, 'LICENSE'), 'MIT\n');
  writeFileSync(join(dir, 'UPSTREAM.md'), '# Origen\n');
}

describe('buildCatalog', () => {
  it('genera un catálogo válido con todos los archivos del skill', () => {
    const root = mkdtempSync(join(tmpdir(), 'powers-'));
    writePower(root, 'beta');
    writePower(root, 'alpha');
    const { catalog, errors } = buildCatalog(root, new Date('2026-10-01T00:00:00Z'));
    expect(errors).toEqual([]);
    expect(catalog.powers.map((p) => p.id)).toEqual(['alpha', 'beta']);
    expect(catalog.powers[0].files.LICENSE).toBe('MIT\n');
    expect(Object.keys(catalog.powers[0].files).sort()).toEqual(['LICENSE', 'SKILL.md', 'references/more.md']);
    expect(catalog.powers[0].version).toBe('1.2.0');
    expect(catalog.generatedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(validateCatalog(catalog).ok).toBe(true);
  });
  it('reporta errores con el nombre del Power y no lo incluye', () => {
    const root = mkdtempSync(join(tmpdir(), 'powers-'));
    writePower(root, 'alpha', { license: false });
    writePower(root, 'beta', { extra: { 'notes.md': 'call TodoWrite' } });
    const { catalog, errors } = buildCatalog(root);
    expect(errors.join('\n')).toMatch(/alpha: falta LICENSE/);
    expect(errors.join('\n')).toMatch(/beta: término prohibido "TodoWrite" en skills\/beta\/notes.md/);
    expect(catalog.powers).toEqual([]);
  });
  it('carpeta inexistente da catálogo vacío sin errores', () => {
    expect(buildCatalog(join(tmpdir(), 'no-existe-powers-xyz'))).toMatchObject({ errors: [], catalog: { powers: [] } });
  });
});
