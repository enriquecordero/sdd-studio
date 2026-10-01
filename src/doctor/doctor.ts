import * as vscode from 'vscode';
import { CheckResult, DoctorEnv, runChecks } from './checks';

/** Fijado por el spike (docs/spike-findings.md, fila 7). */
const STRICT_SETTING = 'chat.customizations.strictPluginOnlyCustomization';
const RAN_FOR_KEY = 'sddStudio.doctorRanFor';

/**
 * getSession({ silent: true }) devuelve undefined hasta que el usuario concede acceso a esta extensión,
 * así que daba un falso "sin sesión". Usamos getAccounts (sin consentimiento) si existe en esta versión;
 * si no existe o falla, el resultado es desconocido y no se avisa.
 */
async function githubSessionState(): Promise<boolean | 'unknown'> {
  const auth: Partial<typeof vscode.authentication> = vscode.authentication;
  if (typeof auth.getAccounts !== 'function') return 'unknown';
  try {
    return (await auth.getAccounts('github')).length > 0;
  } catch {
    return 'unknown';
  }
}

async function collectEnv(context: vscode.ExtensionContext): Promise<DoctorEnv> {
  const chat = vscode.workspace.getConfiguration('chat');
  const githubSignedIn = await githubSessionState();
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
