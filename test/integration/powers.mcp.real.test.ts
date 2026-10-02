import * as assert from 'assert';
import * as vscode from 'vscode';
import { PowerInstaller } from '../../src/powers/installer';
import { getApi, readWs, restoreFixture, ws } from './helpers';

const yes = async () => true;
const never = async (): Promise<boolean> => {
  throw new Error('no debe pedir confirmación');
};
const mcpJson = async () => JSON.parse(await readWs('.vscode/mcp.json'));
const lock = async () => JSON.parse(await readWs('.github/powers.lock.json'));

describe('Powers MCP del catálogo incluido (spec §9.3)', () => {
  beforeEach(restoreFixture);
  afterEach(async () => {
    const { powers } = await getApi();
    await powers.resetCatalog();
  });

  it('activar microsoft-learn escribe sdd-mslearn en .vscode/mcp.json y el lock v2', async () => {
    const { powers } = await getApi();
    assert.strictEqual(await powers.activate('microsoft-learn', ws(), yes), 'activated');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-mslearn'], { type: 'http', url: 'https://learn.microsoft.com/api/mcp' });
    const l = await lock();
    assert.strictEqual(l.schemaVersion, 2);
    assert.strictEqual(l.powers['microsoft-learn'].mcp.mode, 'readOnly');
    assert.match(await readWs('.github/skills/microsoft-learn/SKILL.md'), /sdd-mslearn/);
  });

  it('aws: a Operar y de vuelta a Solo lectura; inputs de perfil y región', async () => {
    const { powers } = await getApi();
    await powers.activate('aws', ws(), yes);
    let file = await mcpJson();
    assert.strictEqual(file.servers['sdd-aws'].env.READ_OPERATIONS_ONLY, 'true');
    assert.deepStrictEqual(file.inputs.map((i: { id: string }) => i.id), ['sdd_aws_profile', 'sdd_aws_region']);
    await powers.setMode('aws', ws(), 'operate', never);
    file = await mcpJson();
    assert.strictEqual(file.servers['sdd-aws'].env.READ_OPERATIONS_ONLY, undefined);
    assert.strictEqual(file.servers['sdd-aws'].env.REQUIRE_MUTATION_CONSENT, 'true');
    assert.strictEqual((await lock()).powers.aws.mcp.mode, 'operate');
    await powers.setMode('aws', ws(), 'readOnly', never);
    assert.strictEqual((await mcpJson()).servers['sdd-aws'].env.READ_OPERATIONS_ONLY, 'true');
  });

  it('desactivar deja el repo como estaba', async () => {
    const { powers } = await getApi();
    await powers.activate('microsoft-learn', ws(), yes);
    await powers.activate('aws', ws(), yes);
    await powers.deactivate('aws', ws(), never);
    await powers.deactivate('microsoft-learn', ws(), never);
    await assert.rejects(readWs('.vscode/mcp.json'));
    assert.deepStrictEqual(await lock(), { schemaVersion: 1, powers: {} });
  });

  it('con chat.mcp.access = none (política inyectada), activar devuelve MCP_BLOCKED y no escribe nada', async () => {
    const { powers } = await getApi();
    const blocked = new PowerInstaller(() => ({ access: 'none', strictPluginOnly: false }));
    await assert.rejects(blocked.activate(ws(), await powers.find('microsoft-learn'), undefined, never), (e: { code?: string }) => e.code === 'MCP_BLOCKED');
    await assert.rejects(readWs('.vscode/mcp.json'));
    await assert.rejects(readWs('.github/skills/microsoft-learn/SKILL.md'));
  });

  it('con el ajuste real chat.mcp.access = none, activar por PowersService devuelve MCP_BLOCKED y no escribe nada', async function () {
    const { powers } = await getApi();
    const config = vscode.workspace.getConfiguration('chat');
    try {
      try {
        await config.update('mcp.access', 'none', vscode.ConfigurationTarget.Global);
      } catch {
        this.skip();
      }
      await assert.rejects(powers.activate('microsoft-learn', ws(), never), (e: { code?: string }) => e.code === 'MCP_BLOCKED');
      await assert.rejects(readWs('.vscode/mcp.json'));
      await assert.rejects(readWs('.github/skills/microsoft-learn/SKILL.md'));
    } finally {
      await config.update('mcp.access', undefined, vscode.ConfigurationTarget.Global);
    }
  });
});
