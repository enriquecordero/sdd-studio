import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { catalogV1, validateCatalog } from '../src/powers/catalog';
import { renderPoster } from '../src/powers/render/card';
import { PREREQUISITES, serverKind } from '../src/powers/mcp/spec';
import { escapeHtml as e } from '../src/powers/render/escape';
import { FILTER_SCRIPT, renderFilters, renderGrid, renderTeaserChips } from '../src/powers/render/gallery';
import { speccySvg } from '../src/powers/render/speccy';
import { POWERS_CSS } from '../src/powers/render/styles';
import { Catalog, CatalogPower } from '../src/powers/types';

export const REPO_URL = 'https://github.com/enriquecordero/sdd-studio';
export const TEASER_MARKER = '<!-- POWERS_TEASER -->';

const PAGE_CSS = `
.pw-top{display:flex;gap:18px;align-items:center;max-width:1120px;margin:0 auto;padding:16px 20px}
.pw-top a{color:#b080ff;text-decoration:none;font-weight:600}
.pw-top a.pw-brand{display:flex;gap:8px;align-items:center;color:#e8e3ef}
.pw-howto{max-width:760px;margin:24px auto 64px;color:#e8e3ef}
.pw-howto a{color:#b080ff}
.pw-howto code{background:#2a2530;padding:2px 6px;border-radius:5px}
.pw-howto pre{background:#1a171e;border:1px solid #3a3342;border-radius:8px;padding:12px;overflow-x:auto}
.pw-howto pre code{background:none;padding:0}
`;

function page(title: string, body: string, script = ''): string {
  return (
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(title)}</title><link rel="icon" href="../speccy.svg"><style>${POWERS_CSS}${PAGE_CSS}</style></head>` +
    `<body class="pw-root"><nav class="pw-top"><a class="pw-brand" href="../">${speccySvg('nav', 28)}SDD Studio</a>` +
    `<a href="./">Powers</a><a href="${REPO_URL}">GitHub ↗</a></nav><main class="pw-wrap">${body}</main>` +
    (script ? `<script>${script}</script>` : '') +
    `</body></html>`
  );
}

function howTo(p: CatalogPower): string {
  const base = `${REPO_URL}/tree/main/powers/${p.id}/skills/${p.skillName}`;
  const files = Object.keys(p.files)
    .sort()
    .map((f) => `<li><a href="${e(`${REPO_URL}/blob/main/powers/${p.id}/skills/${p.skillName}/${f}`)}"><code>${e(f)}</code></a></li>`)
    .join('');
  return (
    `<section class="pw-howto"><h2>Cómo activarlo</h2>` +
    `<h3>Con SDD Studio</h3><p>Abre la galería (panel ⚡ → Powers → <b>Abrir galería…</b>), busca <b>${e(p.presentation.displayName)}</b> y pulsa <b>+ Activar en este repo</b>.</p>` +
    `<h3>A mano (Copilot, Kiro, Cursor o Claude Code)</h3>` +
    `<p>Copia la carpeta <a href="${e(base)}"><code>skills/${e(p.skillName)}</code></a> a <code>.github/skills/${e(p.skillName)}/</code> de tu repo. Archivos:</p>` +
    `<ul>${files}</ul></section>`
  );
}

/** Sección "Cómo usarlo" de un Power con MCP: pasos, ejemplo de prompt y el bloque para copiar a mano en `.vscode/mcp.json`. */
export function mcpHowTo(p: CatalogPower): string {
  const mcp = p.mcp;
  if (!mcp) return '';
  const names = Object.keys(mcp.servers)
    .map((n) => `<code>${e(n)}</code>`)
    .join(', ');
  const local = Object.values(mcp.servers).some((s) => serverKind(s) === 'local');
  const steps = [
    `Actívalo desde la galería de SDD Studio: añade ${names} a <code>.vscode/mcp.json</code> en modo <b>Solo lectura</b> y el skill a <code>.github/skills/${e(p.skillName)}/</code>.`,
    ...(mcp.prerequisites.length > 0
      ? [
          `Necesitas en tu PATH: ${mcp.prerequisites.map((r) => `<a href="${e(PREREQUISITES[r].url)}">${e(PREREQUISITES[r].label)}</a>`).join(', ')}.`,
        ]
      : []),
    `VS Code te pedirá confiar en el servidor e iniciarlo${local ? ' (se ejecuta en tu máquina)' : ''}. Credenciales: ${e(mcp.credentials)}.`,
    ...(mcp.operate ? ['Para que Copilot pueda hacer cambios, cambia el modo a <b>Operar</b> en la galería; antes te avisa de lo que implica.'] : []),
    `Pídeselo a Copilot en modo Agent, por ejemplo: <q>${e(mcp.example)}</q>`,
  ];
  const manual = JSON.stringify({ inputs: mcp.inputs, servers: mcp.servers }, null, 2);
  return (
    `<section class="pw-howto"><h2>Cómo usarlo</h2><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` +
    `<h3>Servidores a mano</h3><p>Sin SDD Studio, copia esto en <code>.vscode/mcp.json</code> (modo Solo lectura):</p>` +
    `<pre><code>${e(manual)}</code></pre></section>`
  );
}

export function buildSite(opts: { siteDir: string; outDir: string; catalog: Catalog; assets?: Record<string, string> }): void {
  const { siteDir, outDir, catalog } = opts;
  mkdirSync(outDir, { recursive: true });
  if (existsSync(siteDir)) cpSync(siteDir, outDir, { recursive: true });
  for (const [target, source] of Object.entries(opts.assets ?? {})) copyFileSync(source, join(outDir, target));

  const landing = join(outDir, 'index.html');
  if (existsSync(landing)) writeFileSync(landing, readFileSync(landing, 'utf8').replace(TEASER_MARKER, renderTeaserChips(catalog.powers)));

  const dir = join(outDir, 'powers');
  mkdirSync(dir, { recursive: true });
  const hero =
    `<header class="pw-hero">${speccySvg('hero', 84)}<h1>⚡ Powers</h1>` +
    `<p>Skills de la comunidad, adaptados para GitHub Copilot y listos para activar con SDD Studio. Formato abierto Agent Plugins 1.0.</p>` +
    `${renderFilters(catalog.powers)}</header>`;
  writeFileSync(
    join(dir, 'index.html'),
    page('Powers — SDD Studio', hero + renderGrid(catalog.powers, { actions: false, hrefFor: (id) => `${id}.html` }), FILTER_SCRIPT),
  );
  for (const p of catalog.powers) {
    writeFileSync(join(dir, `${p.id}.html`), page(`${p.presentation.displayName} — Powers de SDD Studio`, renderPoster(p, { actions: false }) + mcpHowTo(p) + howTo(p)));
  }
  writeFileSync(join(dir, 'catalog-v2.json'), `${JSON.stringify(catalog)}\n`);
  writeFileSync(join(dir, 'catalog.json'), `${JSON.stringify(catalogV1(catalog))}\n`);
}

function main(): void {
  const result = validateCatalog(JSON.parse(readFileSync('dist/catalog.json', 'utf8')));
  if (!result.ok) {
    console.error(`✗ dist/catalog.json inválido:\n- ${result.errors.join('\n- ')}`);
    process.exit(1);
  }
  buildSite({ siteDir: 'site', outDir: '_site', catalog: result.value, assets: { 'speccy.svg': 'media/speccy.svg' } });
  console.log(`✓ Sitio generado en _site/ (${result.value.powers.length} Powers)`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/build-site.ts')) main();
