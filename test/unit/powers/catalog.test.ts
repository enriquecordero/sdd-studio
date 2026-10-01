import { describe, expect, it } from 'vitest';
import { compareSemver, isSafeRelativePath, newestCatalog, validateCatalog, validatePresentation } from '../../../src/powers/catalog';
import { catalog, power, presentation } from '../../support/powerFixtures';

const errorsOf = (json: unknown) => {
  const r = validateCatalog(json);
  return r.ok ? [] : r.errors;
};

describe('isSafeRelativePath', () => {
  it.each(['SKILL.md', 'references/a.md', 'a/b/c.txt'])('%s es segura', (p) => expect(isSafeRelativePath(p)).toBe(true));
  it.each(['', '/etc/passwd', '../x', 'a/../../b', 'a//b', './a', 'a\\b', 'C:x', '..'])('"%s" no es segura', (p) =>
    expect(isSafeRelativePath(p)).toBe(false),
  );
});

describe('compareSemver', () => {
  it('compara numéricamente', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.9.9', '1.0.0')).toBeLessThan(0);
  });
});

describe('validatePresentation', () => {
  it('acepta una presentación válida', () => {
    expect(validatePresentation(presentation(), 'x')).toEqual([]);
  });
  it('rechaza categoría, tono y límites de nodos', () => {
    const errs = validatePresentation(
      presentation({
        category: 'otra' as never,
        diagram: { kind: 'steps', nodes: [{ label: 'SOLO', tone: 'rosa' as never }] },
      }),
      'x',
    );
    expect(errs.join('\n')).toMatch(/category/);
    expect(errs.join('\n')).toMatch(/entre 2 y 6 nodos/);
  });
  it('rechaza etiquetas demasiado largas', () => {
    const errs = validatePresentation(
      presentation({ diagram: { kind: 'steps', nodes: [{ label: 'UNA ETIQUETA LARGUÍSIMA' }, { label: 'DOS', edge: 'x'.repeat(23) }] } }),
      'x',
    );
    expect(errs.join('\n')).toMatch(/14 caracteres/);
    expect(errs.join('\n')).toMatch(/22 caracteres/);
  });
  it('split necesita exactamente 2 columnas con ítems cortos', () => {
    expect(validatePresentation(presentation({ diagram: { kind: 'split', columns: [{ label: 'A', items: ['x'] }] } }), 'x').join()).toMatch(
      /exactamente 2 columnas/,
    );
    expect(
      validatePresentation(
        presentation({ diagram: { kind: 'split', columns: [{ label: 'A', items: ['x'.repeat(25)] }, { label: 'B', items: ['y'] }] } }),
        'x',
      ).join(),
    ).toMatch(/24 caracteres/);
  });
  it('exige source completo', () => {
    expect(validatePresentation(presentation({ source: { repo: '', path: 'p', commit: 'c', author: 'a', license: 'MIT' } }), 'x').join()).toMatch(
      /source.repo/,
    );
  });
});

describe('validateCatalog', () => {
  it('acepta un catálogo válido', () => {
    expect(validateCatalog(catalog([power('alpha'), power('beta')])).ok).toBe(true);
  });
  it('rechaza schemaVersion y fecha inválidas', () => {
    expect(errorsOf({ ...catalog([]), schemaVersion: 2 }).join()).toMatch(/schemaVersion/);
    expect(errorsOf({ ...catalog([]), generatedAt: 'ayer' }).join()).toMatch(/generatedAt/);
  });
  it('rechaza rutas peligrosas aunque el hash coincida', () => {
    const evil = power('evil', { 'SKILL.md': '---\nname: evil\ndescription: d\n---\n', '../../.vscode/settings.json': '{}' });
    expect(errorsOf(catalog([evil])).join()).toMatch(/ruta de archivo no permitida/);
  });
  it('rechaza hash que no coincide', () => {
    const p = { ...power('alpha'), sha256: 'a'.repeat(64) };
    expect(errorsOf(catalog([p])).join()).toMatch(/hash no coincide/);
  });
  it('rechaza ids duplicados y falta de SKILL.md', () => {
    expect(errorsOf(catalog([power('alpha'), power('alpha')])).join()).toMatch(/duplicado/);
    expect(errorsOf(catalog([power('x', { 'README.md': 'x' })])).join()).toMatch(/SKILL.md/);
  });
});

describe('newestCatalog', () => {
  it('elige el de generatedAt más reciente; empate gana el actual', () => {
    const a = catalog([], '2026-01-01T00:00:00.000Z');
    const b = catalog([], '2026-02-01T00:00:00.000Z');
    expect(newestCatalog(a, b)).toBe(b);
    expect(newestCatalog(b, a)).toBe(b);
    const c = catalog([], '2026-01-01T00:00:00.000Z');
    expect(newestCatalog(a, c)).toBe(a);
    expect(newestCatalog(undefined, a)).toBe(a);
    expect(newestCatalog(a, undefined)).toBe(a);
  });
});
