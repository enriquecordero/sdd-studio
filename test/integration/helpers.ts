import * as path from 'path';
import * as vscode from 'vscode';
import type { SddStudioApi } from '../../src/extension';

export const PRISTINE = path.resolve(__dirname, '../../../test/fixtures/pristine');

export function ws(): vscode.WorkspaceFolder {
  return vscode.workspace.workspaceFolders![0];
}

export function wsUri(rel: string): vscode.Uri {
  return vscode.Uri.joinPath(ws().uri, ...rel.split('/'));
}

export async function readWs(rel: string): Promise<string> {
  return new TextDecoder().decode(await vscode.workspace.fs.readFile(wsUri(rel)));
}

export async function writeWs(rel: string, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(wsUri(rel), new TextEncoder().encode(text));
}

export async function getApi(): Promise<SddStudioApi> {
  const ext = vscode.extensions.getExtension<SddStudioApi>('enriqueacordero.sdd-studio')!;
  return ext.activate();
}

/** Restaura specs/ y .github/ desde pristine y espera a que los documentos abiertos se sincronicen con el disco. */
export async function restoreFixture(): Promise<void> {
  for (const dir of ['specs', '.github']) {
    try {
      await vscode.workspace.fs.delete(wsUri(dir), { recursive: true });
    } catch {
      // no existía
    }
    await vscode.workspace.fs.copy(vscode.Uri.file(path.join(PRISTINE, dir)), wsUri(dir), { overwrite: true });
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    let stale = false;
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme !== 'file' || doc.isDirty) continue;
      try {
        const disk = new TextDecoder().decode(await vscode.workspace.fs.readFile(doc.uri));
        if (disk !== doc.getText()) stale = true;
      } catch {
        // borrado
      }
    }
    if (!stale) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}
