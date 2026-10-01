import * as assert from 'assert';
import * as vscode from 'vscode';
import { catalog, power } from '../support/powerFixtures';
import { getApi, readWs, restoreFixture } from './helpers';

const FUTURE = '2999-01-01T00:00:00.000Z';

function label(item: vscode.TreeItem): string {
  return typeof item.label === 'string' ? item.label : item.label!.label;
}

async function powersSection() {
  const { specsTree } = await getApi();
  const roots = await specsTree.getChildren();
  const section = roots[roots.length - 1];
  return (await specsTree.getChildren(section)).map((n) => ({ node: n, item: specsTree.getTreeItem(n) }));
}

describe('Powers: galería, comandos y panel', () => {
  beforeEach(async () => {
    await restoreFixture();
    const { powers } = await getApi();
    powers.setFetcher(async () => JSON.stringify(catalog([power('alpha'), power('beta')], FUTURE)));
    await powers.refreshOnline();
  });
  afterEach(async () => {
    const { powers } = await getApi();
    await powers.resetCatalog();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('openPowers abre la galería con las tarjetas', async () => {
    const { gallery } = await getApi();
    await vscode.commands.executeCommand('sddStudio.openPowers');
    assert.strictEqual(gallery.isOpen, true);
    assert.match(gallery.html!, /data-id="alpha"/);
    assert.match(gallery.html!, /\+ Activar en este repo/);
  });

  it('activar desde la galería escribe el skill y re-renderiza', async () => {
    const { gallery } = await getApi();
    await vscode.commands.executeCommand('sddStudio.openPowers');
    await gallery.handleMessage({ type: 'activate', id: 'alpha' });
    assert.match(await readWs('.github/skills/alpha/SKILL.md'), /name: alpha/);
    await gallery.render();
    assert.match(gallery.html!, /✓ Activo · v1\.0\.0/);
  });

  it('la sección Powers del panel lista acciones y Powers activos', async () => {
    await vscode.commands.executeCommand('sddStudio.activatePower', 'alpha');
    const items = await powersSection();
    assert.deepStrictEqual(items.map((i) => label(i.item)), ['Abrir galería…', 'Buscar actualizaciones', '🧪 alpha']);
    assert.strictEqual(items[2].item.description, 'v1.0.0');
    assert.strictEqual(items[2].item.contextValue, 'power-active');
  });

  it('marca actualización disponible y desactiva desde el nodo del panel', async () => {
    const { powers } = await getApi();
    await vscode.commands.executeCommand('sddStudio.activatePower', 'alpha');
    powers.setFetcher(async () =>
      JSON.stringify(catalog([power('alpha', { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\nv2\n' }, '1.1.0')], '2999-06-01T00:00:00.000Z')),
    );
    await powers.refreshOnline();
    let items = await powersSection();
    assert.strictEqual(items[2].item.description, 'v1.0.0 · actualización disponible');
    assert.strictEqual(items[2].item.contextValue, 'power-update');
    await vscode.commands.executeCommand('sddStudio.updatePower', items[2].node);
    items = await powersSection();
    assert.strictEqual(items[2].item.description, 'v1.1.0');
    await vscode.commands.executeCommand('sddStudio.deactivatePower', items[2].node);
    assert.strictEqual((await powersSection()).length, 2);
    assert.deepStrictEqual(JSON.parse(await readWs('.github/powers.lock.json')).powers, {});
  });

  it('activar un id inexistente no rompe nada', async () => {
    await vscode.commands.executeCommand('sddStudio.activatePower', 'no-existe');
    assert.strictEqual((await powersSection()).length, 2);
  });
});
