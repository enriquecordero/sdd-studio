import { SpecError } from './errors';
import { DocStatus } from './frontMatter';

export type DocKind = 'requirements' | 'bugfix' | 'design' | 'tasks';
export const ALL_DOC_KINDS: readonly DocKind[] = ['requirements', 'bugfix', 'design', 'tasks'];
export type SpecType = 'feature' | 'bugfix';
export type Phase = DocKind | 'implementation';

export interface DocState {
  exists: boolean;
  status: DocStatus;
}
export type DocStates = Partial<Record<DocKind, DocState>>;

export const PHASE_LABELS: Record<Phase, string> = {
  requirements: 'Requisitos',
  bugfix: 'Bug',
  design: 'Diseño',
  tasks: 'Tareas',
  implementation: 'Implementación',
};

export function isDocKind(value: unknown): value is DocKind {
  return typeof value === 'string' && (ALL_DOC_KINDS as readonly string[]).includes(value);
}

function exists(states: DocStates, kind: DocKind): boolean {
  return states[kind]?.exists === true;
}

function approved(states: DocStates, kind: DocKind): boolean {
  return exists(states, kind) && states[kind]!.status === 'approved';
}

export function specType(states: DocStates): SpecType {
  return exists(states, 'bugfix') ? 'bugfix' : 'feature';
}

export function docOrder(type: SpecType): DocKind[] {
  return [type === 'bugfix' ? 'bugfix' : 'requirements', 'design', 'tasks'];
}

export function currentPhase(states: DocStates): Phase {
  for (const kind of docOrder(specType(states))) {
    if (!approved(states, kind)) return kind;
  }
  return 'implementation';
}

export function docsAfter(kind: DocKind): DocKind[] {
  if (kind === 'requirements' || kind === 'bugfix') return ['design', 'tasks'];
  if (kind === 'design') return ['tasks'];
  return [];
}

export function docFileName(kind: DocKind): string {
  return `${kind}.md`;
}

export function assertDocMatchesType(states: DocStates, kind: DocKind): void {
  if (kind === 'bugfix' && exists(states, 'requirements')) {
    throw new SpecError('TYPE_MISMATCH', 'Este spec es de feature (tiene requirements.md); no puede llevar bugfix.md.');
  }
  if (kind === 'requirements' && exists(states, 'bugfix')) {
    throw new SpecError('TYPE_MISMATCH', 'Este spec es de bugfix (tiene bugfix.md); no puede llevar requirements.md.');
  }
}

export function assertCanApprove(states: DocStates, kind: DocKind): void {
  assertDocMatchesType(states, kind);
  const order = docOrder(specType(states));
  const index = order.indexOf(kind);
  if (index < 0) {
    throw new SpecError('TYPE_MISMATCH', `${docFileName(kind)} no corresponde al tipo de este spec.`);
  }
  if (!exists(states, kind)) {
    throw new SpecError('DOC_MISSING', `No existe ${docFileName(kind)}: escríbelo antes de aprobarlo.`);
  }
  const pending = order.slice(0, index).filter((k) => !approved(states, k));
  if (pending.length > 0) {
    throw new SpecError('PREVIOUS_NOT_APPROVED', `Antes aprueba: ${pending.map(docFileName).join(', ')}.`);
  }
}
