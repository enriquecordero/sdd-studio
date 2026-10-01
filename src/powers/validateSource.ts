import { frontMatterFields } from '../specs/frontMatter';
import { isSafeRelativePath, isSemver, isValidId, validatePresentation } from './catalog';

export interface PowerSourceInput {
  dirName: string;
  pluginJson: unknown;
  presentation: unknown;
  skillDirs: string[];
  skillFiles: Record<string, string>;
  hasLicense: boolean;
  hasUpstream: boolean;
}

export const FORBIDDEN_TERMS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bTodoWrite\b/, label: 'TodoWrite' },
  { pattern: /\bTask tool\b/i, label: 'Task tool' },
  { pattern: /\bAskUserQuestion\b/, label: 'AskUserQuestion' },
  { pattern: /mcp__/, label: 'mcp__' },
  { pattern: /\bSkill tool\b/i, label: 'Skill tool' },
  { pattern: /\bClaude Code\b/, label: 'Claude Code' },
  { pattern: /\bCursor\b/, label: 'Cursor' },
  { pattern: /\b(?:claude-(?:opus|sonnet|haiku|fable)|gpt-\d|grok-?\d|gemini-\d)/i, label: 'nombre de modelo' },
];

const MAX_DESCRIPTION = 1024;

export function validatePowerSource(input: PowerSourceInput): string[] {
  const d = input.dirName;
  const errors: string[] = [];
  if (!isValidId(d)) errors.push(`${d}: el nombre de la carpeta debe ser kebab-case.`);

  const plugin = input.pluginJson as Record<string, unknown> | undefined;
  if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) {
    errors.push(`${d}: falta plugin.json o no es un objeto JSON válido.`);
  } else {
    if (plugin.name !== d) errors.push(`${d}: plugin.json "name" debe ser "${d}".`);
    if (!isSemver(plugin.version)) errors.push(`${d}: plugin.json "version" debe ser semver.`);
    if (typeof plugin.description !== 'string' || !plugin.description.trim()) errors.push(`${d}: plugin.json necesita "description".`);
    const author = plugin.author as Record<string, unknown> | undefined;
    if (typeof author !== 'object' || author === null || typeof author.name !== 'string' || !author.name.trim()) {
      errors.push(`${d}: plugin.json necesita "author.name".`);
    }
    if (typeof plugin.license !== 'string' || !plugin.license.trim()) errors.push(`${d}: plugin.json necesita "license".`);
  }

  errors.push(...validatePresentation(input.presentation, `${d}/presentation.json`));

  if (input.skillDirs.length !== 1 || input.skillDirs[0] !== d) errors.push(`${d}: debe haber exactamente una carpeta skills/${d}/.`);
  const skill = input.skillFiles['SKILL.md'];
  if (skill === undefined) {
    errors.push(`${d}: falta skills/${d}/SKILL.md.`);
  } else {
    const fm = frontMatterFields(skill);
    if (fm.get('name') !== d) errors.push(`${d}: el "name" de SKILL.md debe ser "${d}".`);
    const description = (fm.get('description') ?? '').replace(/^["']|["']$/g, '');
    if (!description) errors.push(`${d}: SKILL.md necesita "description" (en una sola línea).`);
    else if (description.length > MAX_DESCRIPTION) {
      errors.push(`${d}: la "description" de SKILL.md supera ${MAX_DESCRIPTION} caracteres (${description.length}).`);
    }
  }

  for (const [path, content] of Object.entries(input.skillFiles)) {
    if (!isSafeRelativePath(path)) errors.push(`${d}: ruta no permitida "${path}".`);
    for (const { pattern, label } of FORBIDDEN_TERMS) {
      if (pattern.test(content)) errors.push(`${d}: término prohibido "${label}" en skills/${d}/${path}.`);
    }
  }
  if (!input.hasLicense) errors.push(`${d}: falta LICENSE.`);
  if (!input.hasUpstream) errors.push(`${d}: falta UPSTREAM.md.`);
  return errors;
}
