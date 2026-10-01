import * as vscode from 'vscode';
import { CopilotBridge, VsCodeCopilotBridge } from './copilot/bridge';
import { createToolHandlers, registerTools, ToolHandlers } from './tools/registerTools';
import { TaskDiagnostics } from './ui/diagnostics';
import { registerSpecCommands } from './ui/specCommands';
import { SpecsTreeProvider } from './ui/specsTree';
import { registerTaskCommands } from './ui/taskCommands';
import { SpecLensProvider } from './ui/taskLens';
import { SpecService } from './workspace/specService';
import { SpecStore } from './workspace/specStore';

export interface SddStudioApi {
  store: SpecStore;
  service: SpecService;
  tools: ToolHandlers;
  specsTree: SpecsTreeProvider;
  setCopilotBridge(bridge: CopilotBridge): void;
}

export function activate(context: vscode.ExtensionContext): SddStudioApi {
  const store = new SpecStore();
  const service = new SpecService(store);
  const tools = createToolHandlers(service);
  const specsTree = new SpecsTreeProvider(store);
  let bridge: CopilotBridge = new VsCodeCopilotBridge();
  const deps = { store, service, getBridge: () => bridge };

  context.subscriptions.push(
    store,
    specsTree,
    registerTools(tools),
    vscode.window.createTreeView('sddStudio.specs', { treeDataProvider: specsTree }),
    registerSpecCommands(deps),
  );

  const lensProvider = new SpecLensProvider(store);
  context.subscriptions.push(
    lensProvider,
    vscode.languages.registerCodeLensProvider({ language: 'markdown', scheme: 'file' }, lensProvider),
    registerTaskCommands(deps),
    new TaskDiagnostics(store),
  );

  return {
    store,
    service,
    tools,
    specsTree,
    setCopilotBridge: (b) => {
      bridge = b;
    },
  };
}

export function deactivate(): void {}
