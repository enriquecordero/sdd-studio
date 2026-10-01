import * as vscode from 'vscode';
import { CopilotBridge } from '../copilot/bridge';
import { AgentName, Language, newSpecPrompt, steeringPrompt } from '../copilot/prompts';
import { toSpecName } from '../specs/names';
import { SpecType } from '../specs/phase';
import { SpecService } from '../workspace/specService';
import { SpecStore } from '../workspace/specStore';

export interface CommandDeps {
  store: SpecStore;
  service: SpecService;
  getBridge(): CopilotBridge;
}

interface NewSpecArgs {
  folder?: string;
  type?: SpecType;
  name?: string;
  description?: string;
}

export function language(): Language {
  return vscode.workspace.getConfiguration('sddStudio').get<Language>('language', 'es');
}

/** Abre el agente; si Copilot Chat falla, muestra un error comprensible y devuelve false. */
export async function openAgentSafely(deps: CommandDeps, agent: AgentName, prompt: string): Promise<boolean> {
  try {
    await deps.getBridge().openAgent(agent, prompt);
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(`SDD Studio: no se pudo abrir Copilot Chat (${message}).`);
    return false;
  }
}

async function pickFolder(store: SpecStore, requested?: string): Promise<vscode.WorkspaceFolder | undefined> {
  if (requested) return store.folderByName(requested);
  const folders = store.folders();
  if (folders.length <= 1) return folders[0];
  const active = vscode.window.activeTextEditor?.document.uri;
  const fromEditor = active ? vscode.workspace.getWorkspaceFolder(active) : undefined;
  return fromEditor ?? vscode.window.showWorkspaceFolderPick({ placeHolder: '¿En qué carpeta creo el spec?' });
}

async function newSpec(deps: CommandDeps, args: NewSpecArgs = {}): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para crear specs.');
    return;
  }
  const folder = await pickFolder(deps.store, args.folder);
  if (!folder) return;

  let type = args.type;
  if (!type) {
    const pick = await vscode.window.showQuickPick(
      [
        { label: '$(symbol-event) Feature', description: 'requisitos → diseño → tareas', value: 'feature' as const },
        { label: '$(bug) Bugfix', description: 'bug → causa raíz → tareas', value: 'bugfix' as const },
      ],
      { title: 'Nuevo spec' },
    );
    if (!pick) return;
    type = pick.value;
  }

  const raw =
    args.name ??
    (await vscode.window.showInputBox({
      title: 'Nombre del spec',
      prompt: 'Se convertirá a minúsculas con guiones (ej. export-csv)',
      validateInput: (v) => (toSpecName(v) ? undefined : 'Escribe un nombre con letras o números'),
    }));
  if (!raw) return;
  const name = toSpecName(raw);
  if (!name) return;
  if (await deps.store.specExists(folder, name)) {
    void vscode.window.showErrorMessage(`SDD Studio: ya existe el spec "${name}".`);
    return;
  }

  const description =
    args.description ??
    (await vscode.window.showInputBox({
      title: `Describe "${name}"`,
      prompt: type === 'bugfix' ? '¿Qué falla y cómo se reproduce?' : '¿Qué quieres construir y para quién?',
    }));
  if (description === undefined) return;

  const multiRoot = deps.store.folders().length > 1;
  await openAgentSafely(
    deps,
    'sdd-requirements',
    newSpecPrompt({ spec: name, folder: multiRoot ? folder.name : undefined, type, description, language: language() }),
  );
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
