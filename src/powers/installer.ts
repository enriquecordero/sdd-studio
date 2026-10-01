import * as vscode from 'vscode';
import { isSafeRelativePath, isValidId } from './catalog';
import { powerHash } from './hash';
import { LockEntry, Lockfile, parseLock, serializeLock, withEntry, withoutEntry } from './lock';
import { CatalogPower } from './types';

export type PowerErrorCode = 'FOREIGN_SKILL' | 'NOT_INSTALLED' | 'UNSAFE_PATH' | 'NOT_FOUND' | 'LOCK_INVALID';

export class PowerError extends Error {
  constructor(
    readonly code: PowerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PowerError';
  }
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

export class PowerInstaller {
  lockUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.github', 'powers.lock.json');
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

  async activate(folder: vscode.WorkspaceFolder, power: CatalogPower, now: Date = new Date()): Promise<void> {
    this.assertSafe(power.skillName, Object.keys(power.files));
    const lock = await this.readLock(folder);
    if (lock.powers[power.id]) return;
    if (await exists(this.skillDir(folder, power.skillName))) {
      throw new PowerError(
        'FOREIGN_SKILL',
        `Ya existe un skill "${power.skillName}" que no instaló SDD Studio (.github/skills/${power.skillName}/). Renómbralo o bórralo para activar este Power.`,
      );
    }
    try {
      await this.writeFiles(folder, power);
      await this.writeLock(folder, withEntry(lock, power.id, this.entryFor(power, now)));
    } catch (e) {
      const dir = this.skillDir(folder, power.skillName);
      for (const rel of Object.keys(power.files)) await this.deleteIfExists(under(dir, rel));
      await this.pruneEmptyDirs(dir);
      throw e;
    }
  }

  async update(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    confirmOverwrite: () => Promise<boolean>,
    now: Date = new Date(),
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
    const onDisk: Record<string, string> = {};
    let missing = false;
    for (const rel of entry.files) {
      const text = await readText(under(dir, rel));
      if (text === undefined) missing = true;
      else onDisk[rel] = text;
    }
    if (missing || powerHash(onDisk) !== entry.sha256) {
      if (!(await confirmOverwrite())) return 'cancelled';
    }
    await this.writeFiles(folder, power);
    for (const rel of entry.files) if (!(rel in power.files)) await this.deleteIfExists(under(dir, rel));
    await this.pruneEmptyDirs(dir);
    await this.writeLock(folder, withEntry(lock, power.id, this.entryFor(power, now)));
    return 'updated';
  }

  async deactivate(
    folder: vscode.WorkspaceFolder,
    id: string,
    confirmDiscard: () => Promise<boolean>,
  ): Promise<'deactivated' | 'cancelled'> {
    const lock = await this.readLock(folder);
    const entry = lock.powers[id];
    if (!entry) throw new PowerError('NOT_INSTALLED', `El Power "${id}" no está activo en este repo.`);
    this.assertSafe(entry.skillName, entry.files);
    const dir = this.skillDir(folder, entry.skillName);
    const onDisk: Record<string, string> = {};
    let missing = false;
    for (const rel of entry.files) {
      const text = await readText(under(dir, rel));
      if (text === undefined) missing = true;
      else onDisk[rel] = text;
    }
    if (missing || powerHash(onDisk) !== entry.sha256) {
      if (!(await confirmDiscard())) return 'cancelled';
    }
    for (const rel of entry.files) await this.deleteIfExists(under(dir, rel));
    await this.pruneEmptyDirs(dir);
    await this.writeLock(folder, withoutEntry(lock, id));
    return 'deactivated';
  }

  private assertSafe(skillName: string, paths: string[]): void {
    if (!isValidId(skillName) || !paths.every(isSafeRelativePath)) {
      throw new PowerError('UNSAFE_PATH', `El Power "${skillName}" contiene rutas de archivo no permitidas; no se instaló nada.`);
    }
  }

  private entryFor(power: CatalogPower, now: Date): LockEntry {
    return {
      version: power.version,
      skillName: power.skillName,
      sha256: power.sha256,
      files: Object.keys(power.files).sort(),
      installedAt: now.toISOString(),
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
