import { describe, expect, it } from 'vitest';
import { SpecError } from '../../../src/specs/errors';
import {
  assertCanApprove,
  assertDocMatchesType,
  currentPhase,
  docOrder,
  docsAfter,
  DocStates,
  specType,
} from '../../../src/specs/phase';

const draft = { exists: true, status: 'draft' as const };
const ok = { exists: true, status: 'approved' as const };

function code(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as SpecError).code;
  }
}

describe('tipo y fase', () => {
  it('feature por defecto, bugfix si existe bugfix.md', () => {
    expect(specType({})).toBe('feature');
    expect(specType({ bugfix: draft })).toBe('bugfix');
    expect(docOrder('bugfix')).toEqual(['bugfix', 'design', 'tasks']);
  });
  it('la fase es el primer documento no aprobado', () => {
    expect(currentPhase({})).toBe('requirements');
    expect(currentPhase({ requirements: ok, design: draft })).toBe('design');
    expect(currentPhase({ requirements: ok, design: ok })).toBe('tasks');
    expect(currentPhase({ requirements: ok, design: ok, tasks: ok })).toBe('implementation');
    expect(currentPhase({ bugfix: ok })).toBe('design');
  });
  it('docsAfter', () => {
    expect(docsAfter('requirements')).toEqual(['design', 'tasks']);
    expect(docsAfter('bugfix')).toEqual(['design', 'tasks']);
    expect(docsAfter('design')).toEqual(['tasks']);
    expect(docsAfter('tasks')).toEqual([]);
  });
});

describe('reglas', () => {
  it('no se mezcla requirements con bugfix', () => {
    expect(code(() => assertDocMatchesType({ requirements: draft }, 'bugfix'))).toBe('TYPE_MISMATCH');
    expect(code(() => assertDocMatchesType({ bugfix: draft }, 'requirements'))).toBe('TYPE_MISMATCH');
    expect(code(() => assertDocMatchesType({}, 'bugfix'))).toBeUndefined();
  });
  it('no se aprueba un documento que no existe', () => {
    expect(code(() => assertCanApprove({}, 'requirements'))).toBe('DOC_MISSING');
  });
  it('no se aprueba si falta aprobar uno anterior', () => {
    const states: DocStates = { requirements: draft, design: draft };
    expect(code(() => assertCanApprove(states, 'design'))).toBe('PREVIOUS_NOT_APPROVED');
    expect(code(() => assertCanApprove(states, 'requirements'))).toBeUndefined();
  });
  it('aprobar bugfix en un spec feature es TYPE_MISMATCH', () => {
    expect(code(() => assertCanApprove({ requirements: ok, bugfix: draft }, 'bugfix'))).toBe('TYPE_MISMATCH');
  });
});
