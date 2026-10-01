import { describe, expect, it } from 'vitest';
import { renderActions, renderCard, renderMcpStrip, renderPoster } from '../../../src/powers/render/card';
import { renderDiagram } from '../../../src/powers/render/diagram';
import { escapeHtml } from '../../../src/powers/render/escape';
import { FILTER_SCRIPT, renderFilters, renderGrid, renderTeaserChips } from '../../../src/powers/render/gallery';
import { speccySvg } from '../../../src/powers/render/speccy';
import { renderGalleryDocument } from '../../../src/powers/render/webview';
import { mcpPower, mcpSpec, power, presentation } from '../../support/powerFixtures';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('escapeHtml', () => {
  it('escapa caracteres peligrosos', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
  });
});

describe('renderDiagram', () => {
  it('cycle: un círculo y una flecha por nodo', () => {
    const svg = renderDiagram({ kind: 'cycle', nodes: [{ label: 'ROJO', tone: 'red', edge: 'mínimo' }, { label: 'VERDE' }, { label: 'REFACTOR' }] }, 't');
    expect(count(svg, '<circle')).toBe(3);
    expect(count(svg, '<line')).toBe(3);
    expect(svg).toContain('mínimo');
    expect(svg).toContain('#ff7a90');
  });
  it('steps: cajas y flechas entre ellas', () => {
    const svg = renderDiagram({ kind: 'steps', nodes: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }] });
    expect(count(svg, '<rect')).toBe(4);
    expect(count(svg, '<line')).toBe(3);
  });
  it('funnel: una franja por nodo', () => {
    const svg = renderDiagram({ kind: 'funnel', nodes: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] });
    expect(count(svg, '<polygon')).toBe(3);
  });
  it('split: dos columnas con sus ítems', () => {
    const svg = renderDiagram({ kind: 'split', columns: [{ label: 'A', items: ['uno', 'dos'] }, { label: 'B', items: ['tres'] }] });
    expect(count(svg, '<rect')).toBe(2);
    expect(count(svg, 'class="pw-item"')).toBe(3);
  });
  it('usa ids de marcador únicos por uid', () => {
    expect(renderDiagram({ kind: 'steps', nodes: [{ label: 'A' }, { label: 'B' }] }, 'zz')).toContain('pw-arrow-zz');
  });
});

describe('tarjeta y póster', () => {
  const evil = { ...power('alpha'), presentation: presentation({ summary: '<img src=x onerror=alert(1)>', triggers: ['"<script>"'] }) };
  it('escapa contenido del catálogo', () => {
    const html = renderCard(evil, { actions: true }) + renderPoster(evil, { actions: true });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('escapa todos los campos de presentación en tarjeta, póster, galería y webview', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const evilSplit = {
      ...power('split-evil'),
      presentation: presentation({
        displayName: payload,
        summary: payload,
        triggers: [payload],
        gets: [payload],
        diagram: {
          kind: 'split' as const,
          columns: [
            { label: payload, items: [payload, 'safe'] },
            { label: 'safe', items: [payload] },
          ],
        },
        source: {
          repo: payload,
          path: payload,
          commit: payload,
          author: payload,
          license: payload,
        },
      }),
    };
    const evilSteps = {
      ...power('steps-evil'),
      presentation: presentation({
        displayName: payload,
        summary: payload,
        triggers: [payload],
        gets: [payload],
        diagram: {
          kind: 'steps' as const,
          nodes: [
            { label: payload, edge: payload },
            { label: 'safe', edge: payload },
            { label: payload },
          ],
        },
        source: {
          repo: payload,
          path: payload,
          commit: payload,
          author: payload,
          license: payload,
        },
      }),
    };

    const card1 = renderCard(evilSplit, { actions: true });
    const card2 = renderCard(evilSteps, { actions: true });
    const poster1 = renderPoster(evilSplit, { actions: false });
    const poster2 = renderPoster(evilSteps, { actions: false });
    const grid = renderGrid([evilSplit, evilSteps], { actions: true, statuses: { 'split-evil': 'active', 'steps-evil': 'available' } });
    const webview = renderGalleryDocument({
      views: [
        { power: evilSplit, status: 'active' },
        { power: evilSteps, status: 'available' },
      ],
      strict: false,
      hasFolder: true,
      nonce: 'test',
      cspSource: 'vscode-resource:',
    });

    const allHtml = card1 + card2 + poster1 + poster2 + grid + webview;

    // No unescaped dangerous HTML should appear
    expect(allHtml).not.toContain('<img src=x');
    expect(allHtml).not.toContain('<script>');

    // All payloads should be escaped
    const escapedPayload = '&lt;img src=x onerror=alert(1)&gt;';
    expect(allHtml).toContain(escapedPayload);
  });
  it('botón según el estado', () => {
    const p = power('alpha');
    expect(renderCard(p, { actions: true })).toContain('data-action="activate"');
    expect(renderCard(p, { actions: true, status: 'active' })).toContain('✓ Activo · v1.0.0');
    expect(renderCard({ ...p, version: '1.1.0' }, { actions: true, status: 'update' })).toContain('Actualizar a v1.1.0');
    expect(renderCard(p, { actions: false })).not.toContain('data-action="activate"');
  });
  it('el póster trae chips, diagrama, beneficios y origen', () => {
    const html = renderPoster(power('alpha'), { actions: false });
    expect(html).toContain('SE ACTIVA CUANDO DICES');
    expect(html).toContain('<svg');
    expect(html).toContain('OBTIENES');
    expect(html).toContain('https://github.com/owner/repo/tree/abc123/skills/alpha');
  });
  it('detalle como enlace en la web y como acción en VS Code', () => {
    expect(renderCard(power('alpha'), { actions: false, detailHref: 'alpha.html' })).toContain('href="alpha.html"');
    expect(renderCard(power('alpha'), { actions: true })).toContain('data-action="detail"');
  });
});

describe('galería', () => {
  it('separa activos y recomendados cuando hay estados', () => {
    const html = renderGrid([power('alpha'), power('beta')], { actions: true, statuses: { alpha: 'active', beta: 'available' } });
    expect(html.indexOf('ACTIVOS EN ESTE REPO')).toBeLessThan(html.indexOf('data-id="alpha"'));
    expect(html.indexOf('RECOMENDADOS')).toBeLessThan(html.indexOf('data-id="beta"'));
  });
  it('catálogo vacío muestra mensaje', () => {
    expect(renderGrid([], { actions: false })).toContain('No hay Powers');
  });
  it('chips del teaser enlazan a powers/<id>.html', () => {
    expect(renderTeaserChips([power('alpha')])).toContain('href="powers/alpha.html"');
  });
});

describe('documento del webview', () => {
  const base = { views: [{ power: power('alpha'), status: 'available' as const }], strict: false, hasFolder: true, nonce: 'N0NCE', cspSource: 'vscode-resource:' };
  it('CSP estricta y scripts con nonce', () => {
    const html = renderGalleryDocument(base);
    expect(html).toContain(`default-src 'none'`);
    expect(html).toContain(`script-src 'nonce-N0NCE'`);
    expect(count(html, '<script')).toBe(count(html, '<script nonce="N0NCE"'));
    expect(html).toContain('data-detail="alpha"');
  });
  it('banner de política y sin acciones si no hay carpeta', () => {
    const html = renderGalleryDocument({ ...base, strict: true, hasFolder: false });
    expect(html).toContain('ChatStrictPluginOnlyCustomization');
    expect(html).toContain('Abre una carpeta');
    expect(html).not.toContain('data-action="activate"');
  });
  it('muestra el error del lockfile', () => {
    expect(renderGalleryDocument({ ...base, error: 'powers.lock.json no es JSON válido.' })).toContain('powers.lock.json no es JSON válido.');
  });
  it('incluye a Speccy en la cabecera', () => {
    expect(renderGalleryDocument(base)).toContain('aria-label="Speccy');
    expect(speccySvg('a')).toContain('speccy-g-a');
  });
});

describe('Powers con MCP', () => {
  const cloudy = mcpPower('cloudy');
  const remote = mcpPower(
    'docsy',
    mcpSpec({ prerequisites: [], inputs: [], servers: { 'sdd-docs': { type: 'http', url: 'https://docs.example.com/mcp' } }, approxTools: { 'sdd-docs': 2 }, beta: true, credentials: 'Ninguna', operate: undefined }),
  );

  it('distintivo 🔌 MCP y data-mcp en la tarjeta; nada en un Power sin MCP', () => {
    const html = renderCard(cloudy, { actions: false });
    expect(html).toContain('🔌 MCP');
    expect(html).toContain('data-mcp="1"');
    expect(html).toContain('sdd-x');
    const plain = renderCard(power('alpha'), { actions: false });
    expect(plain).not.toContain('🔌 MCP');
    expect(plain).toContain('data-mcp="0"');
  });

  it('chip de filtro "Con MCP" solo si hay Powers con MCP, y el script lo entiende', () => {
    expect(renderFilters([power('alpha'), cloudy])).toContain('data-filter="mcp"');
    expect(renderFilters([power('alpha')])).not.toContain('data-filter="mcp"');
    expect(FILTER_SCRIPT).toContain("state.cat === 'mcp'");
  });

  it('las categorías nuevas aparecen en orden: Dev core, Documentación, Cloud', () => {
    const cat = (id: string, category: 'devcore' | 'docs' | 'cloud') => ({ ...power(id), presentation: presentation({ category }) });
    const html = renderFilters([cat('c', 'cloud'), cat('a', 'devcore'), cat('b', 'docs')]);
    expect(html.indexOf('Dev core')).toBeLessThan(html.indexOf('Documentación'));
    expect(html.indexOf('Documentación')).toBeLessThan(html.indexOf('>Cloud<'));
  });

  it('franja MCP: local con su comando, prerrequisitos, credenciales y modo Operar', () => {
    const html = renderPoster(cloudy, { actions: false });
    expect(html).toContain('SERVIDORES MCP');
    expect(html).toContain('<code>sdd-x</code> <span class="pw-kind pw-local">local</span> ejecuta código en tu máquina: <code>uvx x-mcp-server@1.0.0</code>');
    expect(html).toContain('Prerrequisitos: uv');
    expect(html).toContain('Credenciales: Perfil local');
    expect(html).toContain('modo Operar opcional');
    expect(html).not.toContain('pw-beta');
  });

  it('franja MCP: remoto con su host y beta', () => {
    const html = renderMcpStrip(remote);
    expect(html).toContain('<span class="pw-kind">remoto</span> docs.example.com');
    expect(html).toContain('Prerrequisitos: ninguno');
    expect(html).toContain('<span class="pw-beta">beta</span>');
    expect(renderMcpStrip(power('alpha'))).toBe('');
  });

  it('escapa los textos de mcp', () => {
    const evil = mcpPower('evil', mcpSpec({ credentials: '<img src=x onerror=alert(1)>' }));
    const html = renderPoster(evil, { actions: false });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('selector de modo en un Power activo con operate; Operar resaltado en tono warn', () => {
    const ro = renderActions(cloudy, 'active', { mode: 'readOnly' });
    expect(ro).toContain('data-action="setMode" data-id="cloudy" data-mode="operate"');
    expect(ro).toMatch(/class="pw-seg pw-on" data-action="setMode" data-id="cloudy" data-mode="readOnly" aria-pressed="true">Solo lectura/);
    const op = renderActions(cloudy, 'active', { mode: 'operate' });
    expect(op).toMatch(/class="pw-seg pw-on pw-warn" data-action="setMode" data-id="cloudy" data-mode="operate" aria-pressed="true">Operar/);
    expect(renderActions(remote, 'active', { mode: 'readOnly' })).not.toContain('setMode');
    expect(renderActions(cloudy, 'available', { mode: 'readOnly' })).not.toContain('setMode');
  });

  it('política bloqueada: botón 🔒 deshabilitado con la razón y enlace al diagnóstico', () => {
    const html = renderActions(cloudy, 'available', { blocked: 'chat.mcp.access = none' });
    expect(html).toContain('🔒 Bloqueado por tu organización');
    expect(html).toContain('disabled');
    expect(html).toContain('chat.mcp.access = none');
    expect(html).toContain('data-action="doctor"');
    expect(html).not.toContain('data-action="activate"');
    expect(renderActions(power('alpha'), 'available', { blocked: 'x' })).toContain('data-action="activate"');
    expect(renderActions(cloudy, 'active', { blocked: 'x' })).toContain('data-action="deactivate"');
  });

  it('el webview pasa modo y bloqueo a tarjetas y pósters, y envía data-mode', () => {
    const html = renderGalleryDocument({
      views: [
        { power: cloudy, status: 'active', mode: 'operate' },
        { power: remote, status: 'available' },
      ],
      strict: false,
      hasFolder: true,
      mcpBlocked: 'chat.mcp.access = none',
      nonce: 'N',
      cspSource: 'vscode-resource:',
    });
    expect(count(html, 'pw-on pw-warn')).toBe(2);
    expect(count(html, '🔒 Bloqueado por tu organización')).toBe(2);
    expect(html).toContain("mode: t.getAttribute('data-mode')");
  });
});
