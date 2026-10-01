import * as vscode from 'vscode';
import { CopilotBridge, OpenAgentOptions } from '../copilot/bridge';
import { AgentName, Language, steeringPrompt } from '../copilot/prompts';
import { SpecService } from '../workspace/specService';
import { SpecStore } from '../workspace/specStore';

export interface CommandDeps {
  store: SpecStore;
  service: SpecService;
  getBridge(): CopilotBridge;
}

interface NewSpecArgs {
  folder?: string;
  description?: string;
}

export function language(): Language {
  return vscode.workspace.getConfiguration('sddStudio').get<Language>('language', 'es');
}

/** Abre el agente; si Copilot Chat falla, muestra un error comprensible y devuelve false. */
export async function openAgentSafely(
  deps: CommandDeps,
  agent: AgentName,
  prompt: string,
  options?: OpenAgentOptions,
): Promise<boolean> {
  try {
    await deps.getBridge().openAgent(agent, prompt, options);
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(`SDD Studio: no se pudo abrir Copilot Chat (${message}).`);
    return false;
  }
}

/**
 * Como en Kiro: abre Copilot con el agente sdd-spec. Sin descripción, deja la caja del chat
 * lista para escribir; el agente pregunta el tipo de spec con una tarjeta y elige el nombre.
 */
async function newSpec(deps: CommandDeps, args: NewSpecArgs = {}): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para crear specs.');
    return;
  }
  const description = args.description?.trim();
  if (description) {
    await openAgentSafely(deps, 'sdd-spec', description);
    return;
  }
  const folderHint = args.folder && deps.store.folders().length > 1 ? `Carpeta: ${args.folder}. ` : '';
  await openAgentSafely(deps, 'sdd-spec', folderHint, { partial: true });
}

export function registerSpecCommands(deps: CommandDeps): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.newSpec', (args?: NewSpecArgs) => newSpec(deps, args)),
    vscode.commands.registerCommand('sddStudio.refresh', () => deps.store.refresh()),
    vscode.commands.registerCommand('sddStudio.generateSteering', () =>
      openAgentSafely(deps, 'sdd-steering', steeringPrompt(language())),
    ),
  );
}
