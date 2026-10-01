import * as vscode from 'vscode';

export function isFileNotFound(e: unknown): boolean {
  return e instanceof vscode.FileSystemError && e.code === 'FileNotFound';
}

/**
 * Aplica fn al texto actual del archivo.
 * - Si está abierto en VS Code: edita el buffer (respeta deshacer). Solo guarda si no tenía cambios sin guardar.
 * - Si no: lee y escribe en disco (crea carpetas si hace falta).
 */
export async function transformFile(uri: vscode.Uri, fn: (current: string | undefined) => string): Promise<void> {
  const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (open) {
    const wasDirty = open.isDirty;
    const current = open.getText();
    const next = fn(current);
    if (next === current) return;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(open.positionAt(0), open.positionAt(current.length)), next);
    if (!(await vscode.workspace.applyEdit(edit))) throw new Error(`No se pudo editar ${uri.fsPath}`);
    if (!wasDirty) await open.save();
    return;
  }

  let current: string | undefined;
  try {
    current = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch (e) {
    if (!isFileNotFound(e)) throw e;
    current = undefined;
  }
  const next = fn(current);
  if (next === current) return;
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
}
