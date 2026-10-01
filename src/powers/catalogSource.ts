import * as vscode from 'vscode';
import { newestCatalog, validateCatalog } from './catalog';
import { CATALOG_URL, CatalogFetcher, FETCH_TIMEOUT_MS } from './fetcher';
import { Catalog, EMPTY_CATALOG } from './types';

export type RefreshResult =
  | { kind: 'updated'; powers: number }
  | { kind: 'current' }
  | { kind: 'invalid'; errors: string[] }
  | { kind: 'error'; message: string };

const decoder = new TextDecoder();

export class CatalogSource {
  constructor(
    private readonly bundledUri: vscode.Uri,
    private readonly storageUri: vscode.Uri,
  ) {}

  private get cachedUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.storageUri, 'catalog.json');
  }

  async load(): Promise<Catalog> {
    const [bundled, cached] = await Promise.all([this.read(this.bundledUri), this.read(this.cachedUri)]);
    return newestCatalog(bundled, cached) ?? EMPTY_CATALOG;
  }

  async refreshOnline(fetcher: CatalogFetcher): Promise<RefreshResult> {
    let text: string;
    try {
      text = await fetcher(CATALOG_URL, FETCH_TIMEOUT_MS);
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { kind: 'invalid', errors: ['La respuesta no es JSON válido.'] };
    }
    const result = validateCatalog(json);
    if (!result.ok) return { kind: 'invalid', errors: result.errors };
    const current = await this.load();
    if (newestCatalog(current, result.value) !== result.value) return { kind: 'current' };
    await vscode.workspace.fs.createDirectory(this.storageUri);
    await vscode.workspace.fs.writeFile(this.cachedUri, new TextEncoder().encode(text));
    return { kind: 'updated', powers: result.value.powers.length };
  }

  async clearCache(): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.cachedUri);
    } catch {
      // no había caché
    }
  }

  private async read(uri: vscode.Uri): Promise<Catalog | undefined> {
    try {
      const result = validateCatalog(JSON.parse(decoder.decode(await vscode.workspace.fs.readFile(uri))));
      return result.ok ? result.value : undefined;
    } catch {
      return undefined;
    }
  }
}
