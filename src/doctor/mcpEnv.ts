import * as vscode from 'vscode';
import { isIgnoredBy } from '../powers/mcp/gitignore';
import { McpJsonError, readEntries } from '../powers/mcp/mcpJson';
import { findOnPath } from '../powers/mcp/prereqs';
import { Prerequisite, PREREQUISITES } from '../powers/mcp/spec';
import type { ActivePower, PowersService } from '../powers/powersService';
import type { ActiveMcpPower, DoctorEnv } from './checks';

type McpEnv = Pick<DoctorEnv, 'mcpJsonIgnored' | 'prereqs' | 'activeMcp' | 'mcpFolder'>;

async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

/** Estado MCP de la primera carpeta: Powers MCP del lock frente a `.vscode/mcp.json`, prerrequisitos y `.gitignore`. */
export async function collectMcpEnv(powers: PowersService | undefined, folder: vscode.WorkspaceFolder | undefined): Promise<McpEnv> {
  if (!powers || !folder) return { mcpJsonIgnored: 'unknown', prereqs: {}, activeMcp: [], mcpFolder: undefined };
  let active: ActivePower[];
  try {
    active = await powers.active(folder);
  } catch {
    active = [];
  }
  const withMcp = active.filter((a) => a.entry.mcp !== undefined);
  const names = withMcp.flatMap((a) => Object.keys(a.entry.mcp!.servers));
  let present: Record<string, unknown>;
  let fileInvalid = false;
  try {
    present = readEntries(await readText(vscode.Uri.joinPath(folder.uri, '.vscode', 'mcp.json')), names);
  } catch (e) {
    // Archivo inválido: no inventamos deriva; activar / cambiar de modo avisará con MCP_FILE_INVALID.
    if (!(e instanceof McpJsonError)) throw e;
    fileInvalid = true;
    present = {};
  }
  const activeMcp: ActiveMcpPower[] = withMcp.map((a) => ({
    id: a.id,
    displayName: a.power?.presentation.displayName ?? a.id,
    mode: a.entry.mcp!.mode,
    prerequisites: a.power?.mcp?.prerequisites ?? [],
    servers: Object.keys(a.entry.mcp!.servers).map((name) => ({
      name,
      inFile: fileInvalid || name in present,
      approxTools: a.power?.mcp?.approxTools[name] ?? 0,
    })),
  }));
  const prereqs: Partial<Record<Prerequisite, boolean>> = {};
  for (const p of new Set(activeMcp.flatMap((a) => a.prerequisites))) prereqs[p] = await findOnPath(PREREQUISITES[p].executable);
  const gitignore = await readText(vscode.Uri.joinPath(folder.uri, '.gitignore'));
  return { mcpJsonIgnored: gitignore === undefined ? false : isIgnoredBy(gitignore, '.vscode/mcp.json'), prereqs, activeMcp, mcpFolder: folder.name };
}
