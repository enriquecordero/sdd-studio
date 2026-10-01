import * as vscode from 'vscode';
import { parseTasks } from '../specs/tasks';
import { SpecStore } from '../workspace/specStore';

export class TaskDiagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('sdd-studio');
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly store: SpecStore) {
    this.subscriptions = [
      vscode.workspace.onDidOpenTextDocument((d) => this.update(d)),
      vscode.workspace.onDidChangeTextDocument((e) => this.update(e.document)),
      vscode.workspace.onDidCloseTextDocument((d) => this.collection.delete(d.uri)),
    ];
    vscode.workspace.textDocuments.forEach((d) => this.update(d));
  }

  private update(document: vscode.TextDocument): void {
    const location = this.store.locate(document.uri);
    if (!location || location.kind !== 'tasks') return;
    const { warnings } = parseTasks(document.getText());
    this.collection.set(
      document.uri,
      warnings.map((w) => {
        const diagnostic = new vscode.Diagnostic(document.lineAt(w.line).range, w.message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'SDD Studio';
        return diagnostic;
      }),
    );
  }

  dispose(): void {
    this.subscriptions.forEach((s) => s.dispose());
    this.collection.dispose();
  }
}
