import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../scripts/build-catalog';
import { validateCatalog } from '../../../src/powers/catalog';
import { catalogPowerHash } from '../../../src/powers/hash';
import { mcpSpec, presentation } from '../../support/powerFixtures';

function writePower(root: string, id: string, opts: { license?: boolean; extra?: Record<string, string>; mcp?: string } = {}): void {
  const dir = join(root, id);
  mkdirSync(join(dir, 'skills', id, 'references'), { recursive: true });
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ name: id, version: '1.2.0', description: 'D', author: { name: 'A' }, license: 'MIT' }));
  writeFileSync(join(dir, 'presentation.json'), JSON.stringify(presentation({ displayName: id })));
  writeFileSync(join(dir, 'skills', id, 'SKILL.md'), `---\nname: ${id}\ndescription: Use when x. En español: y.\n---\nBody\n`);
  writeFileSync(join(dir, 'skills', id, 'references', 'more.md'), 'More\n');
  for (const [p, c] of Object.entries(opts.extra ?? {})) writeFileSync(join(dir, 'skills', id, p), c);
  if (opts.license !== false) writeFileSync(join(dir, 'LICENSE'), 'MIT\n');
  writeFileSync(join(dir, 'UPSTREAM.md'), '# Origen\n');
  if (opts.mcp !== undefined) writeFileSync(join(dir, 'mcp.vscode.json'), opts.mcp);
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
    expect(catalog.schemaVersion).toBe(2);
    expect(validateCatalog(catalog).ok).toBe(true);
  });
  it('incluye mcp.vscode.json en "mcp" y en el hash, pero no en los archivos del skill', () => {
    const root = mkdtempSync(join(tmpdir(), 'powers-'));
    writePower(root, 'cloudy', {
      mcp: JSON.stringify(mcpSpec()),
      extra: { 'SKILL.md': '---\nname: cloudy\ndescription: Use when x. En español: y.\n---\nUse sdd-x.\n' },
    });
    const { catalog, errors } = buildCatalog(root);
    expect(errors).toEqual([]);
    const [p] = catalog.powers;
    expect(p.mcp).toEqual(mcpSpec());
    expect(Object.keys(p.files)).not.toContain('mcp.vscode.json');
    expect(p.sha256).toBe(catalogPowerHash(p.files, mcpSpec()));
    expect(validateCatalog(catalog).ok).toBe(true);
  });
  it('un mcp.vscode.json inválido es un error del Power', () => {
    const root = mkdtempSync(join(tmpdir(), 'powers-'));
    writePower(root, 'cloudy', { mcp: JSON.stringify(mcpSpec({ servers: { github: { type: 'http', url: 'https://x.dev' } }, operate: undefined })) });
    const { catalog, errors } = buildCatalog(root);
    expect(errors.join('\n')).toMatch(/cloudy\/mcp.vscode.json: servidor "github"/);
    expect(catalog.powers).toEqual([]);
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
