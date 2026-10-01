import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CopilotBridge } from '../../src/copilot/bridge';
import type { AgentName } from '../../src/copilot/prompts';
import { getApi, readWs, restoreFixture, ws, wsUri } from './helpers';

class FakeBridge implements CopilotBridge {
  calls: { agent: AgentName; prompt: string }[] = [];
  async openAgent(agent: AgentName, prompt: string): Promise<void> {
    this.calls.push({ agent, prompt });
  }
}

describe('Tareas: CodeLens y comandos', () => {
  beforeEach(restoreFixture);

  it('tasks.md aprobado muestra ▶ Ejecutar tarea en las hojas pendientes (incluida la opcional 3)', async () => {
    await getApi();
    const uri = wsUri('specs/pagos-checkout/tasks.md');
    // executeCodeLensProvider exige que el documento esté abierto (modelo cargado).
    await vscode.workspace.openTextDocument(uri);
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', uri);
    const run = lenses.filter((l) => l.command?.title === '▶ Ejecutar tarea').map((l) => l.command!.arguments![2]);
    assert.deepStrictEqual(run, ['2.1', '2.2', '3']);
  });

  it('runTask marca en curso y abre sdd-implement con la tarea', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.runTask', ws().name, 'pagos-checkout', '2.1');
    const text = await readWs('specs/pagos-checkout/tasks.md');
    assert.match(text, /- \[-\] 2\.1 Validar/);
    assert.match(text, /- \[-\] 2\. Endpoint/);
    assert.strictEqual(fake.calls[0].agent, 'sdd-implement');
    assert.match(fake.calls[0].prompt, /Ejecuta la tarea 2\.1 del spec "pagos-checkout": Validar carrito y montos/);
    assert.match(fake.calls[0].prompt, /Criterios relacionados: 2\.1, 2\.2/);
  });

  it('markTaskDone en 2.1 y 2.2 completa el padre', async () => {
    await vscode.commands.executeCommand('sddStudio.markTaskDone', ws().name, 'pagos-checkout', '2.1');
    await vscode.commands.executeCommand('sddStudio.markTaskDone', ws().name, 'pagos-checkout', '2.2');
    assert.match(await readWs('specs/pagos-checkout/tasks.md'), /- \[x\] 2\. Endpoint/);
  });

  it('approveAndContinue aprueba requisitos y abre sdd-design', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.approveAndContinue', ws().name, 'export-csv', 'requirements');
    assert.match(await readWs('specs/export-csv/requirements.md'), /status: approved/);
    assert.strictEqual(fake.calls[0].agent, 'sdd-design');
  });

  it('openRequirements abre requirements.md en el criterio', async () => {
    await vscode.commands.executeCommand('sddStudio.openRequirements', ws().name, 'pagos-checkout', ['2.2']);
    const editor = vscode.window.activeTextEditor!;
    assert.match(editor.document.uri.path, /pagos-checkout\/requirements\.md$/);
    assert.match(editor.document.lineAt(editor.selection.active.line).text, /^2\. IF el monto/);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  it('avisa de líneas mal formadas en tasks.md', async () => {
    const uri = wsUri('specs/pagos-checkout/tasks.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount - 1, 0), '- [?] 4. rara\n'));
    await new Promise((r) => setTimeout(r, 300));
    const diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Warning);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });
});
