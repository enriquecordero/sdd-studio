export type SpecErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_NAME'
  | 'TYPE_MISMATCH'
  | 'DOC_MISSING'
  | 'PREVIOUS_NOT_APPROVED'
  | 'NOT_READY'
  | 'TASK_NOT_FOUND'
  | 'FOLDER';

export class SpecError extends Error {
  constructor(
    readonly code: SpecErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SpecError';
  }
}
