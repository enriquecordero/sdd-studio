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
 * Borra el hijo `index` del objeto o lista en `path` junto con su coma, sin tocar el resto de bytes:
 * con hermano anterior se borra desde el final de ese hermano; si no, hasta el inicio del siguiente.
 * (`modify` también se come la coma final de un hermano ajeno, así que solo se usa si es el único hijo.)
 */
function removeChild(text: string, path: (string | number)[], index: number): string {
  const container = findNode(parseTree(text), path);
  const kids = container?.children ?? [];
  if (kids.length <= 1) {
    const key = container?.type === 'object' ? (kids[0].children?.[0]?.value as string) : index;
    return edit(text, [...path, key], undefined);
  }
  const node = kids[index];
  const prev = kids[index - 1];
  const next = kids[index + 1];
  const [from, to] = prev ? [prev.offset + prev.length, node.offset + node.length] : [node.offset, next.offset];
  return text.slice(0, from) + text.slice(to);
}

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
    const kids = findNode(parseTree(out), ['servers'])?.children ?? [];
    out = removeChild(out, ['servers'], kids.findIndex((p) => p.children?.[0]?.value === name));
  }
  const hadInputs = load(out).inputs.length;
  for (const id of inputIds) {
    const index = load(out).inputs.findIndex((i) => isObj(i) && i.id === id);
    if (index >= 0) out = removeChild(out, ['inputs'], index);
  }
  // Si nuestra retirada vació "inputs", no dejamos `"inputs": []`; uno que ya estaba vacío se respeta.
  if (hadInputs > 0 && load(out).inputs.length === 0) out = edit(out, ['inputs'], undefined);
  return out;
}
