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

export function mcpPolicyState(env: McpPolicyEnv): McpPolicyState {
  if (env.access === 'none' || env.access === false) return { state: 'blocked', reason: 'chat.mcp.access = none' };
  if (env.strictPluginOnly) return { state: 'blocked', reason: 'política ChatStrictPluginOnlyCustomization' };
  if (env.access === 'registry') return { state: 'registryOnly', reason: 'chat.mcp.access = registry' };
  return { state: 'allowed' };
}
