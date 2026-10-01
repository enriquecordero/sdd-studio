import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../../scripts/build-catalog';

const EXPECTED = ['tdd', 'systematic-debugging', 'verification', 'grill-me', 'prototype', 'research', 'domain-modeling', 'code-review', 'codebase-design'];

describe('catálogo real (powers/)', () => {
  it('todos los Powers pasan el guardián y están los esperados', () => {
    const { catalog, errors } = buildCatalog(join(__dirname, '../../../powers'));
    expect(errors).toEqual([]);
    expect(catalog.powers.map((p) => p.id).sort()).toEqual([...EXPECTED].sort());
  });
});
