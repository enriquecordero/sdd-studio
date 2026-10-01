import { SpecError } from './errors';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  optional: boolean;
  line: number;
  depth: number;
  requirements: string[];
  parentId?: string;
}

export interface TaskWarning {
  line: number;
  message: string;
}

const TASK_RE = /^(\s*)- \[([ xX-])\](\*)? (\d+(?:\.\d+)*)\.?\s+(.*)$/;
const CHECKBOX_RE = /^\s*- \[[^\]]?\]/;
const REQUIREMENTS_RE = /_(?:Requisitos|Requirements):\s*([^_]+)_/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
const STATUS_FROM_MARK: Record<string, TaskStatus> = { ' ': 'todo', '-': 'in_progress', x: 'done', X: 'done' };
const MARK_FROM_STATUS: Record<TaskStatus, string> = { todo: ' ', in_progress: '-', done: 'x' };

/** Separa en [línea, salto, línea, salto, …] para poder reconstruir el texto exacto. */
function splitKeepingEol(text: string): string[] {
  return text.split(/(\r?\n)/);
}

/** Última línea (índice) del front matter inicial, o -1 si no hay uno cerrado. */
function leadingFrontMatterEnd(parts: string[]): number {
  if (parts[0]?.trimEnd() !== '---') return -1;
  for (let i = 2; i < parts.length; i += 2) {
    if (parts[i].trimEnd() === '---') return i / 2;
  }
  return -1;
}

export function parseTasks(text: string): { tasks: Task[]; warnings: TaskWarning[] } {
  const parts = splitKeepingEol(text);
  const tasks: Task[] = [];
  const warnings: TaskWarning[] = [];
  const seen = new Set<string>();
  const frontMatterEnd = leadingFrontMatterEnd(parts);
  let fence: string | undefined;

  for (let i = 0; i < parts.length; i += 2) {
    const raw = parts[i];
    const line = i / 2;
    if (line <= frontMatterEnd) continue;
    const fenceMatch = FENCE_RE.exec(raw);
    if (fence !== undefined) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length && raw.trim() === fenceMatch[1]) {
        fence = undefined;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    const match = TASK_RE.exec(raw);
    if (match) {
      const [, , mark, star, id, title] = match;
      if (seen.has(id)) {
        warnings.push({ line, message: `Id de tarea duplicado: ${id}` });
        continue;
      }
      seen.add(id);
      const parent = id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : undefined;
      tasks.push({
        id,
        title: title.trim(),
        status: STATUS_FROM_MARK[mark],
        optional: star === '*',
        line,
        depth: id.split('.').length - 1,
        requirements: [],
        parentId: parent !== undefined && seen.has(parent) ? parent : undefined,
      });
      continue;
    }
    if (CHECKBOX_RE.test(raw)) {
      warnings.push({ line, message: 'Línea de tarea no reconocida: se esperaba "- [ ] N. título".' });
      continue;
    }
    const reqs = REQUIREMENTS_RE.exec(raw);
    if (reqs && tasks.length > 0) {
      tasks[tasks.length - 1].requirements.push(
        ...reqs[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return { tasks, warnings };
}

/**
 * Hoja ejecutable: una tarea sin subtareas obligatorias. Un padre cuyas subtareas son todas
 * opcionales se ejecuta y se marca directamente (nunca se calcula a partir de sus hijas).
 */
export function isLeaf(task: Task, tasks: Task[]): boolean {
  return !tasks.some((t) => t.parentId === task.id && !t.optional);
}

function parentStatus(children: TaskStatus[]): TaskStatus {
  if (children.every((s) => s === 'done')) return 'done';
  if (children.some((s) => s !== 'todo')) return 'in_progress';
  return 'todo';
}

export function withTaskStatus(text: string, taskId: string, status: TaskStatus): string {
  const parts = splitKeepingEol(text);
  const { tasks } = parseTasks(text);
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new SpecError('TASK_NOT_FOUND', `No existe la tarea ${taskId} en tasks.md.`);

  const wanted = new Map<string, TaskStatus>(tasks.map((t) => [t.id, t.status]));
  wanted.set(taskId, status);

  let parentId = target.parentId;
  while (parentId !== undefined) {
    const required = tasks.filter((t) => t.parentId === parentId && !t.optional);
    if (required.length === 0) break;
    wanted.set(parentId, parentStatus(required.map((c) => wanted.get(c.id)!)));
    parentId = tasks.find((t) => t.id === parentId)!.parentId;
  }

  for (const task of tasks) {
    const next = wanted.get(task.id)!;
    if (next !== task.status) {
      parts[task.line * 2] = parts[task.line * 2].replace(/\[[ xX-]\]/, `[${MARK_FROM_STATUS[next]}]`);
    }
  }
  return parts.join('');
}

export function progress(tasks: Task[]): { done: number; total: number } {
  const counted = tasks.filter((t) => !t.optional && isLeaf(t, tasks));
  return { done: counted.filter((t) => t.status === 'done').length, total: counted.length };
}
