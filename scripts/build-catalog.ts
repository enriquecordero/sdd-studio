import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { validateCatalog } from '../src/powers/catalog';
import { powerHash } from '../src/powers/hash';
import { Catalog, CatalogPower, Presentation } from '../src/powers/types';
import { PowerSourceInput, validatePowerSource } from '../src/powers/validateSource';

function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function listFiles(dir: string, prefix = ''): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) Object.assign(files, listFiles(full, rel));
    else files[rel] = readFileSync(full, 'utf8');
  }
  return files;
}

const subdirs = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort() : [];

export function readPowerSource(powersDir: string, dirName: string): PowerSourceInput {
  const root = join(powersDir, dirName);
  const skillDir = join(root, 'skills', dirName);
  return {
    dirName,
    pluginJson: readJson(join(root, 'plugin.json')),
    presentation: readJson(join(root, 'presentation.json')),
    skillDirs: subdirs(join(root, 'skills')),
    skillFiles: existsSync(skillDir) ? listFiles(skillDir) : {},
    hasLicense: existsSync(join(root, 'LICENSE')),
    hasUpstream: existsSync(join(root, 'UPSTREAM.md')),
  };
}

export function buildCatalog(powersDir: string, now: Date = new Date()): { catalog: Catalog; errors: string[] } {
  const errors: string[] = [];
  const powers: CatalogPower[] = [];
  for (const dirName of subdirs(powersDir)) {
    const input = readPowerSource(powersDir, dirName);
    const problems = validatePowerSource(input);
    if (problems.length > 0) {
      errors.push(...problems);
      continue;
    }
    powers.push({
      id: dirName,
      version: (input.pluginJson as { version: string }).version,
      presentation: input.presentation as Presentation,
      skillName: dirName,
      files: input.skillFiles,
      sha256: powerHash(input.skillFiles),
    });
  }
  const catalog: Catalog = { schemaVersion: 1, generatedAt: now.toISOString(), powers };
  if (errors.length === 0) {
    const check = validateCatalog(catalog);
    if (!check.ok) errors.push(...check.errors);
  }
  return { catalog, errors };
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : 'dist/catalog.json';
  const { catalog, errors } = buildCatalog('powers');
  if (errors.length > 0) {
    console.error(`✗ Catálogo de Powers inválido:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  if (!check) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(catalog)}\n`);
  }
  console.log(`✓ ${catalog.powers.length} Powers ${check ? 'válidos' : `→ ${out}`}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/build-catalog.ts')) main();
