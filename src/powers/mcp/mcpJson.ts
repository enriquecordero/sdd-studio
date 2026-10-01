import { createHash } from 'crypto';
import { applyEdits, format, FormattingOptions, modify, Node, parse, ParseError, parseTree, printParseErrorCode } from 'jsonc-parser';
import { canonicalJson } from '../hash';
import { McpInput, McpServer } from './spec';

/** `.vscode/mcp.json` no se puede leer como JSONC con la forma esperada. */
export class McpJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpJsonError';
  }
}

const FORMAT: FormattingOptions = { insertSpaces: true, tabSize: 2, eol: '\n' };
const EMPTY = '{\n  "servers": {}\n}\n';

interface McpFile {
  servers: Record<string, unknown>;
  inputs: { id?: unknown }[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function load(text: string | undefined): McpFile {
  if (text === undefined || text.trim() === '') return { servers: {}, inputs: [] };
  const errors: ParseError[] = [];
  const root: unknown = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0) throw new McpJsonError(`.vscode/mcp.json no es JSONC válido (${printParseErrorCode(errors[0].error)} en la posición ${errors[0].offset}).`);
  if (!isObj(root)) throw new McpJsonError('.vscode/mcp.json debe ser un objeto.');
  if (root.servers !== undefined && !isObj(root.servers)) throw new McpJsonError('.vscode/mcp.json: "servers" debe ser un objeto.');
  if (root.inputs !== undefined && !Array.isArray(root.inputs)) throw new McpJsonError('.vscode/mcp.json: "inputs" debe ser una lista.');
  return { servers: (root.servers as Record<string, unknown>) ?? {}, inputs: (root.inputs as { id?: unknown }[]) ?? [] };
}

const hasKey = (text: string, key: string): boolean => key in (parse(text) as Record<string, unknown>);

/**
 * Aplica un cambio sin tocar un solo byte fuera del nodo afectado: `modify` sin formato y,
 * si se inserta o reemplaza un valor, se formatea solo el rango insertado.
 */
function edit(text: string, path: (string | number)[], value: unknown): string {
  const edits = modify(text, path, value, {});
  if (edits.length === 0) return text;
  const changed = applyEdits(text, edits);
  if (value === undefined) return changed;
  const first = edits[0];
  const content = edits.reduce((n, e) => n + e.content.length, 0);
  return applyEdits(changed, format(changed, { offset: first.offset, length: content }, FORMAT));
}

/** Nodo en `path` (claves de objeto o índices de lista), o undefined. */
function findNode(root: Node | undefined, path: (string | number)[]): Node | undefined {
  let node = root;
  for (const key of path) {
    node = typeof key === 'number' ? node?.children?.[key] : node?.children?.find((p) => p.children?.[0]?.value === key)?.children?.[1];
  }
  return node;
}

/**
 * Borra el hijo `index` del objeto o lista en `path` sin tocar ningún otro byte ni comentario ajeno:
 * 1. con hermano anterior unido solo por su coma, se borra esa coma y el nodo (deshace exactamente una inserción);
 * 2. si no, se borra el nodo con su línea (y su coma, si la tiene), dejando intactos los comentarios vecinos.
 * No usa `modify`: al borrar se come comas y comentarios de los hermanos.
 */
function removeChild(text: string, path: (string | number)[], index: number): string {
  const kids = findNode(parseTree(text), path)?.children ?? [];
  const node = kids[index];
  if (!node) return text;
  const end = node.offset + node.length;
  const prev = kids[index - 1];
  if (prev) {
    const gap = text.slice(prev.offset + prev.length, node.offset);
    const comma = /^\s*,\s*$/.test(gap) ? gap.indexOf(',') : -1;
    if (comma >= 0) return text.slice(0, prev.offset + prev.length + comma) + text.slice(end);
  }
  const after = /^\s*,/.exec(text.slice(end));
  const to = after ? end + after[0].length : end;
  const lineStart = text.lastIndexOf('\n', node.offset - 1) + 1;
  const alone = /^[ \t]*$/.test(text.slice(lineStart, node.offset));
  const rest = /^[ \t]*\r?\n/.exec(text.slice(to));
  if (alone && rest) return text.slice(0, lineStart) + text.slice(to + rest[0].length);
  return text.slice(0, alone ? lineStart : node.offset) + text.slice(to);
}

/** Índice del hijo de `path` que cumple `match`, o -1. */
const childIndex = (text: string, path: (string | number)[], match: (kid: Node) => boolean): number =>
  (findNode(parseTree(text), path)?.children ?? []).findIndex(match);

/** Hash estable de una entrada de servidor: no cambia si solo cambia el orden de las claves. */
export function entryHash(server: unknown): string {
  return createHash('sha256').update(canonicalJson(server)).digest('hex');
}

/** Entradas presentes de entre `names`. Lanza McpJsonError si el archivo no es válido. Sin archivo = vacío. */
export function readEntries(text: string | undefined, names: string[]): Record<string, unknown> {
  const { servers } = load(text);
  const out: Record<string, unknown> = {};
  for (const name of names) if (name in servers) out[name] = servers[name];
  return out;
}

/** Ids de los inputs declarados en el archivo. */
export function readInputIds(text: string | undefined): string[] {
  return load(text)
    .inputs.map((i) => (isObj(i) && typeof i.id === 'string' ? i.id : undefined))
    .filter((id): id is string => id !== undefined);
}

/** true si el archivo no tiene servidores ni inputs. */
export function isEmptyMcpFile(text: string | undefined): boolean {
  const f = load(text);
  return Object.keys(f.servers).length === 0 && f.inputs.length === 0;
}

/** Añade o reemplaza `servers` y añade los `inputs` cuyo id aún no está. Conserva comentarios, formato y entradas ajenas. */
export function addEntries(text: string | undefined, servers: Record<string, McpServer>, inputs: McpInput[]): string {
  const fresh = text === undefined || text.trim() === '';
  let out = fresh ? EMPTY : text;
  load(out);
  for (const [name, server] of Object.entries(servers)) out = edit(out, ['servers', name], server);
  const have = new Set(readInputIds(out));
  const missing = inputs.filter((i) => !have.has(i.id));
  if (missing.length > 0 && !hasKey(out, 'inputs')) out = edit(out, ['inputs'], []);
  for (const input of missing) out = edit(out, ['inputs', -1], input);
  // Archivo nuevo: es todo nuestro, se formatea entero.
  return fresh ? `${applyEdits(out, format(out, undefined, FORMAT)).trimEnd()}\n` : out;
}

/** Quita los servidores `names` y los inputs `inputIds`. Deja `"servers": {}` si no queda ninguno. */
export function removeEntries(text: string | undefined, names: string[], inputIds: string[]): string {
  let out = text === undefined || text.trim() === '' ? EMPTY : text;
  const servers = load(out).servers;
  for (const name of names) {
    if (!(name in servers)) continue;
    out = removeChild(out, ['servers'], childIndex(out, ['servers'], (p) => p.children?.[0]?.value === name));
  }
  const hadInputs = load(out).inputs.length;
  for (const id of inputIds) {
    const index = load(out).inputs.findIndex((i) => isObj(i) && i.id === id);
    if (index >= 0) out = removeChild(out, ['inputs'], index);
  }
  // Si nuestra retirada vació "inputs", no dejamos `"inputs": []`; uno que ya estaba vacío se respeta.
  if (hadInputs > 0 && load(out).inputs.length === 0) {
    const arrayText = findNode(parseTree(out), ['inputs']);
    const hasComment = arrayText !== undefined && /\/[/*]/.test(out.slice(arrayText.offset, arrayText.offset + arrayText.length));
    if (!hasComment) out = removeChild(out, [], childIndex(out, [], (p) => p.children?.[0]?.value === 'inputs'));
  }
  return out;
}
