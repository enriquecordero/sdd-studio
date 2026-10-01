import * as vscode from 'vscode';
import { nextPhasePrompt, runTaskPrompt } from '../copilot/prompts';
import { SpecError } from '../specs/errors';
import { DocKind } from '../specs/phase';
import { findRequirementLine } from '../specs/requirements';
import { parseTasks } from '../specs/tasks';
import { CommandDeps, language, openAgentSafely } from './specCommands';
import type { SpecsNode } from './specsTree';

async function guarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof SpecError) {
      void vscode.window.showErrorMessage(`SDD Studio: ${e.message}`);
      return;
    }
    throw e;
  }
}

function folderArg(deps: CommandDeps, folder: string): string | undefined {
  return deps.store.folders().length > 1 ? folder : undefined;
}

/**
 * Los comandos se invocan con argumentos posicionales (folder, spec, idOrKind) desde CodeLens y tests,
 * o con un único nodo del panel Specs (menú contextual).
 */
function targetArgs<T extends string>(args: unknown[]): [string, string, T] {
  const [first] = args;
  if (typeof first === 'object' && first !== null && 'type' in first) {
    const node = first as SpecsNode;
    if (node.type === 'task') return [node.snap.folder.name, node.snap.name, node.task.id as T];
    if (node.type === 'doc') return [node.snap.folder.name, node.snap.name, node.doc.kind as T];
  }
  return args as [string, string, T];
}

export function registerTaskCommands(deps: CommandDeps): vscode.Disposable {
  const runTask = (...args: unknown[]) =>
    guarded(async () => {
      const [folder, spec, taskId] = targetArgs<string>(args);
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para ejecutar tareas.');
        return;
      }
      await deps.service.setTaskStatus({ folder, spec, taskId, status: 'in_progress' });
      const wsFolder = await deps.store.resolveFolder(spec, folder, true);
      const snap = await deps.store.snapshot(wsFolder, spec);
      const text = (await deps.store.readText(deps.store.docUri(wsFolder, spec, 'tasks'))) ?? '';
      const task = parseTasks(text).tasks.find((t) => t.id === taskId)!;
      const opened = await openAgentSafely(
        deps,
        'sdd-implement',
        runTaskPrompt({
          specsFolder: deps.store.specsFolder,
          spec,
          folder: folderArg(deps, folder),
          type: snap.type,
          task: { id: task.id, title: task.title, requirements: task.requirements },
        }),
      );
      // Sin chat la tarea no está realmente en curso: vuelve a pendiente.
      if (!opened) await deps.service.setTaskStatus({ folder, spec, taskId, status: 'todo' });
    });

  const markTaskDone = (...args: unknown[]) =>
    guarded(async () => {
      const [folder, spec, taskId] = targetArgs<string>(args);
      const message = await deps.service.setTaskStatus({ folder, spec, taskId, status: 'done' });
      void vscode.window.showInformationMessage(`SDD Studio: ${message}`);
    });

  const approveAndContinue = (...args: unknown[]) =>
    guarded(async () => {
      const [folder, spec, kind] = targetArgs<DocKind>(args);
      await deps.service.approvePhase({ folder, spec, doc: kind });
      const next = nextPhasePrompt({ spec, folder: folderArg(deps, folder), approved: kind, language: language() });
      if (next) {
        // Si Copilot Chat no se abre, la aprobación se mantiene: openAgentSafely ya avisa.
        await openAgentSafely(deps, next.agent, next.prompt);
      } else {
        void vscode.window.showInformationMessage('SDD Studio: tareas aprobadas. Usa ▶ Ejecutar tarea en tasks.md.');
      }
    });

  const openRequirements = (folder: string, spec: string, reqIds: string[]) =>
    guarded(async () => {
      const wsFolder = await deps.store.resolveFolder(spec, folder, true);
      const snap = await deps.store.snapshot(wsFolder, spec);
      const uri = deps.store.docUri(wsFolder, spec, snap.type === 'bugfix' ? 'bugfix' : 'requirements');
      const document = await vscode.workspace.openTextDocument(uri);
      const line = reqIds[0] ? (findRequirementLine(document.getText(), reqIds[0]) ?? 0) : 0;
      const position = new vscode.Position(line, 0);
      await vscode.window.showTextDocument(document, { selection: new vscode.Range(position, position) });
    });

  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.runTask', runTask),
    vscode.commands.registerCommand('sddStudio.markTaskDone', markTaskDone),
    vscode.commands.registerCommand('sddStudio.approveAndContinue', approveAndContinue),
    vscode.commands.registerCommand('sddStudio.openRequirements', openRequirements),
  );
}
