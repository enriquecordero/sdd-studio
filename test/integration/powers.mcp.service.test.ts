import * as assert from 'assert';
import * as vscode from 'vscode';
import type { McpStdioServer } from '../../src/powers/mcp/spec';
import { catalog, mcpPower, mcpSpec, power } from '../support/powerFixtures';
import { getApi, readWs, restoreFixture, ws, writeWs } from './helpers';

const FUTURE = '2999-01-01T00:00:00.000Z';
const cloudy = mcpPower('cloudy');
const never = async (): Promise<boolean> => {
  throw new Error('no debe pedir confirmación');
};

describe('PowersService y comandos con MCP', () => {
  beforeEach(async () => {
    await restoreFixture();
    const { powers } = await getApi();
    powers.setFetcher(async () => JSON.stringify(catalog([power('alpha'), cloudy], FUTURE)));
    await powers.refreshOnline();
  });
  afterEach(async () => {
    const { powers } = await getApi();
    await powers.resetCatalog();
  });

  it('activar, ver el modo, cambiarlo y desactivar', async () => {
    const { powers } = await getApi();
    assert.strictEqual(powers.policy().state, 'allowed');
    assert.strictEqual(await powers.activate('cloudy', ws(), async () => true), 'activated');
    let view = (await powers.views(ws())).find((v) => v.power.id === 'cloudy')!;
    assert.deepStrictEqual([view.status, view.mode], ['active', 'readOnly']);
    assert.strictEqual(await powers.setMode('cloudy', ws(), 'operate', never), 'changed');
    view = (await powers.views(ws())).find((v) => v.power.id === 'cloudy')!;
    assert.strictEqual(view.mode, 'operate');
    assert.strictEqual((await powers.views(ws())).find((v) => v.power.id === 'alpha')!.mode, undefined);
    assert.strictEqual(await powers.deactivate('cloudy', ws(), never), 'deactivated');
  });

  it('activar cancelado en la confirmación no cambia nada', async () => {
    const { powers } = await getApi();
    assert.strictEqual(await powers.activate('cloudy', ws(), async () => false), 'cancelled');
    assert.deepStrictEqual(await powers.active(ws()), []);
  });

  it('sddStudio.setPowerMode en Solo lectura repara una entrada borrada (acción del diagnóstico)', async () => {
    const { powers } = await getApi();
    await powers.activate('cloudy', ws(), async () => true);
    await writeWs('.vscode/mcp.json', '{ "servers": {} }');
    await vscode.commands.executeCommand('sddStudio.setPowerMode', { id: 'cloudy', mode: 'readOnly' });
    assert.match(await readWs('.vscode/mcp.json'), /"sdd-x"/);
  });

  it('update reenvía confirmMcp al instalador: cancelar deja todo como estaba', async () => {
    const { powers } = await getApi();
    await powers.activate('cloudy', ws(), async () => true);
    const before = await readWs('.vscode/mcp.json');
    const spec = mcpSpec();
    const bumped = (s: McpStdioServer): McpStdioServer => ({ ...s, args: ['x-mcp-server@1.1.0'] });
    const v2spec = mcpSpec({
      servers: { 'sdd-x': bumped(spec.servers['sdd-x'] as McpStdioServer) },
      operate: { ...spec.operate!, servers: { 'sdd-x': bumped(spec.operate!.servers['sdd-x'] as McpStdioServer) } },
    });
    const v2 = mcpPower('cloudy', v2spec, { 'SKILL.md': '---\nname: cloudy\ndescription: d\n---\nUse sdd-x, v2.\n' }, '1.1.0');
    powers.setFetcher(async () => JSON.stringify(catalog([power('alpha'), v2], '2999-06-01T00:00:00.000Z')));
    await powers.refreshOnline();
    const asked: unknown[] = [];
    assert.strictEqual(await powers.update('cloudy', ws(), never, async (mcp) => (asked.push(mcp), false)), 'cancelled');
    assert.deepStrictEqual(asked, [v2spec]);
    assert.strictEqual(await readWs('.vscode/mcp.json'), before);
  });

  it('el comando sddStudio.setPowerMode está registrado', async () => {
    assert.ok((await vscode.commands.getCommands(true)).includes('sddStudio.setPowerMode'));
  });
});
