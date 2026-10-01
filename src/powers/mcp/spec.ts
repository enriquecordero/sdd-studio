export type McpMode = 'readOnly' | 'operate';
export const MCP_MODES: readonly McpMode[] = ['readOnly', 'operate'];
export const MODE_LABELS: Record<McpMode, string> = { readOnly: 'Solo lectura', operate: 'Operar' };

export type Prerequisite = 'node' | 'uv' | 'docker' | 'az' | 'aws';
export const PREREQUISITES: Record<Prerequisite, { label: string; executable: string; url: string }> = {
  node: { label: 'Node.js', executable: 'node', url: 'https://nodejs.org/' },
  uv: { label: 'uv', executable: 'uv', url: 'https://docs.astral.sh/uv/getting-started/installation/' },
  docker: { label: 'Docker', executable: 'docker', url: 'https://docs.docker.com/get-started/get-docker/' },
  az: { label: 'Azure CLI', executable: 'az', url: 'https://learn.microsoft.com/cli/azure/install-azure-cli' },
  aws: { label: 'AWS CLI', executable: 'aws', url: 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' },
};

export interface McpInput {
  id: string;
  type: 'promptString';
  description: string;
  default?: string;
  password?: boolean;
}

export interface McpStdioServer {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
export interface McpHttpServer {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}
export type McpServer = McpStdioServer | McpHttpServer;

export interface McpSpec {
  prerequisites: Prerequisite[];
  inputs: McpInput[];
  servers: Record<string, McpServer>;
  approxTools: Record<string, number>;
  beta: boolean;
  /** Texto corto para la franja del póster, p. ej. "OAuth de VS Code (GitHub)" o "Ninguna". */
  credentials: string;
  /** Prompt de ejemplo, en español, para el README y la página del Power. */
  example: string;
  operate?: { servers: Record<string, McpServer>; warning: string };
}

export const SERVER_NAME_RE = /^sdd-[a-z0-9-]+$/;
export const INPUT_ID_RE = /^sdd_[a-z0-9_]+$/;
const PINNED_RE = /@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SECRET_RE = /ghp_|gho_|github_pat_|AKIA|xox|Bearer (?!\$\{input:)/;
const INPUT_REF_RE = /\$\{input:([^}]*)\}/g;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isStringMap = (v: unknown): v is Record<string, string> => isObj(v) && Object.values(v).every((x) => typeof x === 'string');

/** Servidores que se escriben en `.vscode/mcp.json` para un modo. Sin `operate`, siempre los de solo lectura. */
export function serversForMode(spec: McpSpec, mode: McpMode): Record<string, McpServer> {
  return mode === 'operate' && spec.operate ? spec.operate.servers : spec.servers;
}

/** `local` si ejecuta un proceso en la máquina del dev (stdio); `remote` si es un servicio HTTP. */
export function serverKind(server: McpServer): 'local' | 'remote' {
  return server.type === 'stdio' ? 'local' : 'remote';
}

/** Línea de comando legible de un servidor stdio, o la URL de uno http. */
export function serverCommandLine(server: McpServer): string {
  return server.type === 'stdio' ? [server.command, ...(server.args ?? [])].join(' ') : server.url;
}

function validateServer(name: string, s: unknown, where: string, errors: string[], usedInputs: Set<string>): void {
  const at = `${where}: servidor "${name}"`;
  if (!SERVER_NAME_RE.test(name)) errors.push(`${at}: el nombre debe cumplir ^sdd-[a-z0-9-]+$.`);
  if (!isObj(s)) {
    errors.push(`${at}: debe ser un objeto.`);
    return;
  }
  const values: string[] = [];
  if (s.type === 'stdio') {
    if (!isText(s.command)) errors.push(`${at}: "command" es obligatorio.`);
    if (s.args !== undefined && !(Array.isArray(s.args) && s.args.every((a) => typeof a === 'string'))) {
      errors.push(`${at}: "args" debe ser una lista de textos.`);
    }
    if (s.env !== undefined && !isStringMap(s.env)) errors.push(`${at}: "env" debe ser un objeto de textos.`);
    const args = Array.isArray(s.args) ? s.args.filter((a): a is string => typeof a === 'string') : [];
    const env = isStringMap(s.env) ? s.env : {};
    if (args.some((a) => a.includes('@latest'))) errors.push(`${at}: prohibido "@latest"; fija la versión.`);
    if (s.command === 'npx' || s.command === 'uvx') {
      const pkg = args.find((a) => !a.startsWith('-'));
      if (pkg === undefined || !PINNED_RE.test(pkg)) errors.push(`${at}: el paquete debe terminar en @<versión exacta> (ej. pkg@1.2.3).`);
    }
    values.push(...args, ...Object.values(env));
    if (typeof s.command === 'string') values.push(s.command);
  } else if (s.type === 'http') {
    if (typeof s.url !== 'string' || !s.url.startsWith('https://')) errors.push(`${at}: "url" debe empezar por https://.`);
    if (s.headers !== undefined && !isStringMap(s.headers)) errors.push(`${at}: "headers" debe ser un objeto de textos.`);
    if (typeof s.url === 'string') values.push(s.url);
    if (isStringMap(s.headers)) values.push(...Object.values(s.headers));
  } else {
    errors.push(`${at}: "type" debe ser stdio o http.`);
    return;
  }
  if (values.some((v) => SECRET_RE.test(v))) errors.push(`${at}: contiene lo que parece un secreto literal; usa \${input:sdd_…} u OAuth.`);
  for (const v of values) for (const m of v.matchAll(INPUT_REF_RE)) usedInputs.add(m[1]);
}

/** Valida `mcp.vscode.json` (reglas 1–7 del spec §4.1). Devuelve la lista de errores; vacía si es válido. */
export function validateMcpSpec(x: unknown, where: string): string[] {
  if (!isObj(x)) return [`${where}: mcp.vscode.json debe ser un objeto.`];
  const errors: string[] = [];
  const prereqs = x.prerequisites;
  if (!Array.isArray(prereqs) || !prereqs.every((p) => typeof p === 'string' && Object.hasOwn(PREREQUISITES, p))) {
    errors.push(`${where}: "prerequisites" debe ser una lista con valores de: ${Object.keys(PREREQUISITES).join(', ')}.`);
  }
  if (typeof x.beta !== 'boolean') errors.push(`${where}: "beta" debe ser true o false.`);
  if (!isText(x.credentials)) errors.push(`${where}: falta "credentials".`);
  if (!isText(x.example)) errors.push(`${where}: falta "example".`);

  const declared = new Set<string>();
  if (!Array.isArray(x.inputs)) {
    errors.push(`${where}: "inputs" debe ser una lista (puede estar vacía).`);
  } else {
    x.inputs.forEach((i, n) => {
      if (!isObj(i) || typeof i.id !== 'string' || !INPUT_ID_RE.test(i.id)) {
        errors.push(`${where}: el input ${n + 1} necesita un "id" que cumpla ^sdd_[a-z0-9_]+$.`);
        return;
      }
      if (i.type !== 'promptString') errors.push(`${where}: el input "${i.id}" debe ser de tipo promptString.`);
      if (!isText(i.description)) errors.push(`${where}: el input "${i.id}" necesita "description".`);
      if (declared.has(i.id)) errors.push(`${where}: input duplicado "${i.id}".`);
      declared.add(i.id);
    });
  }

  const used = new Set<string>();
  const servers = x.servers;
  if (!isObj(servers) || Object.keys(servers).length === 0) {
    errors.push(`${where}: "servers" necesita al menos un servidor.`);
  } else {
    for (const [name, s] of Object.entries(servers)) validateServer(name, s, where, errors, used);
    const tools = isObj(x.approxTools) ? x.approxTools : {};
    for (const name of Object.keys(servers)) {
      const n = tools[name];
      if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) errors.push(`${where}: "approxTools.${name}" debe ser un entero mayor que 0.`);
    }
  }

  if (x.operate !== undefined) {
    const op = x.operate;
    if (!isObj(op) || !isObj(op.servers)) {
      errors.push(`${where}: "operate.servers" debe ser un objeto.`);
    } else {
      const a = Object.keys(isObj(servers) ? servers : {}).sort().join(',');
      const b = Object.keys(op.servers).sort().join(',');
      if (a !== b) errors.push(`${where}: "operate.servers" debe tener exactamente los mismos servidores que "servers".`);
      for (const [name, s] of Object.entries(op.servers)) validateServer(name, s, `${where} (operate)`, errors, used);
      if (!isText(op.warning)) errors.push(`${where}: "operate.warning" no puede estar vacío.`);
    }
  }

  for (const id of used) if (!declared.has(id)) errors.push(`${where}: \${input:${id}} se usa pero no está declarado en "inputs".`);
  for (const id of declared) if (!used.has(id)) errors.push(`${where}: el input "${id}" está declarado pero no se usa.`);
  return errors;
}
