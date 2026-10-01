import { powerHash } from '../../src/powers/hash';
import { Catalog, CatalogPower, Presentation } from '../../src/powers/types';

export function presentation(over: Partial<Presentation> = {}): Presentation {
  return {
    displayName: 'Alpha',
    icon: '🧪',
    category: 'testing',
    summary: 'Resumen de prueba.',
    triggers: ['"implementa…"'],
    diagram: { kind: 'steps', nodes: [{ label: 'UNO', edge: 'luego' }, { label: 'DOS' }] },
    gets: ['Algo útil'],
    source: { repo: 'owner/repo', path: 'skills/alpha', commit: 'abc123', author: 'Autora', license: 'MIT' },
    ...over,
  };
}

export function power(
  id = 'alpha',
  files: Record<string, string> = { 'SKILL.md': `---\nname: ${id}\ndescription: Test skill\n---\nBody\n` },
  version = '1.0.0',
): CatalogPower {
  return { id, version, presentation: presentation({ displayName: id }), skillName: id, files, sha256: powerHash(files) };
}

export function catalog(powers: CatalogPower[], generatedAt = '2026-10-01T00:00:00.000Z'): Catalog {
  return { schemaVersion: 1, generatedAt, powers };
}
