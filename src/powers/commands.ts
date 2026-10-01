import * as vscode from 'vscode';
import { SpecStore } from '../workspace/specStore';
import { GalleryController } from './galleryPanel';
import { PowerError } from './installer';
import { PowersService } from './powersService';

export interface PowersDeps {
  powers: PowersService;
  store: SpecStore;
  gallery: GalleryController;
}

type PowerArg = string | { id?: unknown; folder?: string | vscode.WorkspaceFolder };

function normalize(arg: PowerArg | undefined): { id?: string; folderName?: string } {
  if (typeof arg === 'string') return { id: arg };
  if (arg && typeof arg === 'object' && typeof arg.id === 'string') {
    return { id: arg.id, folderName: typeof arg.folder === 'string' ? arg.folder : arg.folder?.name };
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
      void vscode.window.showErrorMessage(`SDD Studio: ${e.message}`);
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
    (fn: (id: string, folder: vscode.WorkspaceFolder) => Promise<void>) =>
    (arg?: PowerArg) =>
      guarded(async () => {
        const { id, folderName } = normalize(arg);
        if (!id) return;
        const folder = await pickFolder(deps.store, folderName);
        if (!folder) {
          void vscode.window.showWarningMessage('SDD Studio: abre una carpeta para usar Powers.');
          return;
        }
        await fn(id, folder);
      });

  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.openPowers', () => deps.gallery.show()),
    vscode.commands.registerCommand('sddStudio.checkPowerUpdates', () => checkUpdates(deps.powers)),
    vscode.commands.registerCommand(
      'sddStudio.activatePower',
      withPower(async (id, folder) => {
        if (!requireTrust()) return;
        await deps.powers.activate(id, folder);
        const p = await deps.powers.find(id);
        void vscode.window.showInformationMessage(
          `SDD Studio: "${p.presentation.displayName}" activado en .github/skills/${p.skillName}/. Commitea la carpeta .github para compartirlo con tu equipo.`,
        );
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.updatePower',
      withPower(async (id, folder) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        const result = await deps.powers.update(id, folder, async () => {
          const pick = await vscode.window.showWarningMessage(
            `"${p.presentation.displayName}" tiene cambios locales en .github/skills/${p.skillName}/. ¿Sobrescribirlos con la versión ${p.version}?`,
            { modal: true },
            'Sobrescribir',
          );
          return pick === 'Sobrescribir';
        });
        if (result === 'updated') void vscode.window.showInformationMessage(`SDD Studio: "${p.presentation.displayName}" actualizado a v${p.version}.`);
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.deactivatePower',
      withPower(async (id, folder) => {
        let p: Awaited<ReturnType<typeof deps.powers.find>> | undefined;
        try {
          p = await deps.powers.find(id);
        } catch {
          p = undefined;
        }
        const name = p?.presentation.displayName ?? id;
        const result = await deps.powers.deactivate(id, folder, async () => {
          const pick = await vscode.window.showWarningMessage(
            `"${name}" tiene cambios locales en .github/skills/${p?.skillName ?? id}/. ¿Desactivarlo y borrar esos cambios?`,
            { modal: true },
            'Borrar y desactivar',
          );
          return pick === 'Borrar y desactivar';
        });
        if (result === 'deactivated') void vscode.window.showInformationMessage(`SDD Studio: Power "${name}" desactivado.`);
      }),
    ),
  );
}
