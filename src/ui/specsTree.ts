import * as vscode from 'vscode';
import { docFileName } from '../specs/phase';
import { isLeaf, parseTasks, Task, TaskStatus } from '../specs/tasks';
import { SpecDocInfo, SpecSnapshot, SpecStore, SteeringDoc } from '../workspace/specStore';
import { docIcon, docStatusLabel, phaseBar, specDescription } from './labels';

export type SpecsNode =
  | { type: 'folder'; folder: vscode.WorkspaceFolder }
  | { type: 'new'; folder: vscode.WorkspaceFolder }
  | { type: 'spec'; snap: SpecSnapshot }
  | { type: 'doc'; snap: SpecSnapshot; doc: SpecDocInfo }
  | { type: 'task'; snap: SpecSnapshot; task: Task }
  | { type: 'section'; section: 'steering' | 'powers'; folder: vscode.WorkspaceFolder }
  | { type: 'steering'; doc: SteeringDoc }
  | { type: 'info'; label: string; command?: vscode.Command };

const TASK_ICONS: Record<TaskStatus, string> = { todo: 'circle-outline', in_progress: 'circle-filled', done: 'pass-filled' };

/** tasks.md muestra sus tareas ejecutables cuando el spec está en implementación. */
function showsTasks(snap: SpecSnapshot, doc: SpecDocInfo): boolean {
  return doc.kind === 'tasks' && doc.exists && snap.phase === 'implementation';
}

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecsNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<SpecsNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly store: SpecStore) {
    this.subscription = store.onDidChange(() => this.emitter.fire(undefined));
  }

  async getChildren(node?: SpecsNode): Promise<SpecsNode[]> {
    if (!node) {
      const folders = this.store.folders();
      if (folders.length === 0) return [{ type: 'info', label: 'Abre una carpeta para usar SDD Studio' }];
      if (folders.length > 1) return folders.map((folder): SpecsNode => ({ type: 'folder', folder }));
      return this.folderChildren(folders[0]);
    }
    switch (node.type) {
      case 'folder':
        return this.folderChildren(node.folder);
      case 'spec':
        return node.snap.docs.map((doc): SpecsNode => ({ type: 'doc', snap: node.snap, doc }));
      case 'doc':
        return showsTasks(node.snap, node.doc) ? this.taskChildren(node.snap, node.doc) : [];
      case 'section':
        return this.sectionChildren(node.section, node.folder);
      default:
        return [];
    }
  }

  getTreeItem(node: SpecsNode): vscode.TreeItem {
    switch (node.type) {
      case 'folder': {
        const item = new vscode.TreeItem(node.folder.name, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon('root-folder');
        return item;
      }
      case 'new': {
        const item = new vscode.TreeItem('Nuevo spec');
        item.iconPath = new vscode.ThemeIcon('add');
        item.command = { command: 'sddStudio.newSpec', title: 'Nuevo spec', arguments: [{ folder: node.folder.name }] };
        return item;
      }
      case 'spec': {
        const item = new vscode.TreeItem(node.snap.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = specDescription(node.snap.phase, node.snap.progress);
        item.tooltip = phaseBar(node.snap.type, node.snap.states);
        item.iconPath = new vscode.ThemeIcon(node.snap.type === 'bugfix' ? 'bug' : 'symbol-event');
        item.contextValue = 'spec';
        return item;
      }
      case 'doc': {
        const isCurrent = node.snap.phase === node.doc.kind;
        const item = new vscode.TreeItem(
          docFileName(node.doc.kind),
          showsTasks(node.snap, node.doc) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
        );
        item.description = docStatusLabel(node.doc, isCurrent);
        item.iconPath = new vscode.ThemeIcon(docIcon(node.doc, isCurrent));
        item.contextValue = node.doc.exists && node.doc.status === 'draft' && isCurrent ? 'doc-approvable' : 'doc';
        if (node.doc.exists) item.command = { command: 'vscode.open', title: 'Abrir', arguments: [node.doc.uri] };
        return item;
      }
      case 'task': {
        const item = new vscode.TreeItem(`${node.task.id} ${node.task.title}`);
        item.iconPath = new vscode.ThemeIcon(TASK_ICONS[node.task.status]);
        item.contextValue = `task-${node.task.status}`;
        return item;
      }
      case 'section': {
        const item = new vscode.TreeItem(
          node.section === 'steering' ? 'Steering' : 'Powers',
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon(node.section === 'steering' ? 'book' : 'zap');
        item.contextValue = `section-${node.section}`;
        return item;
      }
      case 'steering': {
        const item = new vscode.TreeItem(node.doc.label);
        item.description = node.doc.applyTo ?? 'manual';
        item.iconPath = new vscode.ThemeIcon('note');
        item.command = { command: 'vscode.open', title: 'Abrir', arguments: [node.doc.uri] };
        return item;
      }
      case 'info': {
        const item = new vscode.TreeItem(node.label);
        item.command = node.command;
        return item;
      }
    }
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }

  private async folderChildren(folder: vscode.WorkspaceFolder): Promise<SpecsNode[]> {
    const specs = await this.store.list(folder);
    return [
      { type: 'new', folder },
      ...specs.map((snap): SpecsNode => ({ type: 'spec', snap })),
      { type: 'section', section: 'steering', folder },
      { type: 'section', section: 'powers', folder },
    ];
  }

  private async taskChildren(snap: SpecSnapshot, doc: SpecDocInfo): Promise<SpecsNode[]> {
    const { tasks } = parseTasks((await this.store.readText(doc.uri)) ?? '');
    return tasks.filter((task) => isLeaf(task, tasks)).map((task): SpecsNode => ({ type: 'task', snap, task }));
  }

  private async sectionChildren(section: 'steering' | 'powers', folder: vscode.WorkspaceFolder): Promise<SpecsNode[]> {
    if (section === 'powers') return [{ type: 'info', label: 'Llegan en la próxima versión' }];
    const docs = await this.store.listSteering(folder);
    if (docs.length === 0) {
      return [{ type: 'info', label: 'Generar steering…', command: { command: 'sddStudio.generateSteering', title: 'Generar steering' } }];
    }
    return docs.map((doc): SpecsNode => ({ type: 'steering', doc }));
  }
}
