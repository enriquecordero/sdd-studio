import { createHash } from 'crypto';

/** Hash estable de los archivos de un Power: rutas ordenadas, cada una como `ruta\0contenido\0`. */
export function powerHash(files: Record<string, string>): string {
  const hash = createHash('sha256');
  for (const path of Object.keys(files).sort()) {
    hash.update(path);
    hash.update('\0');
    hash.update(files[path]);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** JSON con las claves de los objetos ordenadas, a cualquier profundidad: el mismo valor da siempre el mismo texto. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Clave con la que `mcp.vscode.json` entra en el hash del catálogo. No es un archivo del skill. */
export const MCP_HASH_KEY = 'mcp.vscode.json';

/** Hash del catálogo: los archivos del skill y, si hay MCP, `mcp.vscode.json` en forma canónica. */
export function catalogPowerHash(files: Record<string, string>, mcp?: unknown): string {
  return powerHash(mcp === undefined ? files : { ...files, [MCP_HASH_KEY]: canonicalJson(mcp) });
}
