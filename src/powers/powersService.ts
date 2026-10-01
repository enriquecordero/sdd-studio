import * as vscode from 'vscode';
import { CatalogSource, RefreshResult } from './catalogSource';
import { CatalogFetcher, httpFetcher } from './fetcher';
import { PowerError, PowerInstaller } from './installer';
import { LockEntry, PowerStatus, powerStatus } from './lock';
import { Catalog, CatalogPower } from './types';

export interface PowerView {
  power: CatalogPower;
  status: PowerStatus;
  installedVersion?: string;
}

export interface ActivePower {
  id: string;
  entry: LockEntry;
  power?: CatalogPower;
  status: PowerStatus;
}

export class PowersService implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private cached: Catalog | undefined;
  private fetcher: CatalogFetcher = httpFetcher;
  private readonly watcher: vscode.FileSystemWatcher;

  constructor(
    readonly source: CatalogSource,
    readonly installer: PowerInstaller,
  ) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/.github/powers.lock.json');
    const fire = () => this.emitter.fire();
    this.watcher.onDidCreate(fire);
    this.watcher.onDidChange(fire);
    this.watcher.onDidDelete(fire);
  }

  setFetcher(fetcher: CatalogFetcher): void {
    this.fetcher = fetcher;
  }

  async catalog(): Promise<Catalog> {
    this.cached ??= await this.source.load();
    return this.cached;
  }

  async find(id: string): Promise<CatalogPower> {
    const power = (await this.catalog()).powers.find((p) => p.id === id);
    if (!power) throw new PowerError('NOT_FOUND', `No existe el Power "${id}" en el catálogo.`);
    return power;
  }

  async views(folder: vscode.WorkspaceFolder): Promise<PowerView[]> {
    const [catalog, lock] = await Promise.all([this.catalog(), this.installer.readLock(folder)]);
    return catalog.powers.map((power) => {
      const entry = lock.powers[power.id];
      return { power, status: powerStatus(power, entry), installedVersion: entry?.version };
    });
  }

  async active(folder: vscode.WorkspaceFolder): Promise<ActivePower[]> {
    const [catalog, lock] = await Promise.all([this.catalog(), this.installer.readLock(folder)]);
    return Object.keys(lock.powers)
      .sort()
      .map((id) => {
        const entry = lock.powers[id];
        const power = catalog.powers.find((p) => p.id === id);
        return { id, entry, power, status: power ? powerStatus(power, entry) : 'active' };
      });
  }

  async activate(id: string, folder: vscode.WorkspaceFolder): Promise<void> {
    await this.installer.activate(folder, await this.find(id));
    this.emitter.fire();
  }

  async update(id: string, folder: vscode.WorkspaceFolder, confirm: () => Promise<boolean>): Promise<'updated' | 'cancelled'> {
    const result = await this.installer.update(folder, await this.find(id), confirm);
    if (result === 'updated') this.emitter.fire();
    return result;
  }

  async deactivate(id: string, folder: vscode.WorkspaceFolder, confirmDiscard: () => Promise<boolean>): Promise<'deactivated' | 'cancelled'> {
    const result = await this.installer.deactivate(folder, id, confirmDiscard);
    if (result === 'deactivated') this.emitter.fire();
    return result;
  }

  async refreshOnline(): Promise<RefreshResult> {
    const result = await this.source.refreshOnline(this.fetcher);
    if (result.kind === 'updated') {
      this.cached = undefined;
      this.emitter.fire();
    }
    return result;
  }

  async resetCatalog(): Promise<void> {
    await this.source.clearCache();
    this.cached = undefined;
    this.emitter.fire();
  }

  dispose(): void {
    this.watcher.dispose();
    this.emitter.dispose();
  }
}
