// Inline SVG charts. No libraries.
import { esc, colorVar } from './util.js';

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
    <li class="hbar" style="--bar-c:${colorVar(it.name)}">
      <span class="hbar-name" title="${esc(it.name)}">${esc(it.name)}</span>
      <svg aria-hidden="true">
        <rect class="track" x="0" y="4" width="100%" height="2" rx="1"/>
        <rect x="0" y="1" width="${Math.max(3, (it.n / max) * 100)}%" height="8" rx="2"/>
      </svg>
      <span class="hbar-n">${it.n}</span>
    </li>`).join('')}</ol>`;
}

const PALETTE_ORDER = ['pink', 'yellow', 'cyan', 'green', 'orange', 'violet'];

/**
 * Give each shown genre its usual colour (the one its chips use) unless an
 * earlier, bigger genre already took it; then use the next free colour.
 */
function assignColors(names) {
  const used = new Set();
  return names.map((name) => {
    let c = colorVar(name).match(/--c-(\w+)/)[1];
    if (used.has(c)) c = PALETTE_ORDER.find((p) => !used.has(p)) || c;
    used.add(c);
    return `var(--c-${c})`;
  });
}

/** Part-to-whole bar of genres with a legend. data = genreBreakdown(). */
export function genreChart(data, { limit = 6 } = {}) {
  if (!data.items.length) return '<p class="muted small">Add genres to your listens to see this.</p>';
  const top = data.items.slice(0, limit);
  const rest = data.items.slice(limit);
  const colors = assignColors(top.map((g) => g.name));
  const rows = top.map((g, i) => ({ ...g, color: colors[i] }));
  if (rest.length) {
    rows.push({
      name: `Other (${rest.length})`, other: true, color: 'var(--star-off)',
      share: rest.reduce((s, g) => s + g.share, 0), n: null,
    });
  }
  const pct = (v) => `${Math.round(v * 100)}%`;
  let x = 0;
  const segs = rows.map((r, i) => {
    const w = r.share * 100;
    const seg = `<rect class="gseg" data-g="${i}" x="${x}%" y="0" width="${w}%" height="100%" style="fill:${r.color}"><title>${esc(r.name)}: ${pct(r.share)}</title></rect>`;
    x += w;
    return seg;
  });
  // Dividers between segments, drawn on top so every segment keeps a visible edge.
  let acc = 0;
  const lines = rows.slice(0, -1).map((r) => { acc += r.share * 100; return `<line x1="${acc}%" x2="${acc}%" y1="0" y2="100%"/>`; });
  return `
    <svg class="gbar" role="img" aria-label="${esc(rows.map((r) => `${r.name} ${pct(r.share)}`).join(', '))}">
      ${segs.join('')}<g class="gdiv">${lines.join('')}</g>
    </svg>
    <ul class="glegend">${rows.map((r, i) => `
      <li><button type="button" class="grow" data-g="${i}">
        <span class="gswatch" style="background:${r.color}"></span>
        <span class="gname">${esc(r.name)}</span>
        <span class="gn">${r.n === null ? '' : `${r.n} ${r.n === 1 ? 'listen' : 'listens'}`}</span>
        <span class="gpct">${pct(r.share)}</span>
      </button></li>`).join('')}
    </ul>`;
}

/** Tap or hover a segment or legend row to pick it out. */
export function bindGenreChart(panel) {
  if (!panel) return;
  let pinned = null;
  const show = (i) => {
    panel.classList.toggle('has-focus', i !== null);
    panel.querySelectorAll('[data-g]').forEach((el) => el.classList.toggle('is-on', el.dataset.g === i));
  };
  panel.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-g]'); if (t && pinned === null) show(t.dataset.g); });
  panel.addEventListener('pointerleave', () => { if (pinned === null) show(null); });
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-g]');
    pinned = t && pinned !== t.dataset.g ? t.dataset.g : null;
    show(pinned);
  });
}
