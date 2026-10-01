import * as assert from 'assert';
import { catalog, power } from '../support/powerFixtures';
import { getApi, restoreFixture, ws } from './helpers';

const FUTURE = '2999-01-01T00:00:00.000Z';
const v1 = power('alpha');
const v2 = power('alpha', { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\nv2\n' }, '1.1.0');

describe('PowersService', () => {
  beforeEach(restoreFixture);
  afterEach(async () => {
    const { powers } = await getApi();
    await powers.resetCatalog();
  });

  it('carga el catálogo incluido (válido)', async () => {
    const { powers } = await getApi();
    assert.strictEqual((await powers.catalog()).schemaVersion, 1);
  });

  it('refresh con catálogo válido y más nuevo lo usa', async () => {
    const { powers } = await getApi();
    powers.setFetcher(async () => JSON.stringify(catalog([v1, power('beta')], FUTURE)));
    assert.deepStrictEqual(await powers.refreshOnline(), { kind: 'updated', powers: 2 });
    const views = await powers.views(ws());
    assert.deepStrictEqual(views.map((v) => [v.power.id, v.status]), [['alpha', 'available'], ['beta', 'available']]);
  });

  it('refresh con JSON roto o esquema inválido no cambia nada', async () => {
    const { powers } = await getApi();
    const before = await powers.catalog();
    powers.setFetcher(async () => '{ roto');
    assert.strictEqual((await powers.refreshOnline()).kind, 'invalid');
    powers.setFetcher(async () => JSON.stringify({ schemaVersion: 1, generatedAt: FUTURE, powers: [{ id: 'X' }] }));
    assert.strictEqual((await powers.refreshOnline()).kind, 'invalid');
    assert.strictEqual(await powers.catalog(), before);
  });

  it('error de red mantiene el catálogo', async () => {
    const { powers } = await getApi();
    powers.setFetcher(async () => {
      throw new Error('tiempo agotado (10 s)');
    });
    assert.deepStrictEqual(await powers.refreshOnline(), { kind: 'error', message: 'tiempo agotado (10 s)' });
    assert.strictEqual((await powers.catalog()).schemaVersion, 1);
  });

  it('catálogo más viejo: current', async () => {
    const { powers } = await getApi();
    powers.setFetcher(async () => JSON.stringify(catalog([v1], '2000-01-01T00:00:00.000Z')));
    assert.deepStrictEqual(await powers.refreshOnline(), { kind: 'current' });
  });

  it('activar, ver actualización disponible y desactivar', async () => {
    const { powers } = await getApi();
    powers.setFetcher(async () => JSON.stringify(catalog([v1], FUTURE)));
    await powers.refreshOnline();
    let changes = 0;
    const sub = powers.onDidChange(() => changes++);
    await powers.activate('alpha', ws());
    assert.strictEqual((await powers.views(ws()))[0].status, 'active');
    powers.setFetcher(async () => JSON.stringify(catalog([v2], '2999-06-01T00:00:00.000Z')));
    await powers.refreshOnline();
    const [active] = await powers.active(ws());
    assert.deepStrictEqual([active.id, active.entry.version, active.status], ['alpha', '1.0.0', 'update']);
    assert.strictEqual(await powers.update('alpha', ws(), async () => true), 'updated');
    await powers.deactivate('alpha', ws());
    assert.deepStrictEqual(await powers.active(ws()), []);
    assert.ok(changes >= 4);
    sub.dispose();
  });

  it('find de un id inexistente: NOT_FOUND', async () => {
    const { powers } = await getApi();
    await assert.rejects(powers.find('no-existe'), (e: { code?: string }) => e.code === 'NOT_FOUND');
  });
});
