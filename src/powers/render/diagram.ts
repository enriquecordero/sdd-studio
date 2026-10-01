import { Diagram, DiagramNode, SplitColumn, Tone } from '../types';
import { escapeHtml as e } from './escape';

export const TONE_COLORS: Record<Tone, string> = {
  red: '#ff7a90',
  green: '#80ffb5',
  blue: '#8dc8fb',
  accent: '#b080ff',
  warn: '#ffd27a',
};
const MUTED = '#9a92a6';
const color = (t?: Tone) => TONE_COLORS[t ?? 'accent'];
const f = (n: number) => Number(n.toFixed(1)).toString();

function svg(uid: string, width: number, height: number, label: string, body: string): string {
  return (
    `<svg class="pw-diagram" viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${e(label)}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><marker id="pw-arrow-${e(uid)}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${MUTED}"/></marker></defs>` +
    `${body}</svg>`
  );
}

const arrow = (uid: string, x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${MUTED}" stroke-width="1.5" marker-end="url(#pw-arrow-${e(uid)})"/>`;

function cycle(nodes: DiagramNode[], uid: string): string {
  const cx = 160;
  const cy = 120;
  const R = 82;
  const r = 32;
  const pts = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  let body = '';
  nodes.forEach((n, i) => {
    const p = pts[i];
    const q = pts[(i + 1) % nodes.length];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const x1 = p.x + (dx / len) * (r + 4);
    const y1 = p.y + (dy / len) * (r + 4);
    const x2 = q.x - (dx / len) * (r + 8);
    const y2 = q.y - (dy / len) * (r + 8);
    body += arrow(uid, x1, y1, x2, y2);
    if (n.edge) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const ox = mx - cx;
      const oy = my - cy;
      const ol = Math.hypot(ox, oy) || 1;
      body += `<text class="pw-edge" x="${f(mx + (ox / ol) * 14)}" y="${f(my + (oy / ol) * 14)}" text-anchor="middle">${e(n.edge)}</text>`;
    }
  });
  nodes.forEach((n, i) => {
    const p = pts[i];
    const c = color(n.tone);
    body += `<circle class="pw-node" cx="${f(p.x)}" cy="${f(p.y)}" r="${r}" fill="${c}26" stroke="${c}" stroke-width="1.5"/>`;
    body += `<text class="pw-label" x="${f(p.x)}" y="${f(p.y + 4)}" text-anchor="middle" fill="${c}">${e(n.label)}</text>`;
  });
  return svg(uid, 320, 240, nodes.map((n) => n.label).join(' → '), body);
}

function steps(nodes: DiagramNode[], uid: string): string {
  const w = 104;
  const h = 52;
  const gap = 30;
  const top = 8;
  const width = nodes.length * w + (nodes.length - 1) * gap;
  let body = '';
  nodes.forEach((n, i) => {
    const x = i * (w + gap);
    const c = color(n.tone);
    body += `<rect class="pw-node" x="${f(x)}" y="${top}" width="${w}" height="${h}" rx="10" fill="${c}1f" stroke="${c}" stroke-width="1.5"/>`;
    body += `<text class="pw-label" x="${f(x + w / 2)}" y="${f(top + h / 2 + 4)}" text-anchor="middle" fill="${c}">${e(n.label)}</text>`;
    if (i < nodes.length - 1) body += arrow(uid, x + w + 3, top + h / 2, x + w + gap - 5, top + h / 2);
    if (n.edge) body += `<text class="pw-edge" x="${f(x + w / 2)}" y="${f(top + h + 20)}" text-anchor="middle">${e(n.edge)}</text>`;
  });
  return svg(uid, width, 92, nodes.map((n) => n.label).join(' → '), body);
}

function funnel(nodes: DiagramNode[], uid: string): string {
  const width = 320;
  const rowH = 44;
  const widest = 300;
  const narrowest = 120;
  const step = nodes.length > 1 ? (widest - narrowest) / (nodes.length - 1) : 0;
  let body = '';
  nodes.forEach((n, i) => {
    const wTop = widest - step * i;
    const wBottom = i === nodes.length - 1 ? wTop - 20 : wTop - step;
    const y = 4 + i * rowH;
    const c = color(n.tone);
    const x0 = (width - wTop) / 2;
    const x1 = (width - wBottom) / 2;
    body += `<polygon class="pw-node" points="${f(x0)},${f(y)} ${f(x0 + wTop)},${f(y)} ${f(x1 + wBottom)},${f(y + rowH - 6)} ${f(x1)},${f(y + rowH - 6)}" fill="${c}1f" stroke="${c}" stroke-width="1.5"/>`;
    const edge = n.edge ? ` <tspan class="pw-edge">· ${e(n.edge)}</tspan>` : '';
    body += `<text class="pw-label" x="${width / 2}" y="${f(y + (rowH - 6) / 2 + 4)}" text-anchor="middle" fill="${c}">${e(n.label)}${edge}</text>`;
  });
  return svg(uid, width, nodes.length * rowH + 8, nodes.map((n) => n.label).join(' → '), body);
}

function split(columns: SplitColumn[], uid: string): string {
  const colW = 150;
  const gap = 20;
  const lineH = 18;
  const rows = Math.max(...columns.map((c) => c.items.length));
  const height = 46 + rows * lineH + 12;
  let body = '';
  columns.forEach((col, i) => {
    const x = i * (colW + gap);
    const c = color(col.tone);
    body += `<rect class="pw-node" x="${f(x)}" y="2" width="${colW}" height="${f(height - 4)}" rx="10" fill="${c}14" stroke="${c}" stroke-width="1.5"/>`;
    body += `<text class="pw-label" x="${f(x + colW / 2)}" y="26" text-anchor="middle" fill="${c}">${e(col.label)}</text>`;
    col.items.forEach((item, j) => {
      body += `<text class="pw-item" x="${f(x + 12)}" y="${f(52 + j * lineH)}">• ${e(item)}</text>`;
    });
  });
  return svg(uid, colW * 2 + gap, height, columns.map((c) => c.label).join(' / '), body);
}

export function renderDiagram(d: Diagram, uid = '0'): string {
  switch (d.kind) {
    case 'cycle':
      return cycle(d.nodes, uid);
    case 'steps':
      return steps(d.nodes, uid);
    case 'funnel':
      return funnel(d.nodes, uid);
    case 'split':
      return split(d.columns, uid);
  }
}
