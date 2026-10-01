import { mcpPolicyState } from '../powers/mcp/policy';
import { McpMode, Prerequisite, PREREQUISITES } from '../powers/mcp/spec';

export interface ActiveMcpServer {
  name: string;
  /** true si la entrada sigue en `.vscode/mcp.json`. */
  inFile: boolean;
  approxTools: number;
}

export interface ActiveMcpPower {
  id: string;
  displayName: string;
  mode: McpMode;
  prerequisites: Prerequisite[];
  servers: ActiveMcpServer[];
}

export interface DoctorEnv {
  vscodeVersion: string;
  minVersion: string;
  copilotChatInstalled: boolean;
  /** 'unknown' cuando VS Code no permite comprobarlo sin pedir permiso al usuario. */
  githubSignedIn: boolean | 'unknown';
  agentModeEnabled: boolean;
  extensionToolsEnabled: boolean;
  strictPluginOnly: boolean;
  /** Valor de `chat.mcp.access`. */
  mcpAccess: unknown;
  workspaceTrusted: boolean;
  /** 'unknown' solo si no hay servicio de Powers o carpeta; `false` si no hay `.gitignore`. */
  mcpJsonIgnored: boolean | 'unknown';
  /** Ejecutables requeridos por los Powers MCP activos → ¿está en el PATH? */
  prereqs: Partial<Record<Prerequisite, boolean>>;
  activeMcp: ActiveMcpPower[];
  /** Nombre de la carpeta de workspace inspeccionada (para que Reparar actúe sobre ella en multi-root). */
  mcpFolder?: string;
}

export const GITHUB_MCP_POLICY_URL =
  'https://docs.github.com/en/copilot/concepts/mcp-management';
export const MAX_TOOLS_WARNING = 100;

export interface CheckResult {
  id: string;
  ok: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  action?: string;
  /** Arreglo automático que el diagnóstico ofrece como botón. */
  fix?: { label: string; command: string; args: unknown[] };
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

export function mcpChecks(env: DoctorEnv): CheckResult[] {
  const policy = mcpPolicyState({ access: env.mcpAccess, strictPluginOnly: false });
  const results: CheckResult[] = [
    {
      id: 'mcp-policy',
      ok: policy.state === 'allowed',
      severity: policy.state === 'blocked' ? 'error' : 'warning',
      message:
        policy.state === 'blocked'
          ? 'Los servidores MCP están desactivados (chat.mcp.access = none): los Powers con MCP quedan bloqueados.'
          : policy.state === 'registryOnly'
            ? 'Solo se permiten los servidores MCP del registro de tu organización (chat.mcp.access = registry).'
            : 'Servidores MCP permitidos',
      action:
        policy.state === 'blocked'
          ? 'Pide a tu admin que habilite MCP (política ChatMCP / chat.mcp.access).'
          : policy.state === 'registryOnly'
            ? 'Pide a tu admin que añada los servidores sdd-* al registro, o usa los Powers sin MCP.'
            : undefined,
    },
    {
      id: 'mcp-strict',
      ok: !env.strictPluginOnly,
      severity: 'error',
      message: env.strictPluginOnly
        ? 'La política ChatStrictPluginOnlyCustomization bloquea .vscode/mcp.json: los Powers con MCP no se pueden activar.'
        : 'La política estricta no bloquea .vscode/mcp.json',
      action: env.strictPluginOnly ? 'Pide a TI permitir customizaciones de workspace para usar Powers con MCP.' : undefined,
    },
  ];
  if (env.activeMcp.length === 0) return results;

  results.push({
    id: 'mcp-github-policy',
    ok: true,
    severity: 'info',
    message: `Si los servidores MCP aparecen deshabilitados, pide a tu admin que active "MCP servers in Copilot" en GitHub (${GITHUB_MCP_POLICY_URL}).`,
  });
  const needed = [...new Set(env.activeMcp.flatMap((p) => p.prerequisites))].sort();
  for (const cmd of needed) {
    if (env.prereqs[cmd] !== false) continue;
    const info = PREREQUISITES[cmd];
    const users = env.activeMcp.filter((p) => p.prerequisites.includes(cmd)).map((p) => p.displayName);
    results.push({
      id: `mcp-prereq-${cmd}`,
      ok: false,
      severity: 'error',
      message: `Falta ${info.label} (\`${info.executable}\` no está en el PATH); lo necesita: ${users.join(', ')}.`,
      action: `Instálalo: ${info.url}`,
    });
  }
  results.push({
    id: 'mcp-trust',
    ok: env.workspaceTrusted,
    severity: 'warning',
    message: env.workspaceTrusted ? 'Workspace de confianza' : 'Los servidores MCP no arrancan en un workspace sin confianza.',
    action: env.workspaceTrusted ? undefined : 'Confía en este workspace (Gestionar → Confianza del workspace).',
  });
  results.push({
    id: 'mcp-gitignored',
    ok: env.mcpJsonIgnored !== true,
    severity: 'warning',
    message: env.mcpJsonIgnored === true ? '.vscode/mcp.json está ignorado por git: tu equipo no recibirá los servidores.' : '.vscode/mcp.json se versiona con el repo',
    action: env.mcpJsonIgnored === true ? 'Añade "!.vscode/mcp.json" a .gitignore (o quita la regla que lo ignora).' : undefined,
  });
  for (const p of env.activeMcp) {
    const missing = p.servers.filter((s) => !s.inFile).map((s) => s.name);
    if (missing.length === 0) continue;
    results.push({
      id: 'mcp-drift',
      ok: false,
      severity: 'warning',
      message: `Falta en .vscode/mcp.json: ${missing.join(', ')} (Power "${p.displayName}").`,
      action: 'Pulsa "Reparar" para reescribir la entrada desde el catálogo.',
      fix: { label: 'Reparar', command: 'sddStudio.setPowerMode', args: [{ id: p.id, mode: p.mode, folder: env.mcpFolder }] },
    });
  }
  const tools = env.activeMcp.flatMap((p) => p.servers).reduce((sum, s) => sum + s.approxTools, 0);
  results.push({
    id: 'mcp-tools',
    ok: tools <= MAX_TOOLS_WARNING,
    severity: 'warning',
    message:
      tools <= MAX_TOOLS_WARNING
        ? `Herramientas MCP activas: ~${tools}`
        : `Los Powers MCP activos suman ~${tools} herramientas; Copilot admite como máximo 128 por petición.`,
    action: tools <= MAX_TOOLS_WARNING ? undefined : 'Desactiva algún Power o deselecciona herramientas en el selector de herramientas del chat.',
  });
  return results;
}

export function runChecks(env: DoctorEnv): CheckResult[] {
  const versionOk = compareVersions(env.vscodeVersion, env.minVersion) >= 0;
  const sessionMissing = env.githubSignedIn === false;
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
      ok: !sessionMissing,
      severity: 'warning',
      message:
        env.githubSignedIn === 'unknown'
          ? 'Sesión de GitHub no verificada (VS Code no lo permite sin permiso)'
          : env.githubSignedIn
            ? 'Sesión de GitHub activa'
            : 'No detecté una sesión de GitHub.',
      action: sessionMissing ? 'Inicia sesión en Copilot desde el icono de cuentas (abajo a la izquierda).' : undefined,
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
        ? 'La política ChatStrictPluginOnlyCustomization está activa: puede impedir que se carguen las instructions de steering de .github/instructions (y, más adelante, los Powers del repo).'
        : 'Customizaciones de workspace permitidas',
      action: env.strictPluginOnly ? 'Pide a TI permitir customizaciones de workspace para SDD Studio.' : undefined,
    },
    ...mcpChecks(env),
  ];
}
