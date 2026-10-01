import { powerHash } from './hash';
import { CATEGORIES, Catalog, MAX_EDGE, MAX_ITEM, MAX_LABEL, NODE_LIMITS, TONES } from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const SHA_RE = /^[a-f0-9]{64}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isTextList = (v: unknown, min: number): v is string[] => Array.isArray(v) && v.length >= min && v.every(isText);
const isTone = (v: unknown): boolean => v === undefined || TONES.includes(v as never);

export function isValidId(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 64 && ID_RE.test(v);
}

export function isSemver(v: unknown): v is string {
  return typeof v === 'string' && SEMVER_RE.test(v);
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function isSafeRelativePath(p: string): boolean {
  if (p === '' || p.startsWith('/') || p.includes('\\') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

function checkLabel(text: string, max: number, what: string, where: string, errors: string[]): void {
  if (text.length > max) errors.push(`${where}: ${what} "${text}" supera ${max} caracteres.`);
}

function validateDiagram(d: unknown, where: string, errors: string[]): void {
  if (!isObj(d)) {
    errors.push(`${where}: "diagram" debe ser un objeto.`);
    return;
  }
  if (d.kind === 'split') {
    const cols = d.columns;
    if (!Array.isArray(cols) || cols.length !== 2) {
      errors.push(`${where}: un diagrama "split" necesita exactamente 2 columnas.`);
      return;
    }
    cols.forEach((c, i) => {
      if (!isObj(c) || !isText(c.label) || !isTextList(c.items, 1) || c.items.length > 6) {
        errors.push(`${where}: la columna ${i + 1} necesita "label" y entre 1 y 6 "items".`);
        return;
      }
      if (!isTone(c.tone)) errors.push(`${where}: tono inválido "${String(c.tone)}".`);
      checkLabel(c.label, MAX_LABEL, 'la etiqueta', where, errors);
      c.items.forEach((item) => checkLabel(item, MAX_ITEM, 'el ítem', where, errors));
    });
    return;
  }
  if (d.kind !== 'cycle' && d.kind !== 'steps' && d.kind !== 'funnel') {
    errors.push(`${where}: "diagram.kind" debe ser cycle, steps, funnel o split.`);
    return;
  }
  const [min, max] = NODE_LIMITS[d.kind];
  const nodes = d.nodes;
  if (!Array.isArray(nodes) || nodes.length < min || nodes.length > max) {
    errors.push(`${where}: un diagrama "${d.kind}" necesita entre ${min} y ${max} nodos.`);
    return;
  }
  nodes.forEach((n, i) => {
    if (!isObj(n) || !isText(n.label)) {
      errors.push(`${where}: el nodo ${i + 1} necesita "label".`);
      return;
    }
    if (!isTone(n.tone)) errors.push(`${where}: tono inválido "${String(n.tone)}".`);
    checkLabel(n.label, MAX_LABEL, 'la etiqueta', where, errors);
    if (n.edge !== undefined) {
      if (typeof n.edge !== 'string') errors.push(`${where}: "edge" del nodo ${i + 1} debe ser texto.`);
      else checkLabel(n.edge, MAX_EDGE, 'el texto de flecha', where, errors);
    }
  });
}

export function validatePresentation(p: unknown, where: string): string[] {
  if (!isObj(p)) return [`${where}: la presentación debe ser un objeto.`];
  const errors: string[] = [];
  for (const key of ['displayName', 'icon', 'summary'] as const) if (!isText(p[key])) errors.push(`${where}: falta "${key}".`);
  if (!CATEGORIES.includes(p.category as never)) errors.push(`${where}: "category" debe ser una de: ${CATEGORIES.join(', ')}.`);
  if (!isTextList(p.triggers, 1)) errors.push(`${where}: "triggers" necesita al menos 1 texto.`);
  if (!isTextList(p.gets, 1)) errors.push(`${where}: "gets" necesita al menos 1 texto.`);
  validateDiagram(p.diagram, where, errors);
  const s = p.source;
  if (!isObj(s)) errors.push(`${where}: falta "source".`);
  else for (const key of ['repo', 'path', 'commit', 'author', 'license'] as const) if (!isText(s[key])) errors.push(`${where}: falta "source.${key}".`);
  return errors;
}

function validatePower(p: unknown, index: number): string[] {
  const where = `powers[${index}]`;
  if (!isObj(p)) return [`${where}: debe ser un objeto.`];
  const name = isValidId(p.id) ? p.id : where;
  const errors: string[] = [];
  if (!isValidId(p.id)) errors.push(`${where}: "id" inválido.`);
  if (!isSemver(p.version)) errors.push(`${name}: "version" debe ser semver (1.2.3).`);
  if (!isValidId(p.skillName)) errors.push(`${name}: "skillName" inválido.`);
  if (!isObj(p.files) || !('SKILL.md' in p.files)) {
    errors.push(`${name}: "files" debe incluir SKILL.md.`);
  } else {
    const fileErrors: string[] = [];
    for (const [path, content] of Object.entries(p.files)) {
      if (!isSafeRelativePath(path)) fileErrors.push(`${name}: ruta de archivo no permitida "${path}".`);
      if (typeof content !== 'string') fileErrors.push(`${name}: el contenido de "${path}" debe ser texto.`);
    }
    errors.push(...fileErrors);
    if (typeof p.sha256 !== 'string' || !SHA_RE.test(p.sha256)) errors.push(`${name}: "sha256" inválido.`);
    else if (fileErrors.length === 0 && powerHash(p.files as Record<string, string>) !== p.sha256) {
      errors.push(`${name}: el hash no coincide con los archivos.`);
    }
  }
  errors.push(...validatePresentation(p.presentation, name));
  return errors;
}

export function validateCatalog(json: unknown): ValidationResult<Catalog> {
  if (!isObj(json)) return { ok: false, errors: ['El catálogo debe ser un objeto.'] };
  const errors: string[] = [];
  if (json.schemaVersion !== 1) errors.push('"schemaVersion" debe ser 1.');
  if (typeof json.generatedAt !== 'string' || Number.isNaN(Date.parse(json.generatedAt))) errors.push('"generatedAt" debe ser una fecha ISO.');
  if (!Array.isArray(json.powers)) {
    errors.push('"powers" debe ser una lista.');
  } else {
    json.powers.forEach((p, i) => errors.push(...validatePower(p, i)));
    const ids = json.powers.map((p) => (isObj(p) ? p.id : undefined));
    const dup = ids.find((id, i) => id !== undefined && ids.indexOf(id) !== i);
    if (dup !== undefined) errors.push(`Id duplicado: ${String(dup)}.`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: json as unknown as Catalog };
}

export function newestCatalog(current: Catalog | undefined, candidate: Catalog | undefined): Catalog | undefined {
  if (!current) return candidate;
  if (!candidate) return current;
  return Date.parse(candidate.generatedAt) > Date.parse(current.generatedAt) ? candidate : current;
}
