import type { OverwriteReason } from '../installer';
import type { McpPolicyState } from './policy';
import { Prerequisite, PREREQUISITES, McpSpec, serverCommandLine, serverKind, McpMode, MODE_LABELS, serversForMode } from './spec';

/** Texto del modal de activación (spec §6.3, paso 4): servidores, código local, prerrequisitos que faltan y beta. */
export function activationDetail(
  spec: McpSpec,
  missing: Prerequisite[],
  policy: McpPolicyState,
  mode: McpMode = 'readOnly',
  action: 'add' | 'rewrite' = 'add',
): string {
  const lines = [
    action === 'add'
      ? `Se añadirán a .vscode/mcp.json (modo ${MODE_LABELS[mode]}):`
      : `Se reescribirán en .vscode/mcp.json (modo ${MODE_LABELS[mode]}):`,
  ];
  for (const [name, server] of Object.entries(serversForMode(spec, mode))) {
    lines.push(
      serverKind(server) === 'local'
        ? `• ${name}: LOCAL, ejecuta código en tu máquina: ${serverCommandLine(server)}`
        : `• ${name}: remoto, ${serverCommandLine(server)}`,
    );
  }
  lines.push(`Credenciales: ${spec.credentials}.`);
  if (missing.length > 0) {
    lines.push('', 'Falta en tu PATH (instálalo antes de iniciar el servidor):');
    for (const p of missing) lines.push(`• ${PREREQUISITES[p].label}: ${PREREQUISITES[p].url}`);
  }
  if (spec.beta) lines.push('', 'Atención: el servidor está en versión beta.');
  if (policy.state === 'registryOnly') lines.push('', 'Tu organización solo permite servidores de su registro: puede que VS Code no deje iniciarlo.');
  lines.push('', 'VS Code te pedirá confiar en el servidor antes de iniciarlo. Nunca se guardan secretos en el repo.');
  return lines.join('\n');
}

/** Aviso tras activar un Power con MCP. Si `.gitignore` ignora `.vscode/mcp.json`, avisa en lugar de pedir el commit. */
export function activatedMcpMessage(displayName: string, servers: string[], mcpJsonIgnored: boolean): string {
  const share = mcpJsonIgnored
    ? '⚠️ .vscode/mcp.json está ignorado por git: añade `!.vscode/mcp.json` a .gitignore o tu equipo no recibirá los servidores.'
    : 'Commitea .github y .vscode/mcp.json para compartirlo.';
  return `SDD Studio: listo. "${displayName}" añadió ${servers.join(', ')} a .vscode/mcp.json. VS Code te pedirá confiar e iniciar el servidor. ${share}`;
}

/** Pregunta antes de sobrescribir o borrar algo editado a mano. */
export function overwriteQuestion(reason: OverwriteReason, displayName: string, skillName: string, action: 'update' | 'mode' | 'deactivate'): string {
  const where = reason === 'MCP_EDITED' ? 'sus servidores en .vscode/mcp.json' : `.github/skills/${skillName}/`;
  const verb = action === 'deactivate' ? '¿Desactivarlo y descartar esos cambios?' : '¿Sobrescribir esos cambios?';
  return `"${displayName}" tiene cambios hechos a mano en ${where}. ${verb}`;
}
