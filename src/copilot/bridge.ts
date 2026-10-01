import * as vscode from 'vscode';
import type { AgentName } from './prompts';

export interface CopilotBridge {
  openAgent(agent: AgentName, prompt: string): Promise<void>;
}

/** Fijado por el spike (docs/spike-findings.md, fila 1). */
const SUPPORTS_AGENT_ARG = true;

export class VsCodeCopilotBridge implements CopilotBridge {
  async openAgent(agent: AgentName, prompt: string): Promise<void> {
    if (SUPPORTS_AGENT_ARG) {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt, mode: agent });
      return;
    }
    await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt, isPartialQuery: true });
    void vscode.window.showInformationMessage(`Selecciona el agente "${agent}" en Copilot Chat y envía el mensaje.`);
  }
}
