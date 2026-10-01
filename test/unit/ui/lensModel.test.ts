import { describe, expect, it } from 'vitest';
import { computeLenses } from '../../../src/ui/lensModel';

const ok = { exists: true, status: 'approved' as const };
const draft = { exists: true, status: 'draft' as const };
const TASKS = [
  '---', // 0
  'status: approved', // 1
  '---', // 2
  '# Plan', // 3
  '- [x] 1. Hecha', // 4
  '- [ ] 2. Padre', // 5
  '  - [-] 2.1 En curso', // 6
  '    - _Requisitos: 2.1_', // 7
  '  - [ ] 2.2 Pendiente', // 8
  '    - _Requisitos: 2.3_', // 9
].join('\n');

const base = { folder: 'ws', spec: 'pagos', type: 'feature' as const };

describe('computeLenses', () => {
  it('documento en borrador de la fase actual: barra + Aprobar y continuar', () => {
    const lenses = computeLenses({ ...base, kind: 'design', text: '# D', states: { requirements: ok, design: draft } });
    expect(lenses).toEqual([
      { line: 0, title: '✓ Requisitos → ● Diseño → Tareas → Implementación' },
      { line: 0, title: '✓ Aprobar y continuar', command: 'sddStudio.approveAndContinue', args: ['ws', 'pagos', 'design'] },
    ]);
  });

  it('tasks.md sin aprobar: no hay Ejecutar tarea', () => {
    const lenses = computeLenses({ ...base, kind: 'tasks', text: TASKS, states: { requirements: ok, design: ok, tasks: draft } });
    expect(lenses.map((l) => l.title)).toEqual([
      '✓ Requisitos → ✓ Diseño → ● Tareas → Implementación',
      '✓ Aprobar y continuar',
      'Aprueba las tareas para poder ejecutarlas',
    ]);
  });

  it('tasks.md aprobado: lenses por tarea hoja según estado; el padre no se ejecuta', () => {
    const lenses = computeLenses({ ...base, kind: 'tasks', text: TASKS, states: { requirements: ok, design: ok, tasks: ok } });
    expect(lenses.slice(1)).toEqual([
      { line: 4, title: '✓ completada' },
      { line: 6, title: '◐ en curso' },
      { line: 6, title: '✓ Marcar hecha', command: 'sddStudio.markTaskDone', args: ['ws', 'pagos', '2.1'] },
      { line: 6, title: 'Ver requisitos', command: 'sddStudio.openRequirements', args: ['ws', 'pagos', ['2.1']] },
      { line: 8, title: '▶ Ejecutar tarea', command: 'sddStudio.runTask', args: ['ws', 'pagos', '2.2'] },
      { line: 8, title: 'Ver requisitos', command: 'sddStudio.openRequirements', args: ['ws', 'pagos', ['2.3']] },
    ]);
  });

  it('documento aprobado: solo la barra', () => {
    const lenses = computeLenses({ ...base, kind: 'requirements', text: '# R', states: { requirements: ok } });
    expect(lenses).toHaveLength(1);
  });
});
