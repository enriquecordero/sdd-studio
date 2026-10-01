import * as vscode from 'vscode';
import { SpecStore } from './workspace/specStore';

export interface SddStudioApi {
  store: SpecStore;
}

export function activate(context: vscode.ExtensionContext): SddStudioApi {
  const store = new SpecStore();
  context.subscriptions.push(store);
  return { store };
}

export function deactivate(): void {}
