import * as vscode from 'vscode';
import { SpecStore } from '../workspace/specStore';
import { computeLenses } from './lensModel';

export class SpecLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly store: SpecStore) {
    this.subscription = store.onDidChange(() => this.emitter.fire());
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const location = this.store.locate(document.uri);
    if (!location) return [];
    const snap = await this.store.snapshot(location.folder, location.name);
    return computeLenses({
      folder: location.folder.name,
      spec: location.name,
      kind: location.kind,
      text: document.getText(),
      type: snap.type,
      states: snap.states,
    }).map(
      (lens) =>
        new vscode.CodeLens(new vscode.Range(lens.line, 0, lens.line, 0), {
          title: lens.title,
          command: lens.command ?? '',
          arguments: lens.args,
        }),
    );
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }
}
