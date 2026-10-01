import * as assert from 'assert';
import * as vscode from 'vscode';
import { PowerInstaller } from '../../src/powers/installer';
import { power } from '../support/powerFixtures';
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

const v1 = power('alpha', { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\nv1\n', 'references/a.md': 'A\n' }, '1.0.0');
const v2 = power('alpha', { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\nv2\n' }, '1.1.0');

describe('PowerInstaller', () => {
  const installer = new PowerInstaller();
  beforeEach(restoreFixture);

  it('activate escribe los archivos y el lockfile', async () => {
    await installer.activate(ws(), v1, new Date('2026-10-01T00:00:00Z'));
    assert.strictEqual(await readWs('.github/skills/alpha/references/a.md'), 'A\n');
    const lock = JSON.parse(await readWs('.github/powers.lock.json'));
    assert.deepStrictEqual(lock.powers.alpha, {
      version: '1.0.0',
      skillName: 'alpha',
      sha256: v1.sha256,
      files: ['SKILL.md', 'references/a.md'],
      installedAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('rechaza skill ajeno con el mismo nombre sin tocarlo', async () => {
    await writeWs('.github/skills/alpha/SKILL.md', 'mío');
    assert.strictEqual(await codeOf(installer.activate(ws(), v1)), 'FOREIGN_SKILL');
    assert.strictEqual(await readWs('.github/skills/alpha/SKILL.md'), 'mío');
    assert.strictEqual(await exists('.github/powers.lock.json'), false);
  });

  it('no instala nada con rutas inseguras', async () => {
    const evil = { ...v1, files: { 'SKILL.md': 'x', '../../evil.md': 'x' } };
    assert.strictEqual(await codeOf(installer.activate(ws(), evil)), 'UNSAFE_PATH');
    assert.strictEqual(await exists('.github/skills/alpha'), false);
    assert.strictEqual(await exists('evil.md'), false);
  });

  it('update sin cambios locales no pregunta y borra archivos obsoletos', async () => {
    await installer.activate(ws(), v1);
    let asked = false;
    const r = await installer.update(ws(), v2, async () => {
      asked = true;
      return true;
    });
    assert.strictEqual(r, 'updated');
    assert.strictEqual(asked, false);
    assert.match(await readWs('.github/skills/alpha/SKILL.md'), /v2/);
    assert.strictEqual(await exists('.github/skills/alpha/references/a.md'), false);
    assert.strictEqual(JSON.parse(await readWs('.github/powers.lock.json')).powers.alpha.version, '1.1.0');
  });

  it('update con archivo editado pregunta; cancelar conserva los cambios', async () => {
    await installer.activate(ws(), v1);
    await writeWs('.github/skills/alpha/SKILL.md', 'editado a mano');
    const r = await installer.update(ws(), v2, async () => false);
    assert.strictEqual(r, 'cancelled');
    assert.strictEqual(await readWs('.github/skills/alpha/SKILL.md'), 'editado a mano');
    assert.strictEqual(JSON.parse(await readWs('.github/powers.lock.json')).powers.alpha.version, '1.0.0');
    assert.strictEqual(await installer.update(ws(), v2, async () => true), 'updated');
    assert.match(await readWs('.github/skills/alpha/SKILL.md'), /v2/);
  });

  it('deactivate borra solo lo suyo y quita la entrada', async () => {
    await installer.activate(ws(), v1);
    await writeWs('.github/skills/alpha/notas-mias.md', 'mías');
    await installer.deactivate(ws(), 'alpha');
    assert.strictEqual(await exists('.github/skills/alpha/SKILL.md'), false);
    assert.strictEqual(await exists('.github/skills/alpha/references'), false);
    assert.strictEqual(await readWs('.github/skills/alpha/notas-mias.md'), 'mías');
    assert.deepStrictEqual(JSON.parse(await readWs('.github/powers.lock.json')).powers, {});
  });

  it('deactivate borra la carpeta si queda vacía', async () => {
    await installer.activate(ws(), v1);
    await installer.deactivate(ws(), 'alpha');
    assert.strictEqual(await exists('.github/skills/alpha'), false);
  });

  it('lockfile inválido: error claro y no lo sobrescribe', async () => {
    await writeWs('.github/powers.lock.json', '{ roto');
    assert.strictEqual(await codeOf(installer.activate(ws(), v1)), 'LOCK_INVALID');
    assert.strictEqual(await readWs('.github/powers.lock.json'), '{ roto');
  });

  it('update o deactivate de un Power no activo: NOT_INSTALLED', async () => {
    assert.strictEqual(await codeOf(installer.update(ws(), v2, async () => true)), 'NOT_INSTALLED');
    assert.strictEqual(await codeOf(installer.deactivate(ws(), 'alpha')), 'NOT_INSTALLED');
  });
});
