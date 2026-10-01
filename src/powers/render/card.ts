import type { PowerStatus } from '../lock';
import { McpMode, MODE_LABELS, PREREQUISITES, serverCommandLine, serverKind } from '../mcp/spec';
import { CATEGORY_LABELS, CatalogPower, sourceUrl } from '../types';
import { renderDiagram } from './diagram';
import { escapeHtml as e } from './escape';

export interface RenderOptions {
  status?: PowerStatus;
  actions: boolean;
  detailHref?: string;
  /** Modo MCP actual (solo Powers con MCP activos). */
  mode?: McpMode;
  /** Razón por la que la organización bloquea MCP; si está, los Powers con MCP no se pueden activar. */
  blocked?: string;
}

function whatItDoes(p: CatalogPower): string {
  const d = p.presentation.diagram;
  return d.kind === 'split' ? d.columns.map((c) => c.label).join(' + ') : d.nodes.map((n) => n.label).join(' → ');
}

function head(p: CatalogPower): string {
  const pr = p.presentation;
  const badge = p.mcp ? ' · <span class="pw-mcp">🔌 MCP</span>' : '';
  return (
    `<div class="pw-head"><div class="pw-ico">${e(pr.icon)}</div><div>` +
    `<div class="pw-name">${e(pr.displayName)}</div>` +
    `<div class="pw-by">${e(pr.source.repo)} · <span class="pw-pill">${e(pr.source.license)}</span> · ${e(CATEGORY_LABELS[pr.category])}${badge}</div>` +
    `</div></div>`
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Franja MCP del póster: servidores (local o remoto), prerrequisitos, credenciales, modo Operar y beta. */
export function renderMcpStrip(p: CatalogPower): string {
  const mcp = p.mcp;
  if (!mcp) return '';
  const servers = Object.entries(mcp.servers)
    .map(([name, s]) =>
      serverKind(s) === 'local'
        ? `<li><code>${e(name)}</code> <span class="pw-kind pw-local">local</span> ejecuta código en tu máquina: <code>${e(serverCommandLine(s))}</code></li>`
        : `<li><code>${e(name)}</code> <span class="pw-kind">remoto</span> ${e(hostOf(serverCommandLine(s)))}</li>`,
    )
    .join('');
  const prereqs = mcp.prerequisites.length > 0 ? mcp.prerequisites.map((r) => PREREQUISITES[r].label).join(', ') : 'ninguno';
  const meta = [
    `Prerrequisitos: ${e(prereqs)}`,
    `Credenciales: ${e(mcp.credentials)}`,
    mcp.operate ? 'Solo lectura por defecto · modo Operar opcional' : 'Solo lectura',
    ...(mcp.beta ? ['<span class="pw-beta">beta</span>'] : []),
  ].join(' · ');
  return `<div class="pw-lbl">SERVIDORES MCP</div><ul class="pw-mcpstrip">${servers}</ul><p class="pw-mcpmeta">${meta}</p>`;
}

function renderModeSelector(p: CatalogPower, mode: McpMode | undefined): string {
  if (!p.mcp?.operate || !mode) return '';
  const id = e(p.id);
  const opt = (m: McpMode) =>
    `<button class="pw-seg${m === mode ? ' pw-on' : ''}${m === mode && m === 'operate' ? ' pw-warn' : ''}" data-action="setMode" data-id="${id}" data-mode="${m}" aria-pressed="${m === mode}">${MODE_LABELS[m]}</button>`;
  return `<span class="pw-mode" role="group" aria-label="Modo MCP">${opt('readOnly')}${opt('operate')}</span>`;
}

export function renderActions(p: CatalogPower, status: PowerStatus | undefined, mcp: { mode?: McpMode; blocked?: string } = {}): string {
  const id = e(p.id);
  const off = `<button class="pw-btn pw-ghost" data-action="deactivate" data-id="${id}">Desactivar</button>`;
  if (status === 'active') return `<span class="pw-state">✓ Activo · v${e(p.version)}</span>${renderModeSelector(p, mcp.mode)}${off}`;
  // Sin selector: cambiar de modo exige estar en la versión del catálogo (setMode lanza UPDATE_REQUIRED).
  if (status === 'update') return `<button class="pw-btn" data-action="update" data-id="${id}">Actualizar a v${e(p.version)}</button>${off}`;
  if (p.mcp && mcp.blocked) {
    return (
      `<button class="pw-btn pw-blocked" disabled title="${e(`Tu organización bloquea los servidores MCP (${mcp.blocked}). Ejecuta "SDD Studio: Diagnóstico".`)}">🔒 Bloqueado por tu organización</button>` +
      `<button class="pw-link" data-action="doctor" data-id="${id}">Ver diagnóstico</button>`
    );
  }
  return `<button class="pw-btn" data-action="activate" data-id="${id}">+ Activar en este repo</button>`;
}

export function renderCard(p: CatalogPower, opts: RenderOptions): string {
  const pr = p.presentation;
  const servers = p.mcp ? ` ${Object.keys(p.mcp.servers).join(' ')} mcp` : '';
  const search = `${pr.displayName} ${pr.summary} ${pr.source.author}${servers}`.toLowerCase();
  const detail = opts.detailHref
    ? `<a class="pw-link" href="${e(opts.detailHref)}">Ver detalle →</a>`
    : `<button class="pw-link" data-action="detail" data-id="${e(p.id)}">Ver detalle →</button>`;
  return (
    `<article class="pw-card" data-id="${e(p.id)}" data-category="${e(pr.category)}" data-mcp="${p.mcp ? '1' : '0'}" data-search="${e(search)}">` +
    head(p) +
    `<p class="pw-summary">${e(pr.summary)}</p>` +
    `<div class="pw-strip"><div><b>CUÁNDO</b>${e(pr.triggers[0])}</div><span>→</span>` +
    `<div><b>QUÉ HACE</b>${e(whatItDoes(p))}</div><span>→</span>` +
    `<div><b>OBTIENES</b>${e(pr.gets[0])}</div></div>` +
    `<div class="pw-foot">${opts.actions ? renderActions(p, opts.status, opts) : ''}${detail}</div>` +
    `</article>`
  );
}

export function renderPoster(p: CatalogPower, opts: RenderOptions & { uid?: string }): string {
  const pr = p.presentation;
  return (
    `<section class="pw-poster" data-id="${e(p.id)}">` +
    head(p) +
    `<p class="pw-summary">${e(pr.summary)}</p>` +
    renderMcpStrip(p) +
    `<div class="pw-lbl">SE ACTIVA CUANDO DICES</div>` +
    `<div class="pw-chips">${pr.triggers.map((t) => `<span class="pw-chip">${e(t)}</span>`).join('')}</div>` +
    `<div class="pw-lbl">EL MÉTODO</div>${renderDiagram(pr.diagram, opts.uid ?? p.id)}` +
    `<div class="pw-lbl">OBTIENES</div><ul class="pw-gets">${pr.gets.map((g) => `<li>${e(g)}</li>`).join('')}</ul>` +
    `<div class="pw-lbl">ORIGEN</div><p class="pw-source">` +
    `<a href="${e(sourceUrl(pr.source))}" data-action="openSource" data-id="${e(p.id)}">${e(pr.source.repo)}</a>` +
    ` · ${e(pr.source.author)} · ${e(pr.source.license)} · adaptado para GitHub Copilot</p>` +
    (opts.actions ? `<div class="pw-foot">${renderActions(p, opts.status, opts)}</div>` : '') +
    `</section>`
  );
}
