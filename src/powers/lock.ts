import { compareSemver, isSafeRelativePath, isSemver, isValidId } from './catalog';

export interface LockEntry {
  version: string;
  skillName: string;
  sha256: string;
  files: string[];
  installedAt: string;
}

export interface Lockfile {
  schemaVersion: 1;
  powers: Record<string, LockEntry>;
}

export type PowerStatus = 'available' | 'active' | 'update';

export function emptyLock(): Lockfile {
  return { schemaVersion: 1, powers: {} };
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
  if (typeof json !== 'object' || json === null || obj.schemaVersion !== 1 || typeof obj.powers !== 'object' || obj.powers === null) {
    throw new Error('powers.lock.json no tiene el formato esperado (schemaVersion 1).');
  }
  const powers: Record<string, LockEntry> = {};
  for (const [id, raw] of Object.entries(obj.powers as Record<string, unknown>)) {
    const e = (raw ?? {}) as Partial<LockEntry>;
    const files = e.files;
    const valid =
      isValidId(id) &&
      isSemver(e.version) &&
      isValidId(e.skillName) &&
      typeof e.sha256 === 'string' &&
      Array.isArray(files) &&
      files.every((f) => typeof f === 'string' && isSafeRelativePath(f)) &&
      typeof e.installedAt === 'string';
    if (!valid) throw new Error(`powers.lock.json: la entrada "${id}" no es válida.`);
    powers[id] = {
      version: e.version as string,
      skillName: e.skillName as string,
      sha256: e.sha256 as string,
      files: [...(files as string[])],
      installedAt: e.installedAt as string,
    };
  }
  return { schemaVersion: 1, powers };
}

export function serializeLock(lock: Lockfile): string {
  const powers: Record<string, LockEntry> = {};
  for (const id of Object.keys(lock.powers).sort()) powers[id] = lock.powers[id];
  return `${JSON.stringify({ schemaVersion: 1, powers }, null, 2)}\n`;
}

export function withEntry(lock: Lockfile, id: string, entry: LockEntry): Lockfile {
  return { schemaVersion: 1, powers: { ...lock.powers, [id]: entry } };
}

export function withoutEntry(lock: Lockfile, id: string): Lockfile {
  const powers = { ...lock.powers };
  delete powers[id];
  return { schemaVersion: 1, powers };
}

export function powerStatus(power: { version: string }, entry: LockEntry | undefined): PowerStatus {
  if (!entry) return 'available';
  return compareSemver(power.version, entry.version) > 0 ? 'update' : 'active';
}
