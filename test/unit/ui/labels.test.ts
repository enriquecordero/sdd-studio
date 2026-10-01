import { describe, expect, it } from 'vitest';
import { docIcon, docStatusLabel, phaseBar, specDescription } from '../../../src/ui/labels';

const ok = { exists: true, status: 'approved' as const };
const draft = { exists: true, status: 'draft' as const };

describe('labels', () => {
  it('phaseBar feature en diseño', () => {
    expect(phaseBar('feature', { requirements: ok, design: draft })).toBe('✓ Requisitos → ● Diseño → Tareas → Implementación');
  });
  it('phaseBar bugfix terminado', () => {
    expect(phaseBar('bugfix', { bugfix: ok, design: ok, tasks: ok })).toBe('✓ Bug → ✓ Diseño → ✓ Tareas → ● Implementación');
  });
  it('specDescription', () => {
    expect(specDescription('design', { done: 0, total: 0 })).toBe('Diseño');
    expect(specDescription('implementation', { done: 1, total: 3 })).toBe('1/3 tareas');
  });
  it('estado e icono de documento', () => {
    expect(docStatusLabel({ exists: false, status: 'draft' }, true)).toBe('falta');
    expect(docStatusLabel(ok, false)).toBe('aprobado');
    expect(docStatusLabel(draft, true)).toBe('borrador · actual');
    expect(docIcon({ exists: false, status: 'draft' }, false)).toBe('circle-slash');
    expect(docIcon(ok, false)).toBe('pass-filled');
    expect(docIcon(draft, true)).toBe('circle-filled');
    expect(docIcon(draft, false)).toBe('circle-outline');
  });
});
