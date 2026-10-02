export interface McpPolicyEnv {
  /** Valor de `chat.mcp.access` ('all' | 'registry' | 'none'; versiones antiguas: boolean). */
  access: unknown;
  /** Política ChatStrictPluginOnlyCustomization activa. */
  strictPluginOnly: boolean;
}

export type McpPolicyStateName = 'allowed' | 'registryOnly' | 'blocked';

export interface McpPolicyState {
  state: McpPolicyStateName;
  reason?: string;
}

/**
 * ¿El valor de `chat.customizations.strictPluginOnlyCustomization` bloquea `.vscode/mcp.json`?
 * Sí con `true` o con una lista que incluya `'mcp'`; una lista con otros tipos (p. ej. `['agents']`) no afecta a MCP.
 */
export function strictBlocksMcp(value: unknown): boolean {
  return value === true || (Array.isArray(value) && value.includes('mcp'));
}

export function mcpPolicyState(env: McpPolicyEnv): McpPolicyState {
  if (env.access === 'none' || env.access === false) return { state: 'blocked', reason: 'chat.mcp.access = none' };
  if (env.strictPluginOnly) return { state: 'blocked', reason: 'política ChatStrictPluginOnlyCustomization' };
  if (env.access === 'registry') return { state: 'registryOnly', reason: 'chat.mcp.access = registry' };
  return { state: 'allowed' };
}
