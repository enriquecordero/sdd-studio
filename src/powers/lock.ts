import { compareSemver, isSafeRelativePath, isSemver, isValidId } from './catalog';
import { INPUT_ID_RE, MCP_MODES, McpMode, SERVER_NAME_RE } from './mcp/spec';

export interface LockMcp {
  mode: McpMode;
  /** Nombre del servidor → `entryHash` de la entrada que escribimos en `.vscode/mcp.json`. */
  servers: Record<string, string>;
  inputs: string[];
  /** true si fue SDD Studio quien creó `.vscode/mcp.json`. */
  createdFile: boolean;
}

export interface LockEntry {
  version: string;
  skillName: string;
  sha256: string;
  files: string[];
  installedAt: string;
  mcp?: LockMcp;
}

export interface Lockfile {
  /** 2 solo si algún Power tiene `mcp`; si no, 1, para que v0.4.0 lo siga leyendo. */
  schemaVersion: 1 | 2;
  powers: Record<string, LockEntry>;
}

export type PowerStatus = 'available' | 'active' | 'update';

const HASH_RE = /^[a-f0-9]{64}$/;

function lockOf(powers: Record<string, LockEntry>): Lockfile {
  return { schemaVersion: Object.values(powers).some((e) => e.mcp) ? 2 : 1, powers };
}

export function emptyLock(): Lockfile {
  return lockOf({});
}

function parseMcp(raw: unknown): LockMcp | undefined {
  const m = raw as Partial<LockMcp> | null;
  if (typeof m !== 'object' || m === null) return undefined;
  const servers = m.servers as Record<string, unknown> | undefined;
  const valid =
    MCP_MODES.includes(m.mode as McpMode) &&
    typeof servers === 'object' &&
    servers !== null &&
    Object.entries(servers).every(([name, hash]) => SERVER_NAME_RE.test(name) && typeof hash === 'string' && HASH_RE.test(hash)) &&
    Array.isArray(m.inputs) &&
    m.inputs.every((i) => typeof i === 'string' && INPUT_ID_RE.test(i)) &&
    typeof m.createdFile === 'boolean';
  if (!valid) return undefined;
  return { mode: m.mode as McpMode, servers: { ...(servers as Record<string, string>) }, inputs: [...(m.inputs as string[])], createdFile: m.createdFile as boolean };
}

export function parseLock(text: string | undefined): Lockfile {
  if (text === undefined || text.trim() === '') return emptyLock();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('powers.lock.json no es JSON válido.');
  }
  const obj = json as { schemaVersion?: unknown; powers?: unknown };
  if (
    typeof json !== 'object' ||
    json === null ||
    (obj.schemaVersion !== 1 && obj.schemaVersion !== 2) ||
    typeof obj.powers !== 'object' ||
    obj.powers === null
  ) {
    throw new Error('powers.lock.json no tiene el formato esperado (schemaVersion 1 o 2).');
  }
  const powers: Record<string, LockEntry> = {};
  for (const [id, raw] of Object.entries(obj.powers as Record<string, unknown>)) {
    const e = (raw ?? {}) as Partial<LockEntry>;
    const files = e.files;
    const mcp = e.mcp === undefined ? undefined : parseMcp(e.mcp);
    const valid =
      isValidId(id) &&
      isSemver(e.version) &&
      isValidId(e.skillName) &&
      typeof e.sha256 === 'string' &&
      Array.isArray(files) &&
      files.every((f) => typeof f === 'string' && isSafeRelativePath(f)) &&
      typeof e.installedAt === 'string' &&
      (e.mcp === undefined || mcp !== undefined) &&
      (mcp === undefined || obj.schemaVersion === 2);
    if (!valid) throw new Error(`powers.lock.json: la entrada "${id}" no es válida.`);
    powers[id] = {
      version: e.version as string,
      skillName: e.skillName as string,
      sha256: e.sha256 as string,
      files: [...(files as string[])],
      installedAt: e.installedAt as string,
      ...(mcp ? { mcp } : {}),
    };
  }
  return lockOf(powers);
}

export function serializeLock(lock: Lockfile): string {
  const powers: Record<string, LockEntry> = {};
  for (const id of Object.keys(lock.powers).sort()) powers[id] = lock.powers[id];
  return `${JSON.stringify(lockOf(powers), null, 2)}\n`;
}

export function withEntry(lock: Lockfile, id: string, entry: LockEntry): Lockfile {
  return lockOf({ ...lock.powers, [id]: entry });
}

export function withoutEntry(lock: Lockfile, id: string): Lockfile {
  const powers = { ...lock.powers };
  delete powers[id];
  return lockOf(powers);
}

/** Ids de inputs que usan los Powers activos, salvo `exceptId`. */
export function inputsInUse(lock: Lockfile, exceptId: string): Set<string> {
  return new Set(
    Object.entries(lock.powers)
      .filter(([id]) => id !== exceptId)
      .flatMap(([, e]) => e.mcp?.inputs ?? []),
  );
}

/** true si algún Power activo, salvo `exceptId`, registra que SDD Studio creó `.vscode/mcp.json`. */
export function mcpFileCreatedByUs(lock: Lockfile, exceptId: string): boolean {
  return Object.entries(lock.powers).some(([id, e]) => id !== exceptId && e.mcp?.createdFile === true);
}

export function powerStatus(power: { version: string }, entry: LockEntry | undefined): PowerStatus {
  if (!entry) return 'available';
  return compareSemver(power.version, entry.version) > 0 ? 'update' : 'active';
}
