import * as path from 'path';
import * as vscode from 'vscode';
import { SpecError } from '../specs/errors';
import { DocStatus, frontMatterFields, readFrontMatter } from '../specs/frontMatter';
import { isValidSpecName } from '../specs/names';
import {
  ALL_DOC_KINDS,
  currentPhase,
  DocKind,
  docFileName,
  docOrder,
  DocStates,
  isDocKind,
  Phase,
  specType,
  SpecType,
} from '../specs/phase';
import { parseTasks, progress } from '../specs/tasks';
import { isFileNotFound } from './edits';
import { resolveSpecFolder } from './resolve';

export interface SpecDocInfo {
  kind: DocKind;
  uri: vscode.Uri;
  exists: boolean;
  status: DocStatus;
}

export interface SpecSnapshot {
  folder: vscode.WorkspaceFolder;
  name: string;
  dirUri: vscode.Uri;
  type: SpecType;
  phase: Phase;
  docs: SpecDocInfo[];
  states: DocStates;
  progress: { done: number; total: number };
}

export interface SteeringDoc {
  uri: vscode.Uri;
  label: string;
  applyTo?: string;
}

const STEERING_DIR = ['.github', 'instructions'];
const STEERING_SUFFIX = '.instructions.md';

export class SpecStore implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private watchers: vscode.Disposable[] = [];
  private readonly subscriptions: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.createWatchers();
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.isTracked(e.document.uri)) this.scheduleFire();
      }),
      vscode.workspace.onDidCloseTextDocument((d) => {
        if (this.isTracked(d.uri)) this.scheduleFire();
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.createWatchers();
        this.scheduleFire();
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('sddStudio.specsFolder')) {
          this.createWatchers();
          this.scheduleFire();
        }
      }),
    );
  }

  get specsFolder(): string {
    const value = vscode.workspace.getConfiguration('sddStudio').get<string>('specsFolder', 'specs').replace(/^\/+|\/+$/g, '');
    return value === '' || value.split('/').includes('..') ? 'specs' : value;
  }

  folders(): readonly vscode.WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders ?? [];
  }

  folderByName(name: string): vscode.WorkspaceFolder | undefined {
    return this.folders().find((f) => f.name === name);
  }

  refresh(): void {
    this.emitter.fire();
  }

  dirUri(folder: vscode.WorkspaceFolder, name: string): vscode.Uri {
    if (!isValidSpecName(name)) throw new SpecError('INVALID_NAME', `Nombre de spec no válido: "${name}".`);
    return vscode.Uri.joinPath(folder.uri, ...this.specsFolder.split('/'), name);
  }

  docUri(folder: vscode.WorkspaceFolder, name: string, kind: DocKind): vscode.Uri {
    return vscode.Uri.joinPath(this.dirUri(folder, name), docFileName(kind));
  }

  relPath(name: string, kind: DocKind): string {
    return `${this.specsFolder}/${name}/${docFileName(kind)}`;
  }

  /** Texto actual: el buffer si tiene cambios sin guardar; si no, el disco. */
  async readText(uri: vscode.Uri): Promise<string | undefined> {
    const dirty = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString() && d.isDirty);
    if (dirty) return dirty.getText();
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch (e) {
      if (isFileNotFound(e)) return undefined;
      throw e;
    }
  }

  async snapshot(folder: vscode.WorkspaceFolder, name: string): Promise<SpecSnapshot> {
    const states: DocStates = {};
    let tasksText: string | undefined;
    for (const kind of ALL_DOC_KINDS) {
      const text = await this.readText(this.docUri(folder, name, kind));
      states[kind] = { exists: text !== undefined, status: text === undefined ? 'draft' : readFrontMatter(text).status };
      if (kind === 'tasks') tasksText = text;
    }
    const type = specType(states);
    return {
      folder,
      name,
      dirUri: this.dirUri(folder, name),
      type,
      phase: currentPhase(states),
      docs: docOrder(type).map((kind) => ({
        kind,
        uri: this.docUri(folder, name, kind),
        exists: states[kind]!.exists,
        status: states[kind]!.status,
      })),
      states,
      progress: tasksText === undefined ? { done: 0, total: 0 } : progress(parseTasks(tasksText).tasks),
    };
  }

  async specExists(folder: vscode.WorkspaceFolder, name: string): Promise<boolean> {
    const snap = await this.snapshot(folder, name);
    return ALL_DOC_KINDS.some((k) => snap.states[k]?.exists);
  }

  async list(folder: vscode.WorkspaceFolder): Promise<SpecSnapshot[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(folder.uri, ...this.specsFolder.split('/')));
    } catch {
      return [];
    }
    const names = entries
      .filter(([n, t]) => t === vscode.FileType.Directory && isValidSpecName(n))
      .map(([n]) => n)
      .sort();
    const snaps = await Promise.all(names.map((n) => this.snapshot(folder, n)));
    return snaps.filter((s) => ALL_DOC_KINDS.some((k) => s.states[k]?.exists));
  }

  async resolveFolder(spec: string, requested: string | undefined, mustExist: boolean): Promise<vscode.WorkspaceFolder> {
    const folders = this.folders();
    const candidates = await Promise.all(folders.map(async (f) => ({ name: f.name, hasSpec: await this.specExists(f, spec) })));
    const result = resolveSpecFolder(candidates, spec, requested, mustExist);
    if (!result.ok) throw new SpecError('FOLDER', result.message);
    return folders.find((f) => f.name === result.folder)!;
  }

  locate(uri: vscode.Uri): { folder: vscode.WorkspaceFolder; name: string; kind: DocKind } | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return undefined;
    const rel = path.posix.relative(folder.uri.path, uri.path);
    const prefix = `${this.specsFolder}/`;
    if (!rel.startsWith(prefix)) return undefined;
    const parts = rel.slice(prefix.length).split('/');
    if (parts.length !== 2 || !parts[1].endsWith('.md')) return undefined;
    const kind = parts[1].slice(0, -'.md'.length);
    if (!isValidSpecName(parts[0]) || !isDocKind(kind)) return undefined;
    return { folder, name: parts[0], kind };
  }

  async listSteering(folder: vscode.WorkspaceFolder): Promise<SteeringDoc[]> {
    const dir = vscode.Uri.joinPath(folder.uri, ...STEERING_DIR);
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
      return [];
    }
    const files = entries.filter(([n, t]) => t === vscode.FileType.File && n.endsWith(STEERING_SUFFIX)).map(([n]) => n).sort();
    return Promise.all(
      files.map(async (file) => {
        const uri = vscode.Uri.joinPath(dir, file);
        const applyTo = frontMatterFields((await this.readText(uri)) ?? '').get('applyTo')?.replace(/^["']|["']$/g, '');
        return { uri, label: file.slice(0, -STEERING_SUFFIX.length), applyTo };
      }),
    );
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.watchers.forEach((w) => w.dispose());
    this.subscriptions.forEach((s) => s.dispose());
    this.emitter.dispose();
  }

  private isTracked(uri: vscode.Uri): boolean {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return false;
    const rel = path.posix.relative(folder.uri.path, uri.path);
    return rel.startsWith(`${this.specsFolder}/`) || rel.startsWith(`${STEERING_DIR.join('/')}/`);
  }

  private scheduleFire(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.emitter.fire(), 150);
  }

  private createWatchers(): void {
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [`**/${this.specsFolder}/**`, `**/${STEERING_DIR.join('/')}/*.md`].map((pattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(() => this.scheduleFire());
      watcher.onDidChange(() => this.scheduleFire());
      watcher.onDidDelete(() => this.scheduleFire());
      return watcher;
    });
  }
}
