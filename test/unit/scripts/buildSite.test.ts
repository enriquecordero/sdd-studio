import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildSite, TEASER_MARKER } from '../../../scripts/build-site';
import { validateCatalog } from '../../../src/powers/catalog';
import { catalog, power } from '../../support/powerFixtures';

describe('buildSite', () => {
  it('genera landing con teaser, /powers con tarjetas, detalle y catálogo', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'site-'));
    const siteDir = join(tmp, 'site');
    const outDir = join(tmp, '_site');
    mkdirSync(siteDir);
    writeFileSync(join(siteDir, 'index.html'), `<html><body><div class="chips">${TEASER_MARKER}</div></body></html>`);
    const asset = join(tmp, 'speccy.svg');
    writeFileSync(asset, '<svg/>');
    buildSite({ siteDir, outDir, catalog: catalog([power('alpha'), power('beta')]), assets: { 'speccy.svg': asset } });

    const landing = readFileSync(join(outDir, 'index.html'), 'utf8');
    expect(landing).toContain('href="powers/alpha.html"');
    expect(landing).not.toContain(TEASER_MARKER);

    const index = readFileSync(join(outDir, 'powers', 'index.html'), 'utf8');
    expect(index).toContain('href="alpha.html"');
    expect(index).toContain('data-id="beta"');
    expect(index).toContain('pw-search');

    const detail = readFileSync(join(outDir, 'powers', 'alpha.html'), 'utf8');
    expect(detail).toContain('Cómo activarlo');
    expect(detail).toContain('https://github.com/enriquecordero/sdd-studio/tree/main/powers/alpha/skills/alpha');
    expect(detail).toContain('SE ACTIVA CUANDO DICES');

    expect(validateCatalog(JSON.parse(readFileSync(join(outDir, 'powers', 'catalog.json'), 'utf8'))).ok).toBe(true);
    expect(existsSync(join(outDir, 'speccy.svg'))).toBe(true);
  });
});
