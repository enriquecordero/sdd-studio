import * as assert from 'assert';
import { parse, ParseError } from 'jsonc-parser';
import * as vscode from 'vscode';
import { entryHash, McpJsonError } from '../../src/powers/mcp/mcpJson';
import { mcpEditOrFileInvalid, PowerInstaller } from '../../src/powers/installer';
import type { McpStdioServer } from '../../src/powers/mcp/spec';
import { mcpPower, mcpSpec, power } from '../support/powerFixtures';
import { readWs, restoreFixture, ws, wsUri, writeWs } from './helpers';

async function exists(rel: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(wsUri(rel));
    return true;
  } catch {
    return false;
  }
}

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

/** Lee .vscode/mcp.json como JSONC (comentarios y comas finales) para los asserts. */
async function mcpJson(): Promise<{ servers: Record<string, unknown>; inputs?: { id: string }[] }> {
  const errors: ParseError[] = [];
  const value = parse(await readWs('.vscode/mcp.json'), errors, { allowTrailingComma: true });
  assert.deepStrictEqual(errors, []);
  return value;
}

const lock = async () => JSON.parse(await readWs('.github/powers.lock.json'));
const never = async (): Promise<boolean> => {
  throw new Error('no debe pedir confirmación');
};
const yes = async () => true;

const cloudy = mcpPower('cloudy');
const profile = mcpSpec().inputs[0];
const docsy = mcpPower(
  'docsy',
  mcpSpec({
    prerequisites: [],
    inputs: [profile],
    servers: { 'sdd-y': { type: 'stdio', command: 'uvx', args: ['y-mcp@2.0.0'], env: { PROFILE: '${input:sdd_x_profile}' } } },
    approxTools: { 'sdd-y': 1 },
    operate: undefined,
  }),
);
const FOREIGN = '{\n  // mío\n  "servers": {\n    "mine": { "type": "stdio", "command": "my-server" }\n  }\n}\n';

describe('PowerInstaller con MCP', () => {
  const installer = new PowerInstaller(() => ({ access: 'all', strictPluginOnly: false }));
  beforeEach(restoreFixture);

  it('activar escribe skill, .vscode/mcp.json en solo lectura y el lock v2', async () => {
    let asked = 0;
    const r = await installer.activate(ws(), cloudy, new Date('2026-10-01T00:00:00Z'), async (mcp) => (asked++, mcp === cloudy.mcp));
    assert.deepStrictEqual([r, asked], ['activated', 1]);
    assert.match(await readWs('.github/skills/cloudy/SKILL.md'), /sdd-x/);
    const file = await mcpJson();
    assert.deepStrictEqual(file.servers['sdd-x'], cloudy.mcp!.servers['sdd-x']);
    assert.deepStrictEqual(file.inputs!.map((i) => i.id), ['sdd_x_profile', 'sdd_x_region']);
    const l = await lock();
    assert.strictEqual(l.schemaVersion, 2);
    assert.deepStrictEqual(l.powers.cloudy.mcp, {
      mode: 'readOnly',
      servers: { 'sdd-x': entryHash(cloudy.mcp!.servers['sdd-x']) },
      inputs: ['sdd_x_profile', 'sdd_x_region'],
      createdFile: true,
    });
  });

  it('activar conserva comentarios y servidores ajenos (createdFile false)', async () => {
    await writeWs('.vscode/mcp.json', FOREIGN);
    await installer.activate(ws(), cloudy);
    const text = await readWs('.vscode/mcp.json');
    assert.match(text, /\/\/ mío/);
    assert.deepStrictEqual((await mcpJson()).servers.mine, { type: 'stdio', command: 'my-server' });
    assert.strictEqual((await lock()).powers.cloudy.mcp.createdFile, false);
  });

  it('confirmación rechazada: no escribe nada', async () => {
    assert.strictEqual(await installer.activate(ws(), cloudy, new Date(), async () => false), 'cancelled');
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
    assert.strictEqual(await exists('.github/powers.lock.json'), false);
  });

  it('MCP_BLOCKED si la política lo impide, sin escribir nada ni preguntar', async () => {
    const blocked = new PowerInstaller(() => ({ access: 'none', strictPluginOnly: false }));
    assert.strictEqual(await codeOf(blocked.activate(ws(), cloudy, new Date(), never)), 'MCP_BLOCKED');
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
  });

  it('un Power sin MCP se activa aunque la política bloquee MCP', async () => {
    const blocked = new PowerInstaller(() => ({ access: 'none', strictPluginOnly: false }));
    await blocked.activate(ws(), power('alpha'));
    assert.strictEqual((await lock()).schemaVersion, 1);
  });

  it('MCP_FILE_INVALID con .vscode/mcp.json roto: no toca nada e indica el archivo', async () => {
    await writeWs('.vscode/mcp.json', '{ roto');
    let err: { code?: string; fileUri?: vscode.Uri } = {};
    await installer.activate(ws(), cloudy, new Date(), never).catch((e) => (err = e));
    assert.strictEqual(err.code, 'MCP_FILE_INVALID');
    assert.strictEqual(err.fileUri?.path, wsUri('.vscode/mcp.json').path);
    assert.strictEqual(await readWs('.vscode/mcp.json'), '{ roto');
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('MCP_NAME_CONFLICT si ya hay un sdd-x que no es nuestro', async () => {
    const theirs = '{ "servers": { "sdd-x": { "type": "http", "url": "https://otro.dev/mcp" } } }';
    await writeWs('.vscode/mcp.json', theirs);
    assert.strictEqual(await codeOf(installer.activate(ws(), cloudy, new Date(), never)), 'MCP_NAME_CONFLICT');
    assert.strictEqual(await readWs('.vscode/mcp.json'), theirs);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('rollback si falla escribir .vscode/mcp.json: sin skill y el archivo como estaba', async () => {
    class Flaky extends PowerInstaller {
      protected async writeMcpJson(...args: Parameters<PowerInstaller['writeMcpJson']>): Promise<void> {
        if (args[1].includes('sdd-x')) throw new Error('boom');
        return super.writeMcpJson(...args);
      }
    }
    await writeWs('.vscode/mcp.json', FOREIGN);
    await assert.rejects(new Flaky(() => ({ access: 'all', strictPluginOnly: false })).activate(ws(), cloudy), /boom/);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    assert.strictEqual(await readWs('.vscode/mcp.json'), FOREIGN);
    assert.strictEqual(await exists('.github/powers.lock.json'), false);
  });

  it('rollback si falla el lock: .vscode/mcp.json vuelve a no existir', async () => {
    class Flaky extends PowerInstaller {
      protected async writeLock(): Promise<void> {
        throw new Error('boom');
      }
    }
    await assert.rejects(new Flaky(() => ({ access: 'all', strictPluginOnly: false })).activate(ws(), cloudy), /boom/);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('rollback: si falla una limpieza se relanza el error original y se limpia el resto', async () => {
    class Flaky extends PowerInstaller {
      protected async writeLock(): Promise<void> {
        throw new Error('boom-lock');
      }
      protected async writeMcpJson(...args: Parameters<PowerInstaller['writeMcpJson']>): Promise<void> {
        if (args[1] === FOREIGN) throw new Error('boom-restore');
        return super.writeMcpJson(...args);
      }
    }
    await writeWs('.vscode/mcp.json', FOREIGN);
    await assert.rejects(new Flaky(() => ({ access: 'all', strictPluginOnly: false })).activate(ws(), cloudy), /boom-lock/);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('setMode con otra versión del catálogo: UPDATE_REQUIRED sin tocar nada', async () => {
    await installer.activate(ws(), cloudy);
    const files = ['.vscode/mcp.json', '.github/powers.lock.json', '.github/skills/cloudy/SKILL.md'];
    const before = await Promise.all(files.map(readWs));
    const bumped = (s: McpStdioServer): McpStdioServer => ({ ...s, args: ['x-mcp-server@1.1.0'] });
    const spec = mcpSpec();
    const v2 = mcpPower(
      'cloudy',
      mcpSpec({
        servers: { 'sdd-x': bumped(spec.servers['sdd-x'] as McpStdioServer) },
        operate: { ...spec.operate!, servers: { 'sdd-x': bumped(spec.operate!.servers['sdd-x'] as McpStdioServer) } },
      }),
      cloudy.files,
      '1.1.0',
    );
    assert.strictEqual(await codeOf(installer.setMode(ws(), v2, 'operate', never)), 'UPDATE_REQUIRED');
    assert.deepStrictEqual(await Promise.all(files.map(readWs)), before);
  });

  it('setMode: si falla el lock, .vscode/mcp.json vuelve a estar como antes', async () => {
    let fail = false;
    class Flaky extends PowerInstaller {
      protected async writeLock(...args: Parameters<PowerInstaller['writeLock']>): Promise<void> {
        if (fail) throw new Error('boom');
        return super.writeLock(...args);
      }
    }
    const flaky = new Flaky(() => ({ access: 'all', strictPluginOnly: false }));
    await flaky.activate(ws(), cloudy);
    const before = await readWs('.vscode/mcp.json');
    fail = true;
    await assert.rejects(flaky.setMode(ws(), cloudy, 'operate', never), /boom/);
    assert.strictEqual(await readWs('.vscode/mcp.json'), before);
    assert.strictEqual((await lock()).powers.cloudy.mcp.mode, 'readOnly');
  });

  it('setMode: a Operar y de vuelta; el lock guarda el modo y el hash', async () => {
    await installer.activate(ws(), cloudy);
    assert.strictEqual(await installer.setMode(ws(), cloudy, 'operate', never), 'changed');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.operate!.servers['sdd-x']);
    let l = await lock();
    assert.strictEqual(l.powers.cloudy.mcp.mode, 'operate');
    assert.strictEqual(l.powers.cloudy.mcp.servers['sdd-x'], entryHash(cloudy.mcp!.operate!.servers['sdd-x']));
    await installer.setMode(ws(), cloudy, 'readOnly', never);
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.servers['sdd-x']);
    l = await lock();
    assert.strictEqual(l.powers.cloudy.mcp.mode, 'readOnly');
  });

  it('setMode a Operar en un Power sin operate: MCP_NO_OPERATE', async () => {
    await installer.activate(ws(), docsy);
    assert.strictEqual(await codeOf(installer.setMode(ws(), docsy, 'operate', never)), 'MCP_NO_OPERATE');
  });

  it('MCP_EDITED: entrada editada a mano pide confirmar; cancelar no toca nada', async () => {
    await installer.activate(ws(), cloudy);
    const edited = (await readWs('.vscode/mcp.json')).replace('x-mcp-server@1.0.0', 'x-mcp-server@9.9.9');
    await writeWs('.vscode/mcp.json', edited);
    const reasons: string[] = [];
    const r = await installer.setMode(ws(), cloudy, 'operate', async (why) => (reasons.push(why), false));
    assert.deepStrictEqual([r, reasons], ['cancelled', ['MCP_EDITED']]);
    assert.strictEqual(await readWs('.vscode/mcp.json'), edited);
    assert.strictEqual((await lock()).powers.cloudy.mcp.mode, 'readOnly');
    assert.strictEqual(await installer.setMode(ws(), cloudy, 'operate', yes), 'changed');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.operate!.servers['sdd-x']);
  });

  it('update reescribe en el modo actual y repara una entrada borrada sin preguntar', async () => {
    await installer.activate(ws(), cloudy);
    await installer.setMode(ws(), cloudy, 'operate', never);
    await writeWs('.vscode/mcp.json', '{ "servers": {}, "inputs": [] }');
    const v2 = mcpPower('cloudy', cloudy.mcp, cloudy.files, '1.1.0');
    assert.strictEqual(await installer.update(ws(), v2, never), 'updated');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.operate!.servers['sdd-x']);
    assert.strictEqual((await lock()).powers.cloudy.version, '1.1.0');
  });

  it('update con entrada editada y confirm false: cancelled sin tocar nada', async () => {
    await installer.activate(ws(), cloudy);
    const edited = (await readWs('.vscode/mcp.json')).replace('"READ_ONLY": "true"', '"READ_ONLY": "false"');
    await writeWs('.vscode/mcp.json', edited);
    const v2 = mcpPower('cloudy', cloudy.mcp, cloudy.files, '1.1.0');
    assert.strictEqual(await installer.update(ws(), v2, async () => false), 'cancelled');
    assert.strictEqual(await readWs('.vscode/mcp.json'), edited);
    assert.strictEqual((await lock()).powers.cloudy.version, '1.0.0');
  });

  it('update con otra línea de comando stdio pide confirmar el MCP; cancelar no escribe nada', async () => {
    await installer.activate(ws(), cloudy);
    const before = await Promise.all(['.vscode/mcp.json', '.github/powers.lock.json', '.github/skills/cloudy/SKILL.md'].map(readWs));
    const bumped = (s: McpStdioServer): McpStdioServer => ({ ...s, args: ['x-mcp-server@1.1.0'] });
    const spec = mcpSpec();
    const v2spec = mcpSpec({
      servers: { 'sdd-x': bumped(spec.servers['sdd-x'] as McpStdioServer) },
      operate: { ...spec.operate!, servers: { 'sdd-x': bumped(spec.operate!.servers['sdd-x'] as McpStdioServer) } },
    });
    const v2 = mcpPower('cloudy', v2spec, { 'SKILL.md': '---\nname: cloudy\ndescription: d\n---\nUse sdd-x, v2.\n' }, '1.1.0');
    const asked: unknown[] = [];
    const r = await installer.update(ws(), v2, never, new Date(), async (mcp) => (asked.push(mcp), false));
    assert.deepStrictEqual([r, asked], ['cancelled', [v2spec]]);
    const after = await Promise.all(['.vscode/mcp.json', '.github/powers.lock.json', '.github/skills/cloudy/SKILL.md'].map(readWs));
    assert.deepStrictEqual(after, before);
    assert.strictEqual(await installer.update(ws(), v2, never, new Date(), yes), 'updated');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], v2spec.servers['sdd-x']);
  });

  describe('update pide confirmar el MCP si añade servidores o cambia su URL', () => {
    const files = ['.vscode/mcp.json', '.github/powers.lock.json', '.github/skills/gainer/SKILL.md'];
    const snapshot = () => Promise.all(files.map(async (f) => ((await exists(f)) ? readWs(f) : undefined)));
    const http = (url: string) => ({ type: 'http' as const, url });
    const remoteSpec = (servers: Record<string, ReturnType<typeof http>>) =>
      mcpSpec({ prerequisites: [], inputs: [], servers, approxTools: Object.fromEntries(Object.keys(servers).map((n) => [n, 1])), operate: undefined });
    const v2files = { 'SKILL.md': '---\nname: gainer\ndescription: d\n---\nv2\n' };

    async function cancelThenAccept(v2: ReturnType<typeof mcpPower>): Promise<void> {
      const before = await snapshot();
      const asked: unknown[] = [];
      const r = await installer.update(ws(), v2, never, new Date(), async (mcp) => (asked.push(mcp), false));
      assert.deepStrictEqual([r, asked], ['cancelled', [v2.mcp]]);
      assert.deepStrictEqual(await snapshot(), before);
      assert.strictEqual(await installer.update(ws(), v2, never, new Date(), yes), 'updated');
      for (const [n, server] of Object.entries(v2.mcp!.servers)) assert.deepStrictEqual((await mcpJson()).servers[n], server);
    }

    it('un Power que gana MCP (servidor http nuevo)', async () => {
      await installer.activate(ws(), power('gainer'));
      await cancelThenAccept(mcpPower('gainer', remoteSpec({ 'sdd-g': http('https://g.dev/mcp') }), v2files, '1.1.0'));
    });

    it('un servidor http nuevo junto a uno que ya estaba', async () => {
      await installer.activate(ws(), mcpPower('gainer', remoteSpec({ 'sdd-g': http('https://g.dev/mcp') })));
      await cancelThenAccept(
        mcpPower('gainer', remoteSpec({ 'sdd-g': http('https://g.dev/mcp'), 'sdd-h': http('https://h.dev/mcp') }), v2files, '1.1.0'),
      );
    });

    it('un servidor http que cambia de URL', async () => {
      await installer.activate(ws(), mcpPower('gainer', remoteSpec({ 'sdd-g': http('https://g.dev/mcp') })));
      await cancelThenAccept(mcpPower('gainer', remoteSpec({ 'sdd-g': http('https://g2.dev/mcp') }), v2files, '1.1.0'));
    });

    it('un servidor http con la misma URL y otra cabecera no pide confirmar', async () => {
      await installer.activate(ws(), mcpPower('gainer', remoteSpec({ 'sdd-g': http('https://g.dev/mcp') })));
      const v2 = mcpPower(
        'gainer',
        mcpSpec({
          prerequisites: [],
          inputs: [],
          servers: { 'sdd-g': { type: 'http', url: 'https://g.dev/mcp', headers: { 'X-Client': 'sdd' } } },
          approxTools: { 'sdd-g': 1 },
          operate: undefined,
        }),
        v2files,
        '1.1.0',
      );
      assert.strictEqual(await installer.update(ws(), v2, never, new Date(), never), 'updated');
    });
  });

  it('desactivar con un comentario entre nuestra entrada y su coma deja un archivo válido con lo ajeno', async () => {
    await installer.activate(ws(), cloudy);
    const entry = JSON.stringify(cloudy.mcp!.servers['sdd-x']);
    const inputs = JSON.stringify(cloudy.mcp!.inputs);
    await writeWs('.vscode/mcp.json', `{ "servers": { "sdd-x": ${entry} /* x */, "mine": { "type": "stdio", "command": "my-server" } }, "inputs": ${inputs} }`);
    assert.strictEqual(await installer.deactivate(ws(), 'cloudy', never), 'deactivated');
    assert.deepStrictEqual((await mcpJson()).servers, { mine: { type: 'stdio', command: 'my-server' } });
    assert.match(await readWs('.vscode/mcp.json'), /\/\* x \*\//);
  });

  it('mcpEditOrFileInvalid convierte McpJsonError en MCP_FILE_INVALID con el archivo y deja pasar el resto', () => {
    const uri = wsUri('.vscode/mcp.json');
    let err: { code?: string; message?: string; fileUri?: vscode.Uri } = {};
    try {
      mcpEditOrFileInvalid(() => {
        throw new McpJsonError('detalle');
      }, uri);
    } catch (e) {
      err = e as typeof err;
    }
    assert.strictEqual(err.code, 'MCP_FILE_INVALID');
    assert.strictEqual(err.message, 'No se pudo editar .vscode/mcp.json de forma segura (detalle). Edítalo a mano y reintenta.');
    assert.strictEqual(err.fileUri?.path, uri.path);
    assert.throws(() => mcpEditOrFileInvalid(() => { throw new Error('otro'); }, uri), /otro/);
    assert.strictEqual(mcpEditOrFileInvalid(() => 'ok', uri), 'ok');
  });

  it('update con la misma línea de comando no pide confirmar el MCP', async () => {
    await installer.activate(ws(), cloudy);
    const spec = mcpSpec();
    const sameCommand = { ...(spec.servers['sdd-x'] as McpStdioServer), env: { ...(spec.servers['sdd-x'] as McpStdioServer).env, EXTRA: '1' } };
    const v2 = mcpPower('cloudy', mcpSpec({ servers: { 'sdd-x': sameCommand } }), cloudy.files, '1.1.0');
    assert.strictEqual(await installer.update(ws(), v2, never, new Date(), never), 'updated');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], sameCommand);
  });

  it('desactivar quita entradas e inputs y borra el archivo si lo creamos y queda vacío', async () => {
    await installer.activate(ws(), cloudy);
    assert.strictEqual(await installer.deactivate(ws(), 'cloudy', never), 'deactivated');
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    const l = await lock();
    assert.deepStrictEqual([l.schemaVersion, l.powers], [1, {}]);
  });

  it('desactivar deja el archivo ajeno como estaba antes de activar', async () => {
    await writeWs('.vscode/mcp.json', FOREIGN);
    await installer.activate(ws(), cloudy);
    await installer.deactivate(ws(), 'cloudy', never);
    const text = await readWs('.vscode/mcp.json');
    assert.strictEqual(text, FOREIGN);
    assert.doesNotMatch(text, /"inputs"/);
  });

  it('inputs compartidos: se quitan solo cuando ningún Power activo los usa', async () => {
    await installer.activate(ws(), cloudy);
    await installer.activate(ws(), docsy);
    assert.deepStrictEqual((await mcpJson()).inputs!.map((i) => i.id), ['sdd_x_profile', 'sdd_x_region']);
    await installer.deactivate(ws(), 'cloudy', never);
    const file = await mcpJson();
    assert.deepStrictEqual(Object.keys(file.servers), ['sdd-y']);
    assert.deepStrictEqual(file.inputs!.map((i) => i.id), ['sdd_x_profile']);
    await installer.deactivate(ws(), 'docsy', never);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
  });

  it('el archivo creado por el primer Power se borra al desactivar el último', async () => {
    await installer.activate(ws(), cloudy);
    await installer.activate(ws(), docsy);
    assert.strictEqual((await lock()).powers.docsy.mcp.createdFile, true);
    await installer.deactivate(ws(), 'docsy', never);
    await installer.deactivate(ws(), 'cloudy', never);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
  });

  it('desactivar con una entrada editada pide confirmar (MCP_EDITED); cancelar conserva todo', async () => {
    await installer.activate(ws(), cloudy);
    const edited = (await readWs('.vscode/mcp.json')).replace('"READ_ONLY": "true"', '"READ_ONLY": "maybe"');
    await writeWs('.vscode/mcp.json', edited);
    const reasons: string[] = [];
    assert.strictEqual(await installer.deactivate(ws(), 'cloudy', async (why) => (reasons.push(why), false)), 'cancelled');
    assert.deepStrictEqual(reasons, ['MCP_EDITED']);
    assert.strictEqual(await readWs('.vscode/mcp.json'), edited);
    assert.strictEqual(await exists('.github/skills/cloudy/SKILL.md'), true);
  });
});
