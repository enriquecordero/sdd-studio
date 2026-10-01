import type { DocStatus } from '../specs/frontMatter';
import { currentPhase, docOrder, DocStates, Phase, PHASE_LABELS, SpecType } from '../specs/phase';

interface DocLike {
  exists: boolean;
  status: DocStatus;
}

export function phaseBar(type: SpecType, states: DocStates): string {
  const current = currentPhase(states);
  const steps: Phase[] = [...docOrder(type), 'implementation'];
  return steps
    .map((step) => {
      const label = PHASE_LABELS[step];
      if (step !== 'implementation' && states[step]?.exists && states[step]?.status === 'approved') return `✓ ${label}`;
      if (step === current) return `● ${label}`;
      return label;
    })
    .join(' → ');
}

export function specDescription(phase: Phase, progress: { done: number; total: number }): string {
  return phase === 'implementation' ? `${progress.done}/${progress.total} tareas` : PHASE_LABELS[phase];
}

export function docStatusLabel(doc: DocLike, isCurrent: boolean): string {
  if (!doc.exists) return 'falta';
  if (doc.status === 'approved') return 'aprobado';
  return isCurrent ? 'borrador · actual' : 'borrador';
}

export function docIcon(doc: DocLike, isCurrent: boolean): string {
  if (!doc.exists) return 'circle-slash';
  if (doc.status === 'approved') return 'pass-filled';
  return isCurrent ? 'circle-filled' : 'circle-outline';
}
