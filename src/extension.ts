import * as vscode from 'vscode';
import { createToolHandlers, registerTools, ToolHandlers } from './tools/registerTools';
import { SpecService } from './workspace/specService';
import { SpecStore } from './workspace/specStore';

export interface SddStudioApi {
  store: SpecStore;
  service: SpecService;
  tools: ToolHandlers;
}

export function activate(context: vscode.ExtensionContext): SddStudioApi {
  const store = new SpecStore();
  const service = new SpecService(store);
  const tools = createToolHandlers(service);
  context.subscriptions.push(store, registerTools(tools));
  return { store, service, tools };
}

export function deactivate(): void {}
