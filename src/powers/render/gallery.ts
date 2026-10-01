import type { PowerStatus } from '../lock';
import { CATEGORIES, CATEGORY_LABELS, CatalogPower } from '../types';
import { renderCard } from './card';
import { escapeHtml as e } from './escape';

export function renderFilters(powers: CatalogPower[]): string {
  const cats = CATEGORIES.filter((c) => powers.some((p) => p.presentation.category === c));
  return (
    `<div class="pw-filters"><button class="pw-chip pw-on" data-filter="all">Todos (${powers.length})</button>` +
    cats.map((c) => `<button class="pw-chip" data-filter="${c}">${e(CATEGORY_LABELS[c])}</button>`).join('') +
    `<input class="pw-search" type="search" placeholder="Buscar…" aria-label="Buscar Powers"></div>`
  );
}

export function renderGrid(
  powers: CatalogPower[],
  opts: { statuses?: Record<string, PowerStatus>; actions: boolean; hrefFor?: (id: string) => string },
): string {
  if (powers.length === 0) return '<p class="pw-empty">No hay Powers en el catálogo.</p>';
  const card = (p: CatalogPower) =>
    renderCard(p, { status: opts.statuses?.[p.id], actions: opts.actions, detailHref: opts.hrefFor?.(p.id) });
  const statuses = opts.statuses;
  if (!statuses) return `<div class="pw-grid">${powers.map(card).join('')}</div>`;
  const active = powers.filter((p) => statuses[p.id] === 'active' || statuses[p.id] === 'update');
  const rest = powers.filter((p) => !active.includes(p));
  const section = (title: string, list: CatalogPower[]) =>
    list.length > 0 ? `<h3 class="pw-section">${title}</h3><div class="pw-grid">${list.map(card).join('')}</div>` : '';
  return section('ACTIVOS EN ESTE REPO', active) + section('RECOMENDADOS', rest);
}

export function renderTeaserChips(powers: CatalogPower[]): string {
  return powers
    .map(
      (p) =>
        `<a class="chip" href="powers/${e(p.id)}.html">${e(p.presentation.icon)} ${e(p.presentation.displayName)} <small>· ${e(p.presentation.source.repo.split('/')[0])}</small></a>`,
    )
    .join('');
}

/** Filtro por categoría y búsqueda; funciona igual en la web y en el webview. */
export const FILTER_SCRIPT = `(function(){
  var state = { cat: 'all', q: '' };
  function apply(){
    document.querySelectorAll('.pw-card').forEach(function(c){
      var okCat = state.cat === 'all' || c.getAttribute('data-category') === state.cat;
      var okQ = !state.q || (c.getAttribute('data-search') || '').indexOf(state.q) >= 0;
      c.style.display = okCat && okQ ? '' : 'none';
    });
  }
  document.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-filter]') : null;
    if (!b) return;
    state.cat = b.getAttribute('data-filter');
    document.querySelectorAll('[data-filter]').forEach(function(x){ x.classList.toggle('pw-on', x === b); });
    apply();
  });
  document.addEventListener('input', function(ev){
    if (ev.target && ev.target.classList && ev.target.classList.contains('pw-search')) { state.q = ev.target.value.toLowerCase().trim(); apply(); }
  });
})();`;
