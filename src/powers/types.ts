import type { McpSpec } from './mcp/spec';

export type PowerCategory = 'planning' | 'testing' | 'debugging' | 'architecture' | 'research' | 'modes' | 'devcore' | 'docs' | 'cloud';
export const CATEGORIES: readonly PowerCategory[] = [
  'planning',
  'testing',
  'debugging',
  'architecture',
  'research',
  'modes',
  'devcore',
  'docs',
  'cloud',
];
export const CATEGORY_LABELS: Record<PowerCategory, string> = {
  planning: 'Planificación',
  testing: 'Testing',
  debugging: 'Debugging',
  architecture: 'Arquitectura',
  research: 'Investigación',
  modes: 'Modos',
  devcore: 'Dev core',
  docs: 'Documentación',
  cloud: 'Cloud',
};

export type Tone = 'red' | 'green' | 'blue' | 'accent' | 'warn';
export const TONES: readonly Tone[] = ['red', 'green', 'blue', 'accent', 'warn'];

export type NodeDiagramKind = 'cycle' | 'steps' | 'funnel';
export const NODE_LIMITS: Record<NodeDiagramKind, [number, number]> = { cycle: [3, 5], steps: [2, 6], funnel: [2, 5] };
export const MAX_LABEL = 14;
export const MAX_EDGE = 22;
export const MAX_ITEM = 24;

export interface DiagramNode {
  label: string;
  tone?: Tone;
  edge?: string;
}
export interface SplitColumn {
  label: string;
  tone?: Tone;
  items: string[];
}
export type Diagram = { kind: NodeDiagramKind; nodes: DiagramNode[] } | { kind: 'split'; columns: SplitColumn[] };

export interface PowerSource {
  repo: string;
  path: string;
  commit: string;
  author: string;
  license: string;
}

export interface Presentation {
  displayName: string;
  icon: string;
  category: PowerCategory;
  summary: string;
  triggers: string[];
  diagram: Diagram;
  gets: string[];
  source: PowerSource;
}

export interface CatalogPower {
  id: string;
  version: string;
  presentation: Presentation;
  skillName: string;
  files: Record<string, string>;
  sha256: string;
  /** Servidores MCP del Power (contenido validado de `mcp.vscode.json`). Solo en catálogos v2. */
  mcp?: McpSpec;
}

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  powers: CatalogPower[];
}

export const EMPTY_CATALOG: Catalog = { schemaVersion: 1, generatedAt: '1970-01-01T00:00:00.000Z', powers: [] };

export function sourceUrl(s: PowerSource): string {
  return `https://github.com/${s.repo}/tree/${s.commit}/${s.path}`;
}
