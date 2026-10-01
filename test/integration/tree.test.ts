import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CopilotBridge } from '../../src/copilot/bridge';
import type { AgentName } from '../../src/copilot/prompts';
import { getApi, restoreFixture } from './helpers';

class FakeBridge implements CopilotBridge {
  calls: { agent: AgentName; prompt: string }[] = [];
  async openAgent(agent: AgentName, prompt: string): Promise<void> {
    this.calls.push({ agent, prompt });
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

  it('newSpec con argumentos abre sdd-requirements con el prompt', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.newSpec', { type: 'feature', name: 'Exportación PDF', description: 'Exportar a PDF' });
    assert.strictEqual(fake.calls.length, 1);
    assert.strictEqual(fake.calls[0].agent, 'sdd-requirements');
    assert.match(fake.calls[0].prompt, /Crea el spec "exportacion-pdf" \(feature\)/);
  });

  it('newSpec rechaza un nombre que ya existe', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.newSpec', { type: 'feature', name: 'export-csv', description: 'x' });
    assert.strictEqual(fake.calls.length, 0);
  });

  it('generateSteering abre sdd-steering', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.generateSteering');
    assert.strictEqual(fake.calls[0].agent, 'sdd-steering');
  });
});
