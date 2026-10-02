import { promises as fs } from 'fs';
import { delimiter, join } from 'path';

/**
 * ¿Hay un ejecutable `cmd` en el PATH? Solo mira el sistema de archivos; nunca ejecuta nada.
 * En Windows prueba las extensiones de PATHEXT.
 */
export async function findOnPath(
  cmd: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<boolean> {
  const dirs = (env.PATH ?? env.Path ?? '').split(delimiter).filter((d) => d !== '');
  const exts = platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((e) => e !== '') : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      try {
        const file = join(dir, cmd + ext);
        const stat = await fs.stat(file);
        if (!stat.isFile()) continue;
        if (platform !== 'win32') await fs.access(file, fs.constants.X_OK);
        return true;
      } catch {
        // no está en esta carpeta
      }
    }
  }
  return false;
}
