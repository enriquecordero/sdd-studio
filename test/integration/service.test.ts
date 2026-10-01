import * as assert from 'assert';
import * as vscode from 'vscode';
import { getApi, readWs, restoreFixture, wsUri } from './helpers';

describe('SpecService + herramientas', () => {
  beforeEach(restoreFixture);

  it('writeSpecDoc crea un documento en borrador con un único front matter', async () => {
    const { tools } = await getApi();
    const msg = await tools.writeSpecDoc({
      spec: 'login-sso',
      doc: 'requirements',
      content: '```markdown\n---\nstatus: approved\n---\n# Requisitos — login-sso\n```',
    });
    assert.match(msg, /specs\/login-sso\/requirements\.md/);
    assert.strictEqual(await readWs('specs/login-sso/requirements.md'), '---\nstatus: draft\n---\n# Requisitos — login-sso\n');
  });

  it('reescribir requisitos aprobados devuelve a borrador diseño y tareas', async () => {
    const { tools } = await getApi();
    const msg = await tools.writeSpecDoc({ spec: 'pagos-checkout', doc: 'requirements', content: '# Nuevo\n' });
    assert.match(msg, /design\.md, tasks\.md/);
    assert.match(await readWs('specs/pagos-checkout/design.md'), /status: draft/);
    assert.doesNotMatch(await readWs('specs/pagos-checkout/design.md'), /approvedAt/);
    assert.match(await readWs('specs/pagos-checkout/tasks.md'), /status: draft/);
  });

  it('approvePhase aprueba y respeta el orden', async () => {
    const { tools } = await getApi();
    assert.match(await tools.approvePhase({ spec: 'export-csv', doc: 'design' }), /^ERROR \(DOC_MISSING\)/);
    assert.match(await tools.approvePhase({ spec: 'export-csv', doc: 'requirements' }), /Aprobado/);
    assert.match(await readWs('specs/export-csv/requirements.md'), /status: approved\napprovedAt: \d{4}-/);
  });

  it('setTaskStatus cambia la tarea y su padre', async () => {
    const { tools } = await getApi();
    await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '2.1', status: 'done' });
    await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '2.2', status: 'done' });
    const text = await readWs('specs/pagos-checkout/tasks.md');
    assert.match(text, /- \[x\] 2\. Endpoint/);
    assert.match(text, /- \[x\] 2\.1 Validar/);
  });

  it('setTaskStatus falla si las tareas no están aprobadas o la tarea no existe', async () => {
    const { tools } = await getApi();
    assert.match(await tools.setTaskStatus({ spec: 'export-csv', taskId: '1', status: 'done' }), /^ERROR \(NOT_READY\)/);
    assert.match(await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '9', status: 'done' }), /^ERROR \(TASK_NOT_FOUND\)/);
  });

  it('valida entradas', async () => {
    const { tools } = await getApi();
    assert.match(await tools.writeSpecDoc({ spec: 'Mal Nombre', doc: 'design', content: 'x' }), /^ERROR \(INVALID_NAME\)/);
    assert.match(await tools.writeSpecDoc({ spec: 'ok', doc: 'notas', content: 'x' }), /^ERROR \(INVALID_INPUT\)/);
    assert.match(await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '1', status: 'hecho' }), /^ERROR \(INVALID_INPUT\)/);
    assert.match(await tools.writeSpecDoc({ spec: 'export-csv', doc: 'bugfix', content: 'x' }), /^ERROR \(TYPE_MISMATCH\)/);
  });

  it('respeta un buffer sucio: edita el buffer, no guarda, no pierde lo escrito', async () => {
    const { tools } = await getApi();
    const uri = wsUri('specs/pagos-checkout/tasks.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount - 1, 0), '<!-- nota del usuario -->\n'));
    const onDisk = await readWs('specs/pagos-checkout/tasks.md');

    await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '2.1', status: 'in_progress' });

    assert.strictEqual(doc.isDirty, true);
    assert.match(doc.getText(), /<!-- nota del usuario -->/);
    assert.match(doc.getText(), /- \[-\] 2\.1 Validar/);
    assert.strictEqual(await readWs('specs/pagos-checkout/tasks.md'), onDisk);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });
});
