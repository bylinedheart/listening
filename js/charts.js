// Inline SVG charts. No libraries.
import { esc } from './util.js';

/** Bar with rounded top corners, flat on the baseline. */
function barPath(x, y, w, h, r = 3) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Vertical bar chart.
 * data: [{ label, value, readout }], one series.
 * Tapping or hovering a bar shows its readout in the element with [data-readout] in the same panel.
 */
export function columnChart(data, { height = 120, activeIndex = data.length - 1, id = 'chart' } = {}) {
  const W = 320, H = height, top = 14, bottom = 18, left = 2, right = 2;
  const n = data.length;
  const slot = (W - left - right) / n;
  const gap = Math.max(2, slot * 0.28);
  const bw = slot - gap;
  const max = Math.max(1, ...data.map((d) => d.value));
  const ph = H - top - bottom;
  const yOf = (v) => top + ph - (v / max) * ph;

  const bars = data.map((d, i) => {
    const x = left + i * slot + gap / 2;
    const h = (d.value / max) * ph;
    const active = i === activeIndex ? ' is-active' : '';
    const shape = d.value > 0
      ? `<path class="bar${active}" d="${barPath(x, top + ph - h, bw, h)}"/>`
      : `<rect class="bar-zero" x="${x}" y="${top + ph - 1.5}" width="${bw}" height="1.5"/>`;
    return `<g data-i="${i}" data-readout-text="${esc(d.readout)}">
      ${shape}
      <text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="9.5">${esc(d.label)}</text>
      <rect class="hit" x="${left + i * slot}" y="0" width="${slot}" height="${H}"><title>${esc(d.readout)}</title></rect>
    </g>`;
  }).join('');

  return `<svg class="chart" id="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(data.map((d) => d.readout).join('; '))}">
    <line class="grid" x1="0" x2="${W}" y1="${yOf(max)}" y2="${yOf(max)}" stroke-dasharray="2 3"/>
    <text x="${W - 2}" y="${yOf(max) - 4}" text-anchor="end" font-size="9">${max}</text>
    <line class="grid" x1="0" x2="${W}" y1="${top + ph + 0.5}" y2="${top + ph + 0.5}"/>
    ${bars}
  </svg>`;
}

/** Wire hover/tap on a columnChart to its panel readout. */
export function bindColumnChart(svg) {
  if (!svg) return;
  const panel = svg.closest('.panel');
  const out = panel && panel.querySelector('[data-readout]');
  const select = (g) => {
    svg.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
    const bar = g.querySelector('.bar');
    if (bar) bar.classList.add('is-active');
    if (out) out.textContent = g.dataset.readoutText;
  };
  svg.addEventListener('pointerover', (e) => { const g = e.target.closest('g[data-i]'); if (g) select(g); });
  svg.addEventListener('click', (e) => { const g = e.target.closest('g[data-i]'); if (g) select(g); });
}

/** Horizontal bars as a list: name, inline SVG bar, count. */
export function barList(items, { limit = 6, empty = 'Nothing yet.' } = {}) {
  const top = items.slice(0, limit);
  if (!top.length) return `<p class="muted small">${esc(empty)}</p>`;
  const max = top[0].n;
  return `<ol class="hbars">${top.map((it) => `
    <li class="hbar">
      <span class="hbar-name" title="${esc(it.name)}">${esc(it.name)}</span>
      <svg aria-hidden="true">
        <rect class="track" x="0" y="4" width="100%" height="2" rx="1"/>
        <rect x="0" y="1" width="${Math.max(3, (it.n / max) * 100)}%" height="8" rx="2"/>
      </svg>
      <span class="hbar-n">${it.n}</span>
    </li>`).join('')}</ol>`;
}
