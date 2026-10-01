import { SpecError } from '../specs/errors';
import { prepareSpecDocContent, setFrontMatterFields } from '../specs/frontMatter';
import { isValidSpecName } from '../specs/names';
import { assertCanApprove, assertDocMatchesType, DocKind, docFileName, docsAfter, PHASE_LABELS } from '../specs/phase';
import { TaskStatus, withTaskStatus } from '../specs/tasks';
import { transformFile } from './edits';
import { SpecStore } from './specStore';

export interface WriteSpecDocInput {
  folder?: string;
  spec: string;
  doc: DocKind;
  content: string;
}
export interface ApprovePhaseInput {
  folder?: string;
  spec: string;
  doc: DocKind;
}
export interface SetTaskStatusInput {
  folder?: string;
  spec: string;
  taskId: string;
  status: TaskStatus;
}

const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'pendiente', in_progress: 'en curso', done: 'hecha' };

function assertName(spec: string): void {
  if (!isValidSpecName(spec)) {
    throw new SpecError('INVALID_NAME', `Nombre de spec inválido "${spec}": usa minúsculas, números y guiones (ej. export-csv).`);
  }
}

export class SpecService {
  constructor(
    private readonly store: SpecStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async writeSpecDoc(input: WriteSpecDocInput): Promise<string> {
    assertName(input.spec);
    const folder = await this.store.resolveFolder(input.spec, input.folder, false);
    const snap = await this.store.snapshot(folder, input.spec);
    assertDocMatchesType(snap.states, input.doc);

    const text = setFrontMatterFields(prepareSpecDocContent(input.content), { status: 'draft', approvedAt: undefined });
    await transformFile(this.store.docUri(folder, input.spec, input.doc), () => text);

    const redrafted: DocKind[] = [];
    for (const kind of docsAfter(input.doc)) {
      const state = snap.states[kind];
      if (state?.exists && state.status === 'approved') {
        await transformFile(this.store.docUri(folder, input.spec, kind), (t) =>
          setFrontMatterFields(t ?? '', { status: 'draft', approvedAt: undefined }),
        );
        redrafted.push(kind);
      }
    }
    const extra = redrafted.length ? ` Volvieron a borrador: ${redrafted.map(docFileName).join(', ')}.` : '';
    return `Escribí ${this.store.relPath(input.spec, input.doc)} (borrador).${extra}`;
  }

  async approvePhase(input: ApprovePhaseInput): Promise<string> {
    assertName(input.spec);
    const folder = await this.store.resolveFolder(input.spec, input.folder, true);
    assertCanApprove((await this.store.snapshot(folder, input.spec)).states, input.doc);
    await transformFile(this.store.docUri(folder, input.spec, input.doc), (t) =>
      setFrontMatterFields(t ?? '', { status: 'approved', approvedAt: this.now().toISOString() }),
    );
    const after = await this.store.snapshot(folder, input.spec);
    return `Aprobado ${this.store.relPath(input.spec, input.doc)}. Fase actual: ${PHASE_LABELS[after.phase]}.`;
  }

  async setTaskStatus(input: SetTaskStatusInput): Promise<string> {
    assertName(input.spec);
    const folder = await this.store.resolveFolder(input.spec, input.folder, true);
    const snap = await this.store.snapshot(folder, input.spec);
    if (snap.phase !== 'implementation') {
      throw new SpecError(
        'NOT_READY',
        `Las tareas de "${input.spec}" aún no están aprobadas (fase: ${PHASE_LABELS[snap.phase]}). Aprueba tasks.md antes de ejecutar tareas.`,
      );
    }
    await transformFile(this.store.docUri(folder, input.spec, 'tasks'), (t) => withTaskStatus(t ?? '', input.taskId, input.status));
    return `Tarea ${input.taskId} → ${STATUS_LABELS[input.status]}.`;
  }
}
