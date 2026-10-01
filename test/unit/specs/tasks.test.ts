import { describe, expect, it } from 'vitest';
import { SpecError } from '../../../src/specs/errors';
import { isLeaf, parseTasks, progress, withTaskStatus } from '../../../src/specs/tasks';

const DOC = [
  '---',
  'status: approved',
  '---',
  '# Plan de implementación — pagos',
  '',
  '- [x] 1. Modelo PaymentIntent',
  '  - _Requisitos: 1.1, 1.2_',
  '- [ ] 2. Endpoint POST /checkout',
  '  - [ ] 2.1 Validar carrito',
  '    - _Requisitos: 2.1_',
  '  - [ ] 2.2 Idempotency-Key',
  '    - _Requirements: 2.3_',
  '- [ ]* 3. Métricas',
  '',
].join('\n');

describe('parseTasks', () => {
  it('lee ids, títulos, estados, opcionales, profundidad, padre y requisitos', () => {
    const { tasks, warnings } = parseTasks(DOC);
    expect(warnings).toEqual([]);
    expect(tasks.map((t) => [t.id, t.status, t.optional, t.depth, t.parentId])).toEqual([
      ['1', 'done', false, 0, undefined],
      ['2', 'todo', false, 0, undefined],
      ['2.1', 'todo', false, 1, '2'],
      ['2.2', 'todo', false, 1, '2'],
      ['3', 'todo', true, 0, undefined],
    ]);
    expect(tasks[0]).toMatchObject({ title: 'Modelo PaymentIntent', line: 5, requirements: ['1.1', '1.2'] });
    expect(tasks[3].requirements).toEqual(['2.3']);
  });

  it('acepta [-] y [X]', () => {
    const { tasks } = parseTasks('- [-] 1. a\n- [X] 2. b\n');
    expect(tasks.map((t) => t.status)).toEqual(['in_progress', 'done']);
  });

  it('avisa de casillas mal formadas e ids duplicados sin romper', () => {
    const { tasks, warnings } = parseTasks('- [ ] 1. ok\n- [?] 2. raro\n- [ ] sin número\n- [ ] 1. repetida\n');
    expect(tasks.map((t) => t.id)).toEqual(['1']);
    expect(warnings.map((w) => w.line)).toEqual([1, 2, 3]);
  });
});

describe('withTaskStatus', () => {
  it('cambia solo la casilla de la tarea y deja el resto idéntico', () => {
    const next = withTaskStatus(DOC, '2.1', 'in_progress');
    const before = DOC.split('\n');
    const after = next.split('\n');
    expect(after[8]).toBe('  - [-] 2.1 Validar carrito');
    expect(after[7]).toBe('- [-] 2. Endpoint POST /checkout');
    expect(after.filter((_, i) => i !== 7 && i !== 8)).toEqual(before.filter((_, i) => i !== 7 && i !== 8));
  });

  it('marca el padre hecho cuando todas sus subtareas obligatorias lo están', () => {
    const step1 = withTaskStatus(DOC, '2.1', 'done');
    expect(step1.split('\n')[7]).toBe('- [-] 2. Endpoint POST /checkout');
    const step2 = withTaskStatus(step1, '2.2', 'done');
    expect(step2.split('\n')[7]).toBe('- [x] 2. Endpoint POST /checkout');
  });

  it('el padre vuelve a pendiente si se reabren todas sus subtareas', () => {
    const done = withTaskStatus(withTaskStatus(DOC, '2.1', 'done'), '2.2', 'done');
    const reopened = withTaskStatus(withTaskStatus(done, '2.1', 'todo'), '2.2', 'todo');
    expect(reopened.split('\n')[7]).toBe('- [ ] 2. Endpoint POST /checkout');
  });

  it('preserva CRLF', () => {
    const crlf = DOC.replace(/\n/g, '\r\n');
    const next = withTaskStatus(crlf, '1', 'todo');
    expect(next).toBe(crlf.replace('- [x] 1. Modelo', '- [ ] 1. Modelo'));
    expect(next.split('\r\n').length).toBe(crlf.split('\r\n').length);
  });

  it('lanza TASK_NOT_FOUND si no existe', () => {
    expect(() => withTaskStatus(DOC, '9', 'done')).toThrowError(SpecError);
    try {
      withTaskStatus(DOC, '9', 'done');
    } catch (e) {
      expect((e as SpecError).code).toBe('TASK_NOT_FOUND');
    }
  });
});

describe('progress', () => {
  it('cuenta hojas obligatorias', () => {
    expect(progress(parseTasks(DOC).tasks)).toEqual({ done: 1, total: 3 });
  });
  it('documento vacío', () => {
    expect(progress(parseTasks('').tasks)).toEqual({ done: 0, total: 0 });
  });
});

const OPTIONAL_ONLY = [
  '- [x] 1. a',
  '- [ ] 2. Padre obligatorio',
  '  - [ ]* 2.1 Tests opcionales',
  '',
].join('\n');

describe('padre obligatorio con solo subtareas opcionales (I1)', () => {
  it('es una hoja ejecutable y cuenta en el progreso', () => {
    const { tasks } = parseTasks(OPTIONAL_ONLY);
    expect(isLeaf(tasks[1], tasks)).toBe(true);
    expect(isLeaf(tasks[2], tasks)).toBe(true);
    expect(progress(tasks)).toEqual({ done: 1, total: 2 });
  });

  it('marcar la subtarea opcional no cambia el padre', () => {
    const next = withTaskStatus(OPTIONAL_ONLY, '2.1', 'done');
    expect(next.split('\n')[1]).toBe('- [ ] 2. Padre obligatorio');
    expect(next.split('\n')[2]).toBe('  - [x]* 2.1 Tests opcionales');
  });

  it('el padre se marca directamente', () => {
    const next = withTaskStatus(OPTIONAL_ONLY, '2', 'done');
    expect(next.split('\n')[1]).toBe('- [x] 2. Padre obligatorio');
    expect(next.split('\n')[2]).toBe('  - [ ]* 2.1 Tests opcionales');
    expect(progress(parseTasks(next).tasks)).toEqual({ done: 2, total: 2 });
  });
});

describe('bloques de código y front matter (M2)', () => {
  const FENCED = [
    '---',
    'status: approved',
    '- [ ] 9. no es tarea (front matter)',
    '---',
    '# Plan',
    '',
    'Ejemplo de formato:',
    '```markdown',
    '- [ ] 1. Ejemplo',
    '  - _Requisitos: 9.9_',
    '```',
    '~~~',
    '- [ ] 2. Otro ejemplo',
    '~~~',
    '- [ ] 1. Real',
    '  - _Requisitos: 1.1_',
    '',
  ].join('\n');

  it('ignora las líneas dentro de bloques de código y del front matter', () => {
    const { tasks, warnings } = parseTasks(FENCED);
    expect(warnings).toEqual([]);
    expect(tasks.map((t) => [t.id, t.title, t.line, t.requirements])).toEqual([['1', 'Real', 14, ['1.1']]]);
  });

  it('withTaskStatus edita la tarea real, no el ejemplo', () => {
    const next = withTaskStatus(FENCED, '1', 'done');
    const lines = next.split('\n');
    expect(lines[8]).toBe('- [ ] 1. Ejemplo');
    expect(lines[14]).toBe('- [x] 1. Real');
  });
});

describe('front matter sin cerrar (M2)', () => {
  it('un --- inicial sin cierre no oculta las tareas', () => {
    expect(parseTasks('---\n- [ ] 1. a\n').tasks.map((t) => t.id)).toEqual(['1']);
  });
});
