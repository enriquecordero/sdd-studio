function globToRegex(glob: string): string {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return re;
}

interface Rule {
  re: RegExp;
  negate: boolean;
  dirOnly: boolean;
}

function parseRules(gitignore: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of gitignore.split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.startsWith('/') || line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ re: new RegExp(`^${anchored ? '' : '(?:.*/)?'}${globToRegex(line)}$`), negate, dirOnly });
  }
  return rules;
}

function matches(rules: Rule[], path: string, isDir: boolean): boolean {
  let ignored = false;
  for (const r of rules) if ((!r.dirOnly || isDir) && r.re.test(path)) ignored = !r.negate;
  return ignored;
}

/**
 * ¿Ignora este `.gitignore` (el de la raíz) la ruta `rel`? Cubre comentarios, negación (`!`), anclaje (`/x`),
 * carpetas (`x/`), `*`, `?` y `**`, y como git, una carpeta ignorada no se puede "des-ignorar" por dentro.
 * No lee `.gitignore` anidados ni el exclude global.
 */
export function isIgnoredBy(gitignore: string, rel: string): boolean {
  const rules = parseRules(gitignore);
  const parts = rel.split('/');
  for (let i = 1; i < parts.length; i++) if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  return matches(rules, rel, false);
}
