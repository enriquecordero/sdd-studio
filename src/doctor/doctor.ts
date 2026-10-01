import * as vscode from 'vscode';
import { CheckResult, DoctorEnv, runChecks } from './checks';

/** Fijado por el spike (docs/spike-findings.md, fila 7). */
const STRICT_SETTING = 'chat.customizations.strictPluginOnlyCustomization';
const RAN_FOR_KEY = 'sddStudio.doctorRanFor';

async function collectEnv(context: vscode.ExtensionContext): Promise<DoctorEnv> {
  const chat = vscode.workspace.getConfiguration('chat');
  let githubSignedIn = false;
  try {
    githubSignedIn = (await vscode.authentication.getSession('github', ['user:email'], { silent: true })) !== undefined;
  } catch {
    githubSignedIn = false;
  }
  const engines: string = context.extension.packageJSON.engines.vscode;
  const value = vscode.workspace.getConfiguration().get<unknown>(STRICT_SETTING, false);
  return {
    vscodeVersion: vscode.version,
    minVersion: engines.replace(/^[^\d]*/, ''),
    copilotChatInstalled: vscode.extensions.getExtension('GitHub.copilot-chat') !== undefined,
    githubSignedIn,
    agentModeEnabled: chat.get<boolean>('agent.enabled', true),
    extensionToolsEnabled: chat.get<boolean>('extensionTools.enabled', true),
    strictPluginOnly: value === true || (Array.isArray(value) && value.length > 0),
  };
}

function report(channel: vscode.OutputChannel, results: CheckResult[]): void {
  channel.clear();
  channel.appendLine(`SDD Studio — Diagnóstico (${new Date().toLocaleString()})`);
  for (const r of results) {
    channel.appendLine(`${r.ok ? '✓' : r.severity === 'error' ? '✗' : '!'} ${r.message}`);
    if (r.action) channel.appendLine(`    → ${r.action}`);
  }
  const problems = results.filter((r) => !r.ok);
  if (problems.length === 0) {
    void vscode.window.showInformationMessage('SDD Studio: todo listo ✓');
    return;
  }
  void vscode.window
    .showWarningMessage(`SDD Studio: ${problems.length} problema(s) de configuración.`, 'Ver detalles')
    .then((pick) => {
      if (pick) channel.show();
    });
}

export function registerDoctor(context: vscode.ExtensionContext): vscode.Disposable {
  const channel = vscode.window.createOutputChannel('SDD Studio');
  const command = vscode.commands.registerCommand('sddStudio.doctor', async () => {
    report(channel, runChecks(await collectEnv(context)));
  });
  return vscode.Disposable.from(channel, command);
}

export async function runDoctorOnce(context: vscode.ExtensionContext): Promise<void> {
  const version: string = context.extension.packageJSON.version;
  if (context.globalState.get(RAN_FOR_KEY) === version) return;
  await context.globalState.update(RAN_FOR_KEY, version);
  await vscode.commands.executeCommand('sddStudio.doctor');
}
