import { describe, expect, it } from 'vitest';
import { findRequirementLine } from '../../../src/specs/requirements';

const DOC = [
  '# Requisitos — export-csv', // 0
  '## Requisitos', // 1
  '### Requisito 1: Exportar', // 2
  '**Historia:** …', // 3
  '#### Criterios de aceptación', // 4
  '1. WHEN a THE SYSTEM SHALL b.', // 5
  '2. IF c THEN THE SYSTEM SHALL d.', // 6
  '### Requisito 2: Seguridad', // 7
  '#### Criterios de aceptación', // 8
  '1. THE SYSTEM SHALL NOT e.', // 9
].join('\n');

describe('findRequirementLine', () => {
  it('encuentra el criterio N.M', () => {
    expect(findRequirementLine(DOC, '1.2')).toBe(6);
    expect(findRequirementLine(DOC, '2.1')).toBe(9);
  });
  it('sin criterio devuelve el encabezado', () => {
    expect(findRequirementLine(DOC, '2')).toBe(7);
  });
  it('criterio inexistente devuelve el encabezado del requisito', () => {
    expect(findRequirementLine(DOC, '1.9')).toBe(2);
  });
  it('requisito inexistente devuelve undefined', () => {
    expect(findRequirementLine(DOC, '7.1')).toBeUndefined();
  });
  it('entiende encabezados en inglés', () => {
    expect(findRequirementLine('### Requirement 3: X\n1. a\n', '3.1')).toBe(1);
  });
});
