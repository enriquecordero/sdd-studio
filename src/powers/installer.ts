import * as vscode from 'vscode';
import { readMcpPolicyEnv } from '../doctor/doctor';
import { isSafeRelativePath, isValidId } from './catalog';
import { powerHash } from './hash';
import { inputsInUse, LockEntry, Lockfile, LockMcp, mcpFileCreatedByUs, parseLock, serializeLock, withEntry, withoutEntry } from './lock';
import { addEntries, entryHash, isEmptyMcpFile, McpJsonError, readEntries, removeEntries } from './mcp/mcpJson';
import { McpPolicyEnv, McpPolicyState, mcpPolicyState } from './mcp/policy';
import { McpMode, McpSpec, serversForMode } from './mcp/spec';
import { CatalogPower } from './types';

export type PowerErrorCode =
  | 'FOREIGN_SKILL'
  | 'NOT_INSTALLED'
  | 'UNSAFE_PATH'
  | 'NOT_FOUND'
  | 'LOCK_INVALID'
  | 'MCP_BLOCKED'
  | 'MCP_FILE_INVALID'
  | 'MCP_NAME_CONFLICT'
  | 'MCP_NO_OPERATE'
  | 'UPDATE_REQUIRED';

export class PowerError extends Error {
  constructor(
    readonly code: PowerErrorCode,
    message: string,
    /** Archivo que conviene abrir para arreglar el problema (MCP_FILE_INVALID). */
    readonly fileUri?: vscode.Uri,
  ) {
    super(message);
    this.name = 'PowerError';
  }
}

/** Por qué se pide confirmar antes de sobrescribir o borrar: el skill o una entrada de `.vscode/mcp.json` cambiaron a mano. */
export type OverwriteReason = 'SKILL_EDITED' | 'MCP_EDITED';
export type ConfirmOverwrite = (reason: OverwriteReason) => Promise<boolean>;
/** Confirmación modal antes de añadir servidores MCP (spec §6.3, paso 4). */
export type ConfirmMcp = (mcp: McpSpec) => Promise<boolean>;

interface McpPlan {
  before: string | undefined;
  /** undefined = borrar `.vscode/mcp.json`. */
  after: string | undefined;
  lock: LockMcp | undefined;
  /**
   * Hay algo que el dev no confirmó (spec §10): un servidor del destino que no estaba instalado (también si el Power
   * gana MCP) o uno cuya línea de comando (stdio) o URL (http) cambia respecto a la instalada.
   */
  commandChanged: boolean;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function isNotFound(e: unknown): boolean {
  return e instanceof vscode.FileSystemError && e.code === 'FileNotFound';
}

async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return decoder.decode(await vscode.workspace.fs.readFile(uri));
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}

const under = (base: vscode.Uri, rel: string) => vscode.Uri.joinPath(base, ...rel.split('/'));

/**
 * Lo que ejecuta o a dónde conecta una entrada, comparable sin ambigüedad: command + args si es stdio,
 * la URL si es http (como serverCommandLine, pero sin confundir argumentos con espacios). undefined si no es ninguna.
 */
function commandLine(server: unknown): string | undefined {
  const s = server as { type?: unknown; command?: unknown; args?: unknown; url?: unknown } | null;
  if (typeof s !== 'object' || s === null) return undefined;
  if (s.type === 'stdio') return JSON.stringify(['stdio', s.command, ...(Array.isArray(s.args) ? s.args : [])]);
  if (s.type === 'http') return JSON.stringify(['http', s.url]);
  return undefined;
}

/**
 * Ejecuta una edición de `.vscode/mcp.json` y convierte un McpJsonError (archivo válido pero que no sabemos
 * editar sin riesgo) en MCP_FILE_INVALID con el archivo a abrir. Cualquier otro error pasa tal cual.
 */
export function mcpEditOrFileInvalid<T>(editFn: () => T, fileUri: vscode.Uri): T {
  try {
    return editFn();
  } catch (e) {
    if (!(e instanceof McpJsonError)) throw e;
    throw new PowerError('MCP_FILE_INVALID', `No se pudo editar .vscode/mcp.json de forma segura (${e.message}). Edítalo a mano y reintenta.`, fileUri);
  }
}

/** Ejecuta un paso de limpieza ignorando su error, para no tapar el error original. */
async function attempt(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch {
    // se relanza el error original
  }
}

export class PowerInstaller {
  constructor(private readonly readPolicy: () => McpPolicyEnv = readMcpPolicyEnv) {}

  policy(): McpPolicyState {
    return mcpPolicyState(this.readPolicy());
  }

  lockUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.github', 'powers.lock.json');
  }

  mcpUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.vscode', 'mcp.json');
  }

  skillDir(folder: vscode.WorkspaceFolder, skillName: string): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.github', 'skills', skillName);
  }

  async readLock(folder: vscode.WorkspaceFolder): Promise<Lockfile> {
    const text = await readText(this.lockUri(folder));
    try {
      return parseLock(text);
    } catch (e) {
      throw new PowerError('LOCK_INVALID', `${(e as Error).message} Corrígelo o bórralo para continuar.`);
    }
  }

  async activate(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    now: Date = new Date(),
    confirmMcp: ConfirmMcp = async () => true,
  ): Promise<'activated' | 'cancelled'> {
    this.assertSafe(power.skillName, Object.keys(power.files));
    const lock = await this.readLock(folder);
    if (lock.powers[power.id]) return 'activated';
    if (await exists(this.skillDir(folder, power.skillName))) {
      throw new PowerError(
        'FOREIGN_SKILL',
        `Ya existe un skill "${power.skillName}" que no instaló SDD Studio (.github/skills/${power.skillName}/). Renómbralo o bórralo para activar este Power.`,
      );
    }
    const plan = power.mcp ? await this.planMcp(folder, lock, power.id, { spec: power.mcp, mode: 'readOnly' }) : undefined;
    if (plan === 'cancelled') return 'cancelled';
    if (power.mcp && !(await confirmMcp(power.mcp))) return 'cancelled';
    try {
      await this.writeFiles(folder, power);
      if (plan) await this.applyMcp(folder, plan);
      await this.writeLock(folder, withEntry(lock, power.id, this.entryFor(power, now, plan?.lock)));
    } catch (e) {
      // Cada paso de limpieza por separado: si uno falla, los demás se intentan igual y se relanza el error original.
      const dir = this.skillDir(folder, power.skillName);
      for (const rel of Object.keys(power.files)) await attempt(() => this.deleteIfExists(under(dir, rel)));
      await attempt(() => this.pruneEmptyDirs(dir));
      if (plan) await attempt(() => this.restoreMcp(folder, plan.before));
      throw e;
    }
    return 'activated';
  }

  async update(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    confirmOverwrite: ConfirmOverwrite,
    now: Date = new Date(),
    confirmMcp: ConfirmMcp = async () => true,
  ): Promise<'updated' | 'cancelled'> {
    this.assertSafe(power.skillName, Object.keys(power.files));
    const lock = await this.readLock(folder);
    const entry = lock.powers[power.id];
    if (!entry) throw new PowerError('NOT_INSTALLED', `El Power "${power.id}" no está activo en este repo.`);
    this.assertSafe(entry.skillName, entry.files);
    if (entry.skillName !== power.skillName) {
      throw new PowerError('UNSAFE_PATH', `El Power "${power.id}" cambió de nombre de skill; desactívalo y vuelve a activarlo.`);
    }
    const dir = this.skillDir(folder, entry.skillName);
    if (await this.skillEdited(dir, entry)) {
      if (!(await confirmOverwrite('SKILL_EDITED'))) return 'cancelled';
    }
    const mode: McpMode = power.mcp?.operate ? (entry.mcp?.mode ?? 'readOnly') : 'readOnly';
    const target = power.mcp ? { spec: power.mcp, mode } : undefined;
    const plan = power.mcp || entry.mcp ? await this.planMcp(folder, lock, power.id, target, confirmOverwrite) : undefined;
    if (plan === 'cancelled') return 'cancelled';
    // Un servidor nuevo, o uno que ejecuta otro código o conecta a otra URL, se vuelve a confirmar.
    if (power.mcp && plan?.commandChanged && !(await confirmMcp(power.mcp))) return 'cancelled';
    await this.writeFiles(folder, power);
    for (const rel of entry.files) if (!(rel in power.files)) await this.deleteIfExists(under(dir, rel));
    await this.pruneEmptyDirs(dir);
    try {
      if (plan) await this.applyMcp(folder, plan);
      await this.writeLock(folder, withEntry(lock, power.id, this.entryFor(power, now, plan?.lock)));
    } catch (e) {
      // Que el lock y .vscode/mcp.json no discrepen (p. ej. lock en Solo lectura y el archivo en Operar).
      if (plan) await attempt(() => this.restoreMcp(folder, plan.before));
      throw e;
    }
    return 'updated';
  }

  /** Reescribe las entradas MCP del Power en `mode`. También repara entradas que faltan (acción "Reparar" del diagnóstico). */
  async setMode(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    mode: McpMode,
    confirmOverwrite: ConfirmOverwrite,
  ): Promise<'changed' | 'cancelled'> {
    const lock = await this.readLock(folder);
    const entry = lock.powers[power.id];
    if (!entry?.mcp || !power.mcp) throw new PowerError('NOT_INSTALLED', `El Power "${power.id}" no tiene servidores MCP activos en este repo.`);
    if (mode === 'operate' && !power.mcp.operate) {
      throw new PowerError('MCP_NO_OPERATE', `El Power "${power.presentation.displayName}" no tiene modo Operar.`);
    }
    // Con otra versión se escribirían definiciones (y líneas de comando) que nadie confirmó; eso lo hace update.
    if (power.version !== entry.version) {
      throw new PowerError(
        'UPDATE_REQUIRED',
        `Hay una versión nueva de "${power.presentation.displayName}". Actualízalo antes de cambiar de modo o reparar.`,
      );
    }
    const plan = await this.planMcp(folder, lock, power.id, { spec: power.mcp, mode }, confirmOverwrite);
    if (plan === 'cancelled') return 'cancelled';
    try {
      await this.applyMcp(folder, plan);
      await this.writeLock(folder, withEntry(lock, power.id, { ...entry, mcp: plan.lock }));
    } catch (e) {
      await attempt(() => this.restoreMcp(folder, plan.before));
      throw e;
    }
    return 'changed';
  }

  async deactivate(
    folder: vscode.WorkspaceFolder,
    id: string,
    confirmDiscard: ConfirmOverwrite,
  ): Promise<'deactivated' | 'cancelled'> {
    const lock = await this.readLock(folder);
    const entry = lock.powers[id];
    if (!entry) throw new PowerError('NOT_INSTALLED', `El Power "${id}" no está activo en este repo.`);
    this.assertSafe(entry.skillName, entry.files);
    const dir = this.skillDir(folder, entry.skillName);
    if (await this.skillEdited(dir, entry)) {
      if (!(await confirmDiscard('SKILL_EDITED'))) return 'cancelled';
    }
    const plan = entry.mcp ? await this.planMcp(folder, lock, id, undefined, confirmDiscard) : undefined;
    if (plan === 'cancelled') return 'cancelled';
    if (plan) await this.applyMcp(folder, plan);
    for (const rel of entry.files) await this.deleteIfExists(under(dir, rel));
    await this.pruneEmptyDirs(dir);
    await this.writeLock(folder, withoutEntry(lock, id));
    return 'deactivated';
  }

  /**
   * Calcula el nuevo `.vscode/mcp.json` para pasar de lo que el lock registra de `id` a `target` (undefined = quitar todo).
   * Lanza MCP_BLOCKED, MCP_FILE_INVALID o MCP_NAME_CONFLICT antes de tocar nada.
   */
  private async planMcp(
    folder: vscode.WorkspaceFolder,
    lock: Lockfile,
    id: string,
    target: { spec: McpSpec; mode: McpMode } | undefined,
    confirmOverwrite?: ConfirmOverwrite,
  ): Promise<McpPlan | 'cancelled'> {
    if (target) {
      const policy = this.policy();
      if (policy.state === 'blocked') {
        throw new PowerError('MCP_BLOCKED', `Tu organización bloquea los servidores MCP (${policy.reason}). Ejecuta "SDD Studio: Diagnóstico" para más detalles.`);
      }
    }
    const current = lock.powers[id]?.mcp;
    const currentNames = Object.keys(current?.servers ?? {});
    const targetServers = target ? serversForMode(target.spec, target.mode) : {};
    const before = await readText(this.mcpUri(folder));
    let present: Record<string, unknown>;
    try {
      present = readEntries(before, [...new Set([...currentNames, ...Object.keys(targetServers)])]);
    } catch (e) {
      if (!(e instanceof McpJsonError)) throw e;
      throw new PowerError('MCP_FILE_INVALID', `${e.message} Corrige .vscode/mcp.json y reintenta.`, this.mcpUri(folder));
    }
    const foreign = Object.keys(targetServers).find((n) => !currentNames.includes(n) && n in present);
    if (foreign) throw new PowerError('MCP_NAME_CONFLICT', `Ya existe un servidor "${foreign}" en .vscode/mcp.json que no instaló SDD Studio.`);
    const edited = currentNames.some((n) => n in present && entryHash(present[n]) !== current!.servers[n]);
    if (edited && confirmOverwrite && !(await confirmOverwrite('MCP_EDITED'))) return 'cancelled';

    const targetInputs = target?.spec.inputs.map((i) => i.id) ?? [];
    const keep = inputsInUse(lock, id);
    const dropInputs = (current?.inputs ?? []).filter((i) => !targetInputs.includes(i) && !keep.has(i));
    const after = mcpEditOrFileInvalid(() => {
      const removed = removeEntries(before, currentNames.filter((n) => !(n in targetServers)), dropInputs);
      return target ? addEntries(removed, targetServers, target.spec.inputs) : removed;
    }, this.mcpUri(folder));
    const commandChanged = Object.entries(targetServers).some(
      ([n, s]) =>
        !currentNames.includes(n) ||
        (current?.servers[n] !== entryHash(s) && (!(n in present) || commandLine(present[n]) !== commandLine(s))),
    );
    const createdFile = current?.createdFile ?? (before === undefined || mcpFileCreatedByUs(lock, id));
    const deleteFile = !target && createdFile && mcpEditOrFileInvalid(() => isEmptyMcpFile(after), this.mcpUri(folder));
    return {
      before,
      after: deleteFile ? undefined : after,
      lock: target
        ? {
            mode: target.mode,
            servers: Object.fromEntries(Object.entries(targetServers).map(([n, s]) => [n, entryHash(s)])),
            inputs: [...targetInputs].sort(),
            createdFile,
          }
        : undefined,
      commandChanged,
    };
  }

  private async skillEdited(dir: vscode.Uri, entry: LockEntry): Promise<boolean> {
    const onDisk: Record<string, string> = {};
    for (const rel of entry.files) {
      const text = await readText(under(dir, rel));
      if (text === undefined) return true;
      onDisk[rel] = text;
    }
    return powerHash(onDisk) !== entry.sha256;
  }

  private assertSafe(skillName: string, paths: string[]): void {
    if (!isValidId(skillName) || !paths.every(isSafeRelativePath)) {
      throw new PowerError('UNSAFE_PATH', `El Power "${skillName}" contiene rutas de archivo no permitidas; no se instaló nada.`);
    }
  }

  /** El sha256 del lock es el de los archivos del skill (sin MCP): así se detectan ediciones locales. */
  private entryFor(power: CatalogPower, now: Date, mcp: LockMcp | undefined): LockEntry {
    return {
      version: power.version,
      skillName: power.skillName,
      sha256: powerHash(power.files),
      files: Object.keys(power.files).sort(),
      installedAt: now.toISOString(),
      ...(mcp ? { mcp } : {}),
    };
  }

  private async writeFiles(folder: vscode.WorkspaceFolder, power: CatalogPower): Promise<void> {
    const dir = this.skillDir(folder, power.skillName);
    for (const [rel, content] of Object.entries(power.files)) {
      const uri = under(dir, rel);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    }
  }

  private async applyMcp(folder: vscode.WorkspaceFolder, plan: McpPlan): Promise<void> {
    if (plan.after === undefined) await this.deleteIfExists(this.mcpUri(folder));
    else if (plan.after !== plan.before) await this.writeMcpJson(folder, plan.after);
  }

  private async restoreMcp(folder: vscode.WorkspaceFolder, before: string | undefined): Promise<void> {
    if (before === undefined) await this.deleteIfExists(this.mcpUri(folder));
    else await this.writeMcpJson(folder, before);
  }

  protected async writeMcpJson(folder: vscode.WorkspaceFolder, text: string): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.vscode'));
    await vscode.workspace.fs.writeFile(this.mcpUri(folder), encoder.encode(text));
  }

  protected async writeLock(folder: vscode.WorkspaceFolder, lock: Lockfile): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.github'));
    await vscode.workspace.fs.writeFile(this.lockUri(folder), encoder.encode(serializeLock(lock)));
  }

  private async deleteIfExists(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }

  private async pruneEmptyDirs(dir: vscode.Uri): Promise<void> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch (e) {
      if (isNotFound(e)) return;
      throw e;
    }
    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory) await this.pruneEmptyDirs(vscode.Uri.joinPath(dir, name));
    }
    if ((await vscode.workspace.fs.readDirectory(dir)).length === 0) await vscode.workspace.fs.delete(dir);
  }
}
