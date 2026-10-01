import { currentPhase, DocKind, DocStates, SpecType } from '../specs/phase';
import { isLeaf, parseTasks } from '../specs/tasks';
import { phaseBar } from './labels';

export interface LensSpec {
  line: number;
  title: string;
  command?: string;
  args?: unknown[];
}

export function computeLenses(ctx: {
  folder: string;
  spec: string;
  kind: DocKind;
  text: string;
  type: SpecType;
  states: DocStates;
}): LensSpec[] {
  const phase = currentPhase(ctx.states);
  const lenses: LensSpec[] = [{ line: 0, title: phaseBar(ctx.type, ctx.states) }];
  if (phase === ctx.kind && ctx.states[ctx.kind]?.status === 'draft') {
    lenses.push({ line: 0, title: '✓ Aprobar y continuar', command: 'sddStudio.approveAndContinue', args: [ctx.folder, ctx.spec, ctx.kind] });
  }
  if (ctx.kind !== 'tasks') return lenses;
  if (phase !== 'implementation') {
    lenses.push({ line: 0, title: 'Aprueba las tareas para poder ejecutarlas' });
    return lenses;
  }

  const { tasks } = parseTasks(ctx.text);
  for (const task of tasks.filter((t) => isLeaf(t, tasks))) {
    const args = [ctx.folder, ctx.spec, task.id];
    if (task.status === 'done') {
      lenses.push({ line: task.line, title: '✓ completada' });
      continue;
    }
    if (task.status === 'in_progress') {
      lenses.push({ line: task.line, title: '◐ en curso' });
      lenses.push({ line: task.line, title: '✓ Marcar hecha', command: 'sddStudio.markTaskDone', args });
    } else {
      lenses.push({ line: task.line, title: '▶ Ejecutar tarea', command: 'sddStudio.runTask', args });
    }
    if (task.requirements.length > 0) {
      lenses.push({
        line: task.line,
        title: 'Ver requisitos',
        command: 'sddStudio.openRequirements',
        args: [ctx.folder, ctx.spec, task.requirements],
      });
    }
  }
  return lenses;
}
