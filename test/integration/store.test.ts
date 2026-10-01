import * as assert from 'assert';
import * as vscode from 'vscode';
import { SpecError } from '../../src/specs/errors';
import { getApi, restoreFixture, ws, wsUri } from './helpers';

describe('SpecStore', () => {
  beforeEach(restoreFixture);

  it('lista los specs con tipo, fase y progreso', async () => {
    const { store } = await getApi();
    const specs = await store.list(ws());
    assert.deepStrictEqual(
      specs.map((s) => [s.name, s.type, s.phase, s.progress.done, s.progress.total]),
      [
        ['export-csv', 'feature', 'requirements', 0, 0],
        ['pagos-checkout', 'feature', 'implementation', 1, 3],
      ],
    );
  });

  it('locate reconoce documentos de spec y rechaza otros', async () => {
    const { store } = await getApi();
    assert.deepStrictEqual(
      { ...store.locate(wsUri('specs/pagos-checkout/tasks.md'))!, folder: undefined },
      { folder: undefined, name: 'pagos-checkout', kind: 'tasks' },
    );
    assert.strictEqual(store.locate(wsUri('specs/pagos-checkout/notas.md')), undefined);
    assert.strictEqual(store.locate(wsUri('README.md')), undefined);
  });

  it('lista el steering con su applyTo', async () => {
    const { store } = await getApi();
    const steering = await store.listSteering(ws());
    assert.deepStrictEqual(steering.map((s) => [s.label, s.applyTo]), [['product', '**']]);
  });

  it('readText prefiere el buffer con cambios sin guardar', async () => {
    const { store } = await getApi();
    const uri = wsUri('specs/export-csv/requirements.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount, 0), 'EXTRA\n'));
    assert.ok((await store.readText(uri))!.includes('EXTRA'));
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });

  it('dirUri rechaza nombres que escapan de specs/', async () => {
    const { store } = await getApi();
    assert.throws(() => store.dirUri(ws(), '../x'), (e: unknown) => (e as SpecError).name === 'SpecError' && (e as SpecError).code === 'INVALID_NAME');
  });
});
