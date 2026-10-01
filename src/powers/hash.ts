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
