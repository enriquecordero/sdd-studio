export interface FolderCandidate {
  name: string;
  hasSpec: boolean;
}

export type FolderResolution = { ok: true; folder: string } | { ok: false; message: string };

export function resolveSpecFolder(
  folders: FolderCandidate[],
  spec: string,
  requested: string | undefined,
  mustExist: boolean,
): FolderResolution {
  const names = folders.map((f) => f.name).join(', ');
  if (folders.length === 0) return { ok: false, message: 'No hay ninguna carpeta abierta en VS Code.' };

  if (requested !== undefined) {
    const found = folders.find((f) => f.name === requested);
    if (!found) return { ok: false, message: `No existe la carpeta "${requested}". Carpetas: ${names}.` };
    if (mustExist && !found.hasSpec) return { ok: false, message: `No existe el spec "${spec}" en "${requested}".` };
    return { ok: true, folder: found.name };
  }

  const withSpec = folders.filter((f) => f.hasSpec);
  if (withSpec.length === 1) return { ok: true, folder: withSpec[0].name };
  if (withSpec.length > 1) {
    return {
      ok: false,
      message: `El spec "${spec}" existe en varias carpetas (${withSpec.map((f) => f.name).join(', ')}): indica folder.`,
    };
  }
  if (mustExist) return { ok: false, message: `No encontré el spec "${spec}".` };
  if (folders.length === 1) return { ok: true, folder: folders[0].name };
  return { ok: false, message: `Hay varias carpetas abiertas (${names}): indica folder para crear "${spec}".` };
}
