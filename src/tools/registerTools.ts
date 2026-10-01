import * as vscode from 'vscode';
import { SpecError } from '../specs/errors';
import { isDocKind } from '../specs/phase';
import { TaskStatus } from '../specs/tasks';
import { SpecService } from '../workspace/specService';

export interface ToolHandlers {
  writeSpecDoc(input: unknown): Promise<string>;
  approvePhase(input: unknown): Promise<string>;
  setTaskStatus(input: unknown): Promise<string>;
}

const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done'];

function obj(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) throw new SpecError('INVALID_INPUT', 'La entrada debe ser un objeto.');
  return input as Record<string, unknown>;
}

function str(o: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = o[key];
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') throw new SpecError('INVALID_INPUT', `Falta "${key}" (texto).`);
  return value;
}

function doc(o: Record<string, unknown>) {
  const value = o.doc;
  if (!isDocKind(value)) throw new SpecError('INVALID_INPUT', '"doc" debe ser requirements, bugfix, design o tasks.');
  return value;
}

function wrap(fn: (input: unknown) => Promise<string>): (input: unknown) => Promise<string> {
  return async (input) => {
    try {
      return await fn(input);
    } catch (e) {
      if (e instanceof SpecError) return `ERROR (${e.code}): ${e.message}`;
      throw e;
    }
  };
}

export function createToolHandlers(service: SpecService): ToolHandlers {
  return {
    writeSpecDoc: wrap(async (input) => {
      const o = obj(input);
      return service.writeSpecDoc({ folder: str(o, 'folder', false), spec: str(o, 'spec')!, doc: doc(o), content: str(o, 'content')! });
    }),
    approvePhase: wrap(async (input) => {
      const o = obj(input);
      return service.approvePhase({ folder: str(o, 'folder', false), spec: str(o, 'spec')!, doc: doc(o) });
    }),
    setTaskStatus: wrap(async (input) => {
      const o = obj(input);
      const status = o.status;
      if (!TASK_STATUSES.includes(status as TaskStatus)) {
        throw new SpecError('INVALID_INPUT', '"status" debe ser todo, in_progress o done.');
      }
      return service.setTaskStatus({
        folder: str(o, 'folder', false),
        spec: str(o, 'spec')!,
        taskId: str(o, 'taskId')!,
        status: status as TaskStatus,
      });
    }),
  };
}

export function registerTools(handlers: ToolHandlers): vscode.Disposable {
  const register = (name: string, fn: (input: unknown) => Promise<string>, message: string) =>
    vscode.lm.registerTool<unknown>(name, {
      prepareInvocation: () => ({ invocationMessage: message }),
      invoke: async (options) => new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(await fn(options.input))]),
    });
  return vscode.Disposable.from(
    register('sdd_writeSpecDoc', handlers.writeSpecDoc, 'Escribiendo documento del spec…'),
    register('sdd_approvePhase', handlers.approvePhase, 'Aprobando fase del spec…'),
    register('sdd_setTaskStatus', handlers.setTaskStatus, 'Actualizando estado de la tarea…'),
  );
}
