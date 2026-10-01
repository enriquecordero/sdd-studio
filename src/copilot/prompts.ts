import type { DocKind, SpecType } from '../specs/phase';

export type AgentName = 'sdd-requirements' | 'sdd-design' | 'sdd-tasks' | 'sdd-implement' | 'sdd-steering';
export type Language = 'es' | 'en';

function languageLine(language: Language): string {
  return language === 'en'
    ? 'Write the document in English; EARS keywords stay in English.'
    : 'Redacta en español; las palabras clave EARS van en inglés.';
}

function folderArg(folder?: string): string {
  return folder ? `, folder="${folder}"` : '';
}

export function newSpecPrompt(p: { spec: string; folder?: string; type: SpecType; description: string; language: Language }): string {
  const doc = p.type === 'bugfix' ? 'bugfix' : 'requirements';
  return [
    `Crea el spec "${p.spec}" (${p.type}).`,
    `Descripción: ${p.description.trim() || '(sin descripción: pregúntame)'}`,
    `Escribe ${doc}.md con la herramienta writeSpecDoc (spec="${p.spec}", doc="${doc}"${folderArg(p.folder)}).`,
    languageLine(p.language),
  ].join('\n');
}

export function runTaskPrompt(p: {
  specsFolder: string;
  spec: string;
  folder?: string;
  type: SpecType;
  task: { id: string; title: string; requirements: string[] };
}): string {
  const base = `${p.specsFolder}/${p.spec}`;
  const first = p.type === 'bugfix' ? 'bugfix' : 'requirements';
  return [
    `Ejecuta la tarea ${p.task.id} del spec "${p.spec}": ${p.task.title}`,
    `Criterios relacionados: ${p.task.requirements.join(', ') || 'ninguno indicado'}`,
    ...(p.folder ? [`Carpeta del workspace: ${p.folder}`] : []),
    `Contexto: #file:${base}/${first}.md #file:${base}/design.md #file:${base}/tasks.md`,
    'Implementa solo esta tarea, con tests primero, y verifica ejecutándolos. No la marques como hecha: lo confirmo yo con el botón.',
  ].join('\n');
}

export function nextPhasePrompt(p: {
  spec: string;
  folder?: string;
  approved: DocKind;
  language: Language;
}): { agent: AgentName; prompt: string } | undefined {
  const where = `spec="${p.spec}"${folderArg(p.folder)}`;
  if (p.approved === 'requirements' || p.approved === 'bugfix') {
    return {
      agent: 'sdd-design',
      prompt: [
        `Ya aprobé ${p.approved}.md del spec "${p.spec}". Redacta design.md con writeSpecDoc (${where}, doc="design").`,
        languageLine(p.language),
      ].join('\n'),
    };
  }
  if (p.approved === 'design') {
    return {
      agent: 'sdd-tasks',
      prompt: [
        `Ya aprobé design.md del spec "${p.spec}". Redacta tasks.md con writeSpecDoc (${where}, doc="tasks").`,
        languageLine(p.language),
      ].join('\n'),
    };
  }
  return undefined;
}

export function steeringPrompt(language: Language): string {
  return [
    'Analiza este repositorio y genera o actualiza el steering del proyecto en .github/instructions/:',
    '- product.instructions.md (propósito, usuarios, objetivos) con applyTo: "**"',
    '- tech.instructions.md (stack, librerías, comandos de build y test, restricciones) con applyTo: "**"',
    '- structure.instructions.md (organización de carpetas, nombres, patrones de arquitectura) con applyTo: "**"',
    'Si ya existen, conserva lo que siga siendo cierto y corrige lo que no.',
    languageLine(language),
  ].join('\n');
}
