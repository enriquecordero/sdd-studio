import * as vscode from 'vscode';

export function isFileNotFound(e: unknown): boolean {
  return e instanceof vscode.FileSystemError && e.code === 'FileNotFound';
}

/**
 * Aplica fn al texto actual del archivo.
 * - Si existe: edita su documento con WorkspaceEdit (respeta deshacer, spec §6). Si no estaba abierto se abre
 *   (sin mostrarlo). Solo guarda si no tenía cambios sin guardar.
 * - Si no existe: lo crea en disco (crea carpetas si hace falta; no hay nada que deshacer).
 */
export async function transformFile(uri: vscode.Uri, fn: (current: string | undefined) => string): Promise<void> {
  let doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (!doc) {
    try {
      await vscode.workspace.fs.stat(uri);
    } catch (e) {
      if (!isFileNotFound(e)) throw e;
      const next = fn(undefined);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
      return;
    }
    doc = await vscode.workspace.openTextDocument(uri);
  }

  const wasDirty = doc.isDirty;
  const current = doc.getText();
  const next = fn(current);
  if (next === current) return;
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(current.length)), next);
  if (!(await vscode.workspace.applyEdit(edit))) throw new Error(`No se pudo editar ${uri.fsPath}`);
  if (!wasDirty) await doc.save();
}
