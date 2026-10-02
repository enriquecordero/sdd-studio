import { describe, expect, it } from 'vitest';
import { catalogV1, compareSemver, isSafeRelativePath, newestCatalog, validateCatalog, validatePresentation } from '../../../src/powers/catalog';
import { catalogPowerHash, powerHash } from '../../../src/powers/hash';
import { catalog, mcpPower, mcpSpec, power, presentation } from '../../support/powerFixtures';

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
    expect(errorsOf({ ...catalog([]), schemaVersion: 3 }).join()).toMatch(/schemaVersion/);
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

describe('catálogo v2 (MCP)', () => {
  it('acepta v1 y v2 sin MCP, y v2 con MCP', () => {
    expect(validateCatalog(catalog([power('alpha')], undefined, 1)).ok).toBe(true);
    expect(validateCatalog(catalog([power('alpha')], undefined, 2)).ok).toBe(true);
    expect(validateCatalog(catalog([power('alpha'), mcpPower('cloudy')])).ok).toBe(true);
  });
  it('un Power con mcp en un catálogo v1 es inválido', () => {
    expect(errorsOf(catalog([mcpPower('cloudy')], undefined, 1)).join()).toMatch(/schemaVersion 2/);
  });
  it('el hash cubre mcp: cambiar el spec sin recalcular lo invalida', () => {
    const p = mcpPower('cloudy');
    expect(p.sha256).toBe(catalogPowerHash(p.files, p.mcp));
    expect(p.sha256).not.toBe(powerHash(p.files));
    const tampered = { ...p, mcp: mcpSpec({ approxTools: { 'sdd-x': 99 } }) };
    expect(errorsOf(catalog([tampered])).join()).toMatch(/hash no coincide/);
  });
  it('valida el mcp con validateMcpSpec', () => {
    const bad = mcpPower('cloudy', mcpSpec({ approxTools: {} }));
    expect(errorsOf(catalog([bad])).join()).toMatch(/approxTools.sdd-x/);
  });
  it('rechaza nombres de servidor repetidos entre Powers y un archivo llamado mcp.vscode.json', () => {
    expect(errorsOf(catalog([mcpPower('uno'), mcpPower('dos')])).join()).toMatch(/Servidor MCP duplicado entre Powers: sdd-x/);
    const sneaky = power('alpha', { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\n', 'mcp.vscode.json': '{}' });
    expect(errorsOf(catalog([sneaky])).join()).toMatch(/ruta de archivo no permitida "mcp.vscode.json"/);
  });
  it('catalogV1 deja fuera los Powers con MCP y sigue siendo válido', () => {
    const v1 = catalogV1(catalog([power('alpha'), mcpPower('cloudy')]));
    expect(v1.schemaVersion).toBe(1);
    expect(v1.powers.map((p) => p.id)).toEqual(['alpha']);
    expect(validateCatalog(v1).ok).toBe(true);
  });
});

describe('newestCatalog', () => {
  it('gana el de schemaVersion mayor aunque el otro sea más reciente', () => {
    const oldV2 = catalog([], '2026-01-01T00:00:00.000Z', 2);
    const newV1 = catalog([], '2026-12-01T00:00:00.000Z', 1);
    expect(newestCatalog(oldV2, newV1)).toBe(oldV2);
    expect(newestCatalog(newV1, oldV2)).toBe(oldV2);
  });
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
