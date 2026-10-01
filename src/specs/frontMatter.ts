export type DocStatus = 'draft' | 'approved';

export interface FrontMatter {
  status: DocStatus;
  approvedAt?: string;
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n?---(?:\r?\n|$)/;

interface SplitResult {
  lines: string[];
  body: string;
  eol: string;
}

function split(text: string): SplitResult {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const match = FRONT_MATTER_RE.exec(text);
  if (!match) return { lines: [], body: text, eol };
  const inner = match[1];
  return { lines: inner === '' ? [] : inner.split(/\r?\n/), body: text.slice(match[0].length), eol };
}

function keyOf(line: string): string | undefined {
  const i = line.indexOf(':');
  return i > 0 ? line.slice(0, i).trim() : undefined;
}

export function frontMatterFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of split(text).lines) {
    const key = keyOf(line);
    if (key) fields.set(key, line.slice(line.indexOf(':') + 1).trim());
  }
  return fields;
}

export function readFrontMatter(text: string): FrontMatter {
  const fields = frontMatterFields(text);
  const status: DocStatus = fields.get('status') === 'approved' ? 'approved' : 'draft';
  const approvedAt = fields.get('approvedAt');
  return approvedAt ? { status, approvedAt } : { status };
}

export function setFrontMatterFields(text: string, fields: Record<string, string | undefined>): string {
  const { lines, body, eol } = split(text);
  const out = [...lines];
  for (const [key, value] of Object.entries(fields)) {
    const index = out.findIndex((line) => keyOf(line) === key);
    if (value === undefined) {
      if (index >= 0) out.splice(index, 1);
    } else if (index >= 0) {
      out[index] = `${key}: ${value}`;
    } else {
      out.push(`${key}: ${value}`);
    }
  }
  return ['---', ...out, '---'].join(eol) + eol + body;
}

const WRAPPING_FENCE_RE = /^```(?:markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/;

export function prepareSpecDocContent(content: string): string {
  let text = content.trim();
  const fence = WRAPPING_FENCE_RE.exec(text);
  if (fence) text = fence[1].trim();
  text = split(text).body.replace(/^\s+/, '');
  return text.endsWith('\n') ? text : `${text}\n`;
}
