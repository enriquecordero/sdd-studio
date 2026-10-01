import * as vscode from 'vscode';
import { SpecStore } from '../workspace/specStore';
import { GalleryController } from './galleryPanel';
import { PowerError } from './installer';
import { activationDetail, overwriteQuestion } from './mcp/messages';
import { findOnPath } from './mcp/prereqs';
import { MCP_MODES, McpMode, McpSpec, MODE_LABELS, Prerequisite, PREREQUISITES } from './mcp/spec';
import { PowersService } from './powersService';
import { CatalogPower } from './types';

/** Comando de VS Code que lista los servidores MCP. Fijado por el spike (Tarea 0, comprobación 3). */
export const MCP_LIST_SERVERS_COMMAND = 'workbench.mcp.listServer';

export interface PowersDeps {
  powers: PowersService;
  store: SpecStore;
  gallery: GalleryController;
}

type PowerArg = string | { id?: unknown; folder?: string | vscode.WorkspaceFolder; mode?: unknown };

function normalize(arg: PowerArg | undefined): { id?: string; folderName?: string; mode?: McpMode } {
  if (typeof arg === 'string') return { id: arg };
  if (arg && typeof arg === 'object' && typeof arg.id === 'string') {
    return {
      id: arg.id,
      folderName: typeof arg.folder === 'string' ? arg.folder : arg.folder?.name,
      mode: MCP_MODES.includes(arg.mode as McpMode) ? (arg.mode as McpMode) : undefined,
    };
  }
  return {};
}

async function pickFolder(store: SpecStore, name?: string): Promise<vscode.WorkspaceFolder | undefined> {
  if (name) return store.folderByName(name);
  const folders = store.folders();
  if (folders.length <= 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: '¿En qué carpeta?' });
}

async function guarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof PowerError) {
      if (e.code === 'MCP_BLOCKED') {
        const pick = await vscode.window.showErrorMessage(`SDD Studio: ${e.message}`, 'Ver diagnóstico');
        if (pick) await vscode.commands.executeCommand('sddStudio.doctor');
        return;
      }
      void vscode.window.showErrorMessage(`SDD Studio: ${e.message}`);
      if (e.fileUri) await vscode.window.showTextDocument(e.fileUri);
      return;
    }
    throw e;
  }
}

function requireTrust(): boolean {
  if (vscode.workspace.isTrusted) return true;
  void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para activar o actualizar Powers.');
  return false;
}

async function confirmModal(question: string, button: string, detail?: string): Promise<boolean> {
  return (await vscode.window.showWarningMessage(question, { modal: true, detail }, button)) === button;
}

async function confirmMcpModal(
  question: string,
  button: string,
  spec: McpSpec,
  powers: PowersService,
  mode: McpMode = 'readOnly',
  action: 'add' | 'rewrite' = 'add',
): Promise<boolean> {
  const missing: Prerequisite[] = [];
  for (const req of spec.prerequisites) if (!(await findOnPath(PREREQUISITES[req].executable))) missing.push(req);
  return confirmModal(question, button, activationDetail(spec, missing, powers.policy(), mode, action));
}

async function checkUpdates(powers: PowersService): Promise<void> {
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'SDD Studio: buscando actualizaciones de Powers…' },
    () => powers.refreshOnline(),
  );
  switch (result.kind) {
    case 'updated':
      void vscode.window.showInformationMessage(`SDD Studio: catálogo actualizado, ${result.powers} Powers disponibles.`);
      break;
    case 'current':
      void vscode.window.showInformationMessage('SDD Studio: ya tienes el catálogo de Powers más reciente.');
      break;
    case 'invalid':
      void vscode.window.showWarningMessage('SDD Studio: el catálogo descargado no es válido; se sigue usando el actual.');
      break;
    case 'error':
      void vscode.window.showWarningMessage(`SDD Studio: no se pudo descargar el catálogo (${result.message}). Se sigue usando el catálogo incluido.`);
      break;
  }
}

export function registerPowerCommands(deps: PowersDeps): vscode.Disposable {
  const withPower =
    (fn: (id: string, folder: vscode.WorkspaceFolder, mode?: McpMode) => Promise<void>) =>
    (arg?: PowerArg) =>
      guarded(async () => {
        const { id, folderName, mode } = normalize(arg);
        if (!id) return;
        const folder = await pickFolder(deps.store, folderName);
        if (!folder) {
          void vscode.window.showWarningMessage('SDD Studio: abre una carpeta para usar Powers.');
          return;
        }
        await fn(id, folder, mode);
      });

  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.openPowers', () => deps.gallery.show()),
    vscode.commands.registerCommand('sddStudio.checkPowerUpdates', () => checkUpdates(deps.powers)),
    vscode.commands.registerCommand(
      'sddStudio.activatePower',
      withPower(async (id, folder) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        const result = await deps.powers.activate(id, folder, (spec) =>
          confirmMcpModal(`¿Activar "${p.presentation.displayName}" con servidores MCP?`, 'Activar', spec, deps.powers),
        );
        if (result === 'cancelled') return;
        if (!p.mcp) {
          void vscode.window.showInformationMessage(
            `SDD Studio: "${p.presentation.displayName}" activado en .github/skills/${p.skillName}/. Commitea la carpeta .github para compartirlo con tu equipo.`,
          );
          return;
        }
        const pick = await vscode.window.showInformationMessage(
          `SDD Studio: listo. "${p.presentation.displayName}" añadió ${Object.keys(p.mcp.servers).join(', ')} a .vscode/mcp.json. VS Code te pedirá confiar e iniciar el servidor. Commitea .github y .vscode/mcp.json para compartirlo.`,
          'Ver servidores MCP',
        );
        if (pick) await vscode.commands.executeCommand(MCP_LIST_SERVERS_COMMAND);
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.updatePower',
      withPower(async (id, folder) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        const mode = (await deps.powers.views(folder)).find((v) => v.power.id === id)?.mode ?? 'readOnly';
        const result = await deps.powers.update(
          id,
          folder,
          (reason) => confirmModal(overwriteQuestion(reason, p.presentation.displayName, p.skillName, 'update'), 'Sobrescribir'),
          (spec) =>
            confirmMcpModal(
              `¿Actualizar "${p.presentation.displayName}"? Cambian los comandos de sus servidores MCP`,
              'Actualizar',
              spec,
              deps.powers,
              mode,
              'rewrite',
            ),
        );
        if (result === 'updated') void vscode.window.showInformationMessage(`SDD Studio: "${p.presentation.displayName}" actualizado a v${p.version}.`);
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.setPowerMode',
      withPower(async (id, folder, requested) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        if (!p.mcp) return;
        let mode = requested;
        if (!mode) {
          const pick = await vscode.window.showQuickPick(
            MCP_MODES.filter((m) => m === 'readOnly' || p.mcp?.operate).map((m) => ({ label: MODE_LABELS[m], mode: m })),
            { placeHolder: `Modo de "${p.presentation.displayName}"` },
          );
          if (!pick) return;
          mode = pick.mode;
        }
        if (mode === 'operate' && p.mcp.operate && !(await confirmModal(`¿Cambiar "${p.presentation.displayName}" a Operar?`, 'Cambiar a Operar', p.mcp.operate.warning))) {
          return;
        }
        const result = await deps.powers.setMode(id, folder, mode, (reason) =>
          confirmModal(overwriteQuestion(reason, p.presentation.displayName, p.skillName, 'mode'), 'Sobrescribir'),
        );
        if (result === 'changed') {
          void vscode.window.showInformationMessage(
            `SDD Studio: "${p.presentation.displayName}" en modo ${MODE_LABELS[mode]}. Reinicia el servidor desde la lista de servidores MCP si ya estaba en marcha.`,
          );
        }
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.deactivatePower',
      withPower(async (id, folder) => {
        let p: CatalogPower | undefined;
        try {
          p = await deps.powers.find(id);
        } catch {
          p = undefined;
        }
        const name = p?.presentation.displayName ?? id;
        const result = await deps.powers.deactivate(id, folder, (reason) =>
          confirmModal(overwriteQuestion(reason, name, p?.skillName ?? id, 'deactivate'), 'Borrar y desactivar'),
        );
        if (result === 'deactivated') void vscode.window.showInformationMessage(`SDD Studio: Power "${name}" desactivado.`);
      }),
    ),
  );
}
