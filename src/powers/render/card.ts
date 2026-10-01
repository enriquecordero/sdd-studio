import type { PowerStatus } from '../lock';
import { CATEGORY_LABELS, CatalogPower, sourceUrl } from '../types';
import { renderDiagram } from './diagram';
import { escapeHtml as e } from './escape';

export interface RenderOptions {
  status?: PowerStatus;
  actions: boolean;
  detailHref?: string;
}

function whatItDoes(p: CatalogPower): string {
  const d = p.presentation.diagram;
  return d.kind === 'split' ? d.columns.map((c) => c.label).join(' + ') : d.nodes.map((n) => n.label).join(' → ');
}

function head(p: CatalogPower): string {
  const pr = p.presentation;
  return (
    `<div class="pw-head"><div class="pw-ico">${e(pr.icon)}</div><div>` +
    `<div class="pw-name">${e(pr.displayName)}</div>` +
    `<div class="pw-by">${e(pr.source.repo)} · <span class="pw-pill">${e(pr.source.license)}</span> · ${e(CATEGORY_LABELS[pr.category])}</div>` +
    `</div></div>`
  );
}

export function renderActions(p: CatalogPower, status: PowerStatus | undefined): string {
  const id = e(p.id);
  const off = `<button class="pw-btn pw-ghost" data-action="deactivate" data-id="${id}">Desactivar</button>`;
  if (status === 'active') return `<span class="pw-state">✓ Activo · v${e(p.version)}</span>${off}`;
  if (status === 'update') return `<button class="pw-btn" data-action="update" data-id="${id}">Actualizar a v${e(p.version)}</button>${off}`;
  return `<button class="pw-btn" data-action="activate" data-id="${id}">+ Activar en este repo</button>`;
}

export function renderCard(p: CatalogPower, opts: RenderOptions): string {
  const pr = p.presentation;
  const search = `${pr.displayName} ${pr.summary} ${pr.source.author}`.toLowerCase();
  const detail = opts.detailHref
    ? `<a class="pw-link" href="${e(opts.detailHref)}">Ver detalle →</a>`
    : `<button class="pw-link" data-action="detail" data-id="${e(p.id)}">Ver detalle →</button>`;
  return (
    `<article class="pw-card" data-id="${e(p.id)}" data-category="${e(pr.category)}" data-search="${e(search)}">` +
    head(p) +
    `<p class="pw-summary">${e(pr.summary)}</p>` +
    `<div class="pw-strip"><div><b>CUÁNDO</b>${e(pr.triggers[0])}</div><span>→</span>` +
    `<div><b>QUÉ HACE</b>${e(whatItDoes(p))}</div><span>→</span>` +
    `<div><b>OBTIENES</b>${e(pr.gets[0])}</div></div>` +
    `<div class="pw-foot">${opts.actions ? renderActions(p, opts.status) : ''}${detail}</div>` +
    `</article>`
  );
}

export function renderPoster(p: CatalogPower, opts: RenderOptions & { uid?: string }): string {
  const pr = p.presentation;
  return (
    `<section class="pw-poster" data-id="${e(p.id)}">` +
    head(p) +
    `<p class="pw-summary">${e(pr.summary)}</p>` +
    `<div class="pw-lbl">SE ACTIVA CUANDO DICES</div>` +
    `<div class="pw-chips">${pr.triggers.map((t) => `<span class="pw-chip">${e(t)}</span>`).join('')}</div>` +
    `<div class="pw-lbl">EL MÉTODO</div>${renderDiagram(pr.diagram, opts.uid ?? p.id)}` +
    `<div class="pw-lbl">OBTIENES</div><ul class="pw-gets">${pr.gets.map((g) => `<li>${e(g)}</li>`).join('')}</ul>` +
    `<div class="pw-lbl">ORIGEN</div><p class="pw-source">` +
    `<a href="${e(sourceUrl(pr.source))}" data-action="openSource" data-id="${e(p.id)}">${e(pr.source.repo)}</a>` +
    ` · ${e(pr.source.author)} · ${e(pr.source.license)} · adaptado para GitHub Copilot</p>` +
    (opts.actions ? `<div class="pw-foot">${renderActions(p, opts.status)}</div>` : '') +
    `</section>`
  );
}
