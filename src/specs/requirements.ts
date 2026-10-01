const REQUIREMENT_HEADING_RE = /^#{2,4}\s+(?:Requisito|Requirement)\s+(\d+)\b/i;
const CRITERION_RE = /^\s*(\d+)\.\s/;
const SECTION_END_RE = /^#{1,3}\s/;

/** Línea (base 0) del criterio "N.M" o del encabezado "Requisito N". */
export function findRequirementLine(text: string, reqId: string): number | undefined {
  const [major, minor] = reqId.split('.');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => REQUIREMENT_HEADING_RE.exec(line)?.[1] === major);
  if (start < 0) return undefined;
  if (minor === undefined) return start;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION_END_RE.test(lines[i])) break;
    if (CRITERION_RE.exec(lines[i])?.[1] === minor) return i;
  }
  return start;
}
