import * as vscode from 'vscode';
import { docFileName } from '../specs/phase';
import { SpecDocInfo, SpecSnapshot, SpecStore, SteeringDoc } from '../workspace/specStore';
import { docIcon, docStatusLabel, phaseBar, specDescription } from './labels';

export type SpecsNode =
  | { type: 'folder'; folder: vscode.WorkspaceFolder }
  | { type: 'new'; folder: vscode.WorkspaceFolder }
  | { type: 'spec'; snap: SpecSnapshot }
  | { type: 'doc'; snap: SpecSnapshot; doc: SpecDocInfo }
  | { type: 'section'; section: 'steering' | 'powers'; folder: vscode.WorkspaceFolder }
  | { type: 'steering'; doc: SteeringDoc }
  | { type: 'info'; label: string; command?: vscode.Command };

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
        const item = new vscode.TreeItem(docFileName(node.doc.kind));
        item.description = docStatusLabel(node.doc, isCurrent);
        item.iconPath = new vscode.ThemeIcon(docIcon(node.doc, isCurrent));
        item.contextValue = 'doc';
        if (node.doc.exists) item.command = { command: 'vscode.open', title: 'Abrir', arguments: [node.doc.uri] };
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

  private async sectionChildren(section: 'steering' | 'powers', folder: vscode.WorkspaceFolder): Promise<SpecsNode[]> {
    if (section === 'powers') return [{ type: 'info', label: 'Llegan en la próxima versión' }];
    const docs = await this.store.listSteering(folder);
    if (docs.length === 0) {
      return [{ type: 'info', label: 'Generar steering…', command: { command: 'sddStudio.generateSteering', title: 'Generar steering' } }];
    }
    return docs.map((doc): SpecsNode => ({ type: 'steering', doc }));
  }
}
