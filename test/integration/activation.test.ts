import * as assert from 'assert';
import * as vscode from 'vscode';

describe('activación', () => {
  it('la extensión se activa', async () => {
    const ext = vscode.extensions.getExtension('enriqueacordero.sdd-studio');
    assert.ok(ext, 'extensión no encontrada');
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });
});
