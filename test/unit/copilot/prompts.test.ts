import { describe, expect, it } from 'vitest';
import { nextPhasePrompt, runTaskPrompt, steeringPrompt } from '../../../src/copilot/prompts';

describe('runTaskPrompt', () => {
  it('incluye tarea, criterios y referencias #file', () => {
    const p = runTaskPrompt({
      specsFolder: 'specs',
      spec: 'pagos-checkout',
      type: 'feature',
      task: { id: '2.1', title: 'Validar carrito', requirements: ['2.1', '2.2'] },
    });
    expect(p).toContain('Ejecuta la tarea 2.1 del spec "pagos-checkout": Validar carrito');
    expect(p).toContain('Criterios relacionados: 2.1, 2.2');
    expect(p).toContain('#file:specs/pagos-checkout/requirements.md #file:specs/pagos-checkout/design.md #file:specs/pagos-checkout/tasks.md');
    expect(p).toContain('No la marques como hecha');
  });
  it('bugfix referencia bugfix.md y sin criterios lo dice', () => {
    const p = runTaskPrompt({ specsFolder: 'specs', spec: 'b', type: 'bugfix', task: { id: '1', title: 't', requirements: [] } });
    expect(p).toContain('#file:specs/b/bugfix.md');
    expect(p).toContain('Criterios relacionados: ninguno indicado');
  });
});

describe('nextPhasePrompt', () => {
  it('requisitos y bugfix → sdd-design; diseño → sdd-tasks; tareas → nada', () => {
    expect(nextPhasePrompt({ spec: 's', approved: 'requirements', language: 'es' })?.agent).toBe('sdd-design');
    expect(nextPhasePrompt({ spec: 's', approved: 'bugfix', language: 'es' })?.agent).toBe('sdd-design');
    expect(nextPhasePrompt({ spec: 's', approved: 'design', language: 'es' })?.agent).toBe('sdd-tasks');
    expect(nextPhasePrompt({ spec: 's', approved: 'tasks', language: 'es' })).toBeUndefined();
    expect(nextPhasePrompt({ spec: 's', approved: 'design', language: 'es' })?.prompt).toContain('Ya aprobé design.md del spec "s"');
  });
  it('añade la línea de idioma (M4)', () => {
    expect(nextPhasePrompt({ spec: 's', approved: 'requirements', language: 'es' })?.prompt).toContain('Redacta en español');
    expect(nextPhasePrompt({ spec: 's', approved: 'design', language: 'en' })?.prompt).toContain('Write the document in English');
    expect(nextPhasePrompt({ spec: 's', approved: 'bugfix', language: 'en' })?.prompt).toContain('Write the document in English');
  });
});

describe('steeringPrompt', () => {
  it('pide los tres archivos', () => {
    const p = steeringPrompt('es');
    expect(p).toContain('product.instructions.md');
    expect(p).toContain('tech.instructions.md');
    expect(p).toContain('structure.instructions.md');
  });
});
