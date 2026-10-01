import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { SpecStore } from '../workspace/specStore';
import { PowerError } from './installer';
import { PowersService, PowerView } from './powersService';
import { renderGalleryDocument } from './render/webview';
import { sourceUrl } from './types';

const ACTIONS = {
  activate: 'sddStudio.activatePower',
  update: 'sddStudio.updatePower',
  deactivate: 'sddStudio.deactivatePower',
} as const;

export class GalleryController implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private lastHtml: string | undefined;
  private readonly subscription: vscode.Disposable;

  constructor(
    private readonly powers: PowersService,
    private readonly store: SpecStore,
    private readonly isStrict: () => boolean,
  ) {
    this.subscription = powers.onDidChange(() => void this.render());
  }

  get isOpen(): boolean {
    return this.panel !== undefined;
  }

  get html(): string | undefined {
    return this.lastHtml;
  }

  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      await this.render();
      return;
    }
    this.panel = vscode.window.createWebviewPanel('sddStudio.powers', '⚡ Powers', vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [],
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.lastHtml = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message));
    await this.render();
  }

  async render(): Promise<void> {
    if (!this.panel) return;
    const folder = this.store.folders()[0];
    const asAvailable = async (): Promise<PowerView[]> =>
      (await this.powers.catalog()).powers.map((power) => ({ power, status: 'available' as const }));
    let views: PowerView[];
    let error: string | undefined;
    try {
      views = folder ? await this.powers.views(folder) : await asAvailable();
    } catch (e) {
      if (!(e instanceof PowerError)) throw e;
      error = e.message;
      views = await asAvailable();
    }
    this.lastHtml = renderGalleryDocument({
      views,
      strict: this.isStrict(),
      hasFolder: folder !== undefined && error === undefined,
      error,
      nonce: randomBytes(16).toString('hex'),
      cspSource: this.panel.webview.cspSource,
    });
    this.panel.webview.html = this.lastHtml;
  }

  async handleMessage(message: unknown): Promise<void> {
    if (typeof message !== 'object' || message === null) return;
    const { type, id } = message as { type?: unknown; id?: unknown };
    if (typeof id !== 'string') return;
    if (type === 'openSource') {
      const power = await this.powers.find(id).catch(() => undefined);
      if (power) await vscode.env.openExternal(vscode.Uri.parse(sourceUrl(power.presentation.source)));
      return;
    }
    if (type === 'activate' || type === 'update' || type === 'deactivate') {
      await vscode.commands.executeCommand(ACTIONS[type], id);
    }
  }

  dispose(): void {
    this.subscription.dispose();
    this.panel?.dispose();
  }
}
