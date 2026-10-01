export interface DoctorEnv {
  vscodeVersion: string;
  minVersion: string;
  copilotChatInstalled: boolean;
  githubSignedIn: boolean;
  agentModeEnabled: boolean;
  extensionToolsEnabled: boolean;
  strictPluginOnly: boolean;
}

export interface CheckResult {
  id: string;
  ok: boolean;
  severity: 'error' | 'warning';
  message: string;
  action?: string;
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^[^\d]*/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function runChecks(env: DoctorEnv): CheckResult[] {
  const versionOk = compareVersions(env.vscodeVersion, env.minVersion) >= 0;
  return [
    {
      id: 'vscode-version',
      ok: versionOk,
      severity: 'error',
      message: versionOk ? `VS Code ${env.vscodeVersion}` : `VS Code ${env.vscodeVersion} es menor que la mínima (${env.minVersion}).`,
      action: versionOk ? undefined : 'Actualiza VS Code (Ayuda → Buscar actualizaciones).',
    },
    {
      id: 'copilot-chat',
      ok: env.copilotChatInstalled,
      severity: 'error',
      message: env.copilotChatInstalled ? 'GitHub Copilot Chat instalado' : 'GitHub Copilot Chat no está instalado.',
      action: env.copilotChatInstalled ? undefined : 'Instala la extensión "GitHub Copilot Chat".',
    },
    {
      id: 'github-session',
      ok: env.githubSignedIn,
      severity: 'warning',
      message: env.githubSignedIn ? 'Sesión de GitHub activa' : 'No detecté una sesión de GitHub.',
      action: env.githubSignedIn ? undefined : 'Inicia sesión en Copilot desde el icono de cuentas (abajo a la izquierda).',
    },
    {
      id: 'agent-mode',
      ok: env.agentModeEnabled,
      severity: 'error',
      message: env.agentModeEnabled ? 'Agent mode habilitado' : 'Agent mode está desactivado.',
      action: env.agentModeEnabled ? undefined : 'Activa "chat.agent.enabled" o pide a TI habilitar la política ChatAgentMode.',
    },
    {
      id: 'extension-tools',
      ok: env.extensionToolsEnabled,
      severity: 'error',
      message: env.extensionToolsEnabled ? 'Herramientas de extensiones permitidas' : 'Las herramientas de extensiones están bloqueadas.',
      action: env.extensionToolsEnabled
        ? undefined
        : 'Activa "chat.extensionTools.enabled" o pide a TI habilitar la política ChatAgentExtensionTools.',
    },
    {
      id: 'strict-policy',
      ok: !env.strictPluginOnly,
      severity: 'warning',
      message: env.strictPluginOnly
        ? 'La política ChatStrictPluginOnlyCustomization está activa: no se cargarán las instructions de steering de .github/instructions (ni, más adelante, los Powers del repo).'
        : 'Customizaciones de workspace permitidas',
      action: env.strictPluginOnly ? 'Pide a TI permitir customizaciones de workspace para SDD Studio.' : undefined,
    },
  ];
}
