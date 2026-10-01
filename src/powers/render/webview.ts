import type { PowerStatus } from '../lock';
import type { McpMode } from '../mcp/spec';
import { CatalogPower } from '../types';
import { renderPoster } from './card';
import { escapeHtml as e } from './escape';
import { FILTER_SCRIPT, renderFilters, renderGrid } from './gallery';
import { speccySvg } from './speccy';
import { POWERS_CSS } from './styles';

export interface GalleryDocInput {
  views: { power: CatalogPower; status: PowerStatus; mode?: McpMode }[];
  /** Razón del bloqueo de MCP por política (undefined si se permite). */
  mcpBlocked?: string;
  strict: boolean;
  hasFolder: boolean;
  error?: string;
  nonce: string;
  cspSource: string;
}

const GALLERY_SCRIPT = `(function(){
  var vscode = acquireVsCodeApi();
  var grid = document.getElementById('pw-grid-view');
  function show(id){
    grid.hidden = !!id;
    document.querySelectorAll('.pw-detail').forEach(function(d){ d.hidden = d.getAttribute('data-detail') !== id; });
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!t) return;
    ev.preventDefault();
    var action = t.getAttribute('data-action');
    var id = t.getAttribute('data-id');
    if (action === 'detail') { show(id); return; }
    if (action === 'back') { show(null); return; }
    vscode.postMessage({ type: action, id: id, mode: t.getAttribute('data-mode') });
  });
})();`;

export function renderGalleryDocument(input: GalleryDocInput): string {
  const { views, strict, hasFolder, error, nonce, cspSource, mcpBlocked } = input;
  const powers = views.map((v) => v.power);
  const statuses = Object.fromEntries(views.map((v) => [v.power.id, v.status]));
  const modes = Object.fromEntries(views.flatMap((v) => (v.mode ? [[v.power.id, v.mode]] : [])));
  const csp = `default-src 'none'; img-src ${cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
  const banners =
    (strict
      ? '<div class="pw-banner">⚠️ Tu organización puede impedir que Copilot cargue skills del repo (política ChatStrictPluginOnlyCustomization). Ejecuta "SDD Studio: Diagnóstico" para más detalles.</div>'
      : '') +
    (error ? `<div class="pw-banner">⚠️ ${e(error)}</div>` : '') +
    (!hasFolder && !error ? '<div class="pw-banner">Abre una carpeta para activar Powers en un repo.</div>' : '');
  const details = powers
    .map(
      (p) =>
        `<div class="pw-detail" data-detail="${e(p.id)}" hidden><button class="pw-link" data-action="back">← Volver</button>` +
        `${renderPoster(p, { status: statuses[p.id], mode: modes[p.id], blocked: mcpBlocked, actions: hasFolder })}</div>`,
    )
    .join('');
  return (
    `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style nonce="${nonce}">${POWERS_CSS}</style></head>` +
    `<body class="pw-root"><main class="pw-wrap">${banners}` +
    `<div id="pw-grid-view"><header class="pw-hero">${speccySvg('gallery', 84)}<h1>⚡ Powers</h1>` +
    `<p>Skills de la comunidad, adaptados para GitHub Copilot. Se cargan solos cuando tu pedido coincide con su descripción.</p>` +
    `${renderFilters(powers)}</header>${renderGrid(powers, { statuses, modes, blocked: mcpBlocked, actions: hasFolder })}</div>` +
    `${details}</main><script nonce="${nonce}">${FILTER_SCRIPT}${GALLERY_SCRIPT}</script></body></html>`
  );
}
