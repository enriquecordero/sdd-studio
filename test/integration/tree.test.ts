import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CopilotBridge } from '../../src/copilot/bridge';
import type { AgentName } from '../../src/copilot/prompts';
import { getApi, readWs, restoreFixture } from './helpers';

class FakeBridge implements CopilotBridge {
  calls: { agent: AgentName; prompt: string; partial?: boolean }[] = [];
  async openAgent(agent: AgentName, prompt: string, options?: { partial?: boolean }): Promise<void> {
    this.calls.push({ agent, prompt, partial: options?.partial });
  }
}

function label(item: vscode.TreeItem): string {
  return typeof item.label === 'string' ? item.label : item.label!.label;
}

describe('Panel Specs y comandos de spec', () => {
  beforeEach(restoreFixture);

  it('muestra Nuevo spec, los specs, Steering y Powers', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const items = roots.map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(items.map(label), ['Nuevo spec', 'export-csv', 'pagos-checkout', 'Steering', 'Powers']);
    assert.strictEqual(items[2].description, '1/3 tareas');
    assert.strictEqual(items[1].description, 'Requisitos');
  });

  it('los hijos de un spec son sus documentos con estado', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const docs = (await specsTree.getChildren(roots[1])).map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(docs.map((d) => [label(d), d.description]), [
      ['requirements.md', 'borrador · actual'],
      ['design.md', 'falta'],
      ['tasks.md', 'falta'],
    ]);
  });

  it('el requirements.md en borrador de la fase actual se puede aprobar desde el panel', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const exportDocs = (await specsTree.getChildren(roots[1])).map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(exportDocs.map((d) => d.contextValue), ['doc-approvable', 'doc', 'doc']);
    const pagosDocs = (await specsTree.getChildren(roots[2])).map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(pagosDocs.map((d) => d.contextValue), ['doc', 'doc', 'doc']);
  });

  it('tasks.md en implementación lista todas las tareas ejecutables con su estado', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const docs = await specsTree.getChildren(roots[2]);
    const tasksItem = specsTree.getTreeItem(docs[2]);
    assert.strictEqual(tasksItem.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    const tasks = (await specsTree.getChildren(docs[2])).map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(
      tasks.map((t) => [label(t), t.contextValue, (t.iconPath as vscode.ThemeIcon).id]),
      [
        ['1 Modelo PaymentIntent y repositorio', 'task-done', 'pass-filled'],
        ['2.1 Validar carrito y montos', 'task-todo', 'circle-outline'],
        ['2.2 Idempotency-Key en reintentos', 'task-todo', 'circle-outline'],
        ['3 Métricas de conversión', 'task-todo', 'circle-outline'],
      ],
    );
    // En otras fases tasks.md no tiene hijos.
    const exportDocs = await specsTree.getChildren(roots[1]);
    assert.strictEqual(specsTree.getTreeItem(exportDocs[2]).collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  it('markTaskDone con el nodo del panel marca la tarea', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const docs = await specsTree.getChildren(roots[2]);
    const tasks = await specsTree.getChildren(docs[2]);
    await vscode.commands.executeCommand('sddStudio.markTaskDone', tasks[1]);
    assert.match(await readWs('specs/pagos-checkout/tasks.md'), /- \[x\] 2\.1 Validar/);
  });

  it('approveAndContinue con el nodo del panel aprueba el documento', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    const roots = await api.specsTree.getChildren();
    const docs = await api.specsTree.getChildren(roots[1]);
    await vscode.commands.executeCommand('sddStudio.approveAndContinue', docs[0]);
    assert.match(await readWs('specs/export-csv/requirements.md'), /status: approved/);
    assert.strictEqual(fake.calls[0].agent, 'sdd-design');
  });

  it('newSpec sin argumentos abre sdd-spec con la caja de chat vacía (sin formularios)', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.newSpec');
    assert.deepStrictEqual(fake.calls, [{ agent: 'sdd-spec', prompt: '', partial: true }]);
  });

  it('newSpec con una descripción la envía a sdd-spec', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.newSpec', { description: 'quiero hacer el juego de snake' });
    assert.deepStrictEqual(fake.calls, [{ agent: 'sdd-spec', prompt: 'quiero hacer el juego de snake', partial: undefined }]);
  });

  it('generateSteering abre sdd-steering', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.generateSteering');
    assert.strictEqual(fake.calls[0].agent, 'sdd-steering');
  });
});
