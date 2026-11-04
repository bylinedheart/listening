import * as store from './store.js';
import { SHELVES, shelfLabel } from './store.js';
import { makeSamples } from './seed.js';
import { starsHTML, starInputHTML, installStarInputs } from './stars.js';
import { searchAlbums, searchSongs, albumDetails, songDetails } from './lookup.js';
import { computeStats, logged } from './stats.js';
import { columnChart, bindColumnChart, barList } from './charts.js';
import {
  esc, todayISO, fmtDate, fmtLongDate, monthKey, monthLabel, monthShort, topbarDate,
  daysAgo, relDays, fmtRating, fmtLen, coverHTML, cmpText, debounce, parseISO, colorVar,
} from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');
const sheet = $('#sheet');

const ui = {
  shelf: 'now',
  q: '', artist: '', tag: '', rating: '', type: '',
};
try { Object.assign(ui, JSON.parse(sessionStorage.getItem('listening.ui') || '{}')); } catch { /* ignore */ }
const saveUI = () => { try { sessionStorage.setItem('listening.ui', JSON.stringify(ui)); } catch { /* ignore */ } };

const ICON = {
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
};

// ---------------------------------------------------------------- routing
const VIEWS = { shelves: renderShelves, history: renderHistory, stats: renderStats, data: renderData };
const currentView = () => (location.hash.slice(1) in VIEWS ? location.hash.slice(1) : 'shelves');

function render() {
  const name = currentView();
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#topbar-date').textContent = topbarDate();
  VIEWS[name]();
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  t.classList.toggle('has-action', !!action);
  t.classList.add('is-on');
  if (action) t.querySelector('button').onclick = () => { action.run(); t.classList.remove('is-on'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), action ? 6000 : 2400);
}

// ---------------------------------------------------------------- shared bits
function itemMeta(e) {
  const bits = [];
  if (e.shelf === 'done' && e.date) bits.push(fmtDate(e.date));
  if (e.year) bits.push(e.year);
  if (e.tags.length) bits.push(e.tags.slice(0, 2).join(', '));
  return bits.map((b) => `<span>${esc(b)}</span>`).join('<span aria-hidden="true">·</span>');
}

function itemCard(e) {
  const side = [];
  if (e.sample) side.push('<span class="badge">Sample</span>');
  else if (e.type === 'song') side.push('<span class="badge badge-type">Song</span>');
  if (e.rating) side.push(starsHTML(e.rating, 'xs'));
  return `<li><button type="button" class="item" data-open="${esc(e.id)}">
    ${coverHTML(e)}
    <span class="item-main">
      <span class="item-title">${esc(e.title)}</span>
      <span class="item-artist">${esc(e.artist || 'Unknown artist')}</span>
      <span class="item-meta">${itemMeta(e)}</span>
    </span>
    <span class="item-side">${side.join('')}</span>
  </button></li>`;
}

function backupNotice() {
  const m = store.meta();
  if (!store.userEntries().length || !store.hasUnexported()) return '';
  const d = daysAgo(m.lastExport);
  if (d !== null && d < 7) return '';
  const text = d === null ? 'Not exported yet. Save a backup file.' : `Last exported ${relDays(d).toLowerCase()}.`;
  return `<div class="notice"><p>${esc(text)}</p><button type="button" class="btn btn-sm" data-act="export">Export</button></div>`;
}

function sampleNotice() {
  const n = store.samples().length;
  if (!n) return '';
  return `<div class="notice notice-plain"><p>${n} sample ${n === 1 ? 'entry is' : 'entries are'} shown.</p>
    <button type="button" class="btn btn-sm" data-act="remove-samples">Remove samples</button></div>`;
}

// ---------------------------------------------------------------- Shelves
function shelfSort(shelf) {
  return shelf === 'done'
    ? (a, b) => (b.date || '').localeCompare(a.date || '') || b.updated.localeCompare(a.updated)
    : (a, b) => b.updated.localeCompare(a.updated);
}

function renderShelves() {
  const entries = store.all();
  const tabs = SHELVES.map((s) => {
    const n = entries.filter((e) => e.shelf === s.id).length;
    const sel = ui.shelf === s.id;
    return `<button type="button" class="shelf-tab" role="tab" id="tab-${s.id}" aria-selected="${sel}" aria-controls="shelf-panel" data-shelf="${s.id}">
      <span class="shelf-tab-count">${n}</span><span class="shelf-tab-name">${s.label}</span></button>`;
  }).join('');
  const items = entries.filter((e) => e.shelf === ui.shelf).sort(shelfSort(ui.shelf));
  const emptyText = {
    now: ['Nothing playing right now.', 'Add an album'],
    want: ['Nothing saved for later.', 'Add an album'],
    done: ['No listens logged yet.', 'Log a listen'],
  }[ui.shelf];
  view.innerHTML = `
    ${backupNotice()}
    ${sampleNotice()}
    <div class="shelf-tabs" role="tablist" aria-label="Shelves">${tabs}</div>
    <div id="shelf-panel" role="tabpanel" aria-labelledby="tab-${ui.shelf}">
      ${items.length
        ? `<ul class="list">${items.map(itemCard).join('')}</ul>`
        : `<div class="empty"><p>${emptyText[0]}</p><button type="button" class="btn btn-ink" data-act="add" data-shelf-preset="${ui.shelf}">${emptyText[1]}</button></div>`}
    </div>`;
}

// ---------------------------------------------------------------- History
const RATING_FILTERS = [
  ['', 'Any rating'], ['5', '5 stars'], ['4.5', '4.5 and up'], ['4', '4 and up'], ['3', '3 and up'],
  ['2', '2 and up'], ['low', 'Under 2'], ['none', 'Unrated'],
];

function matchesRating(e, f) {
  if (!f) return true;
  if (f === 'none') return !e.rating;
  if (f === 'low') return e.rating > 0 && e.rating < 2;
  return e.rating >= Number(f);
}

function historyItems() {
  const q = ui.q.trim().toLowerCase();
  return logged(store.all())
    .filter((e) => !ui.artist || e.artist === ui.artist)
    .filter((e) => !ui.tag || e.tags.includes(ui.tag))
    .filter((e) => !ui.type || e.type === ui.type)
    .filter((e) => matchesRating(e, ui.rating))
    .filter((e) => !q || [e.title, e.artist, e.album, e.note, e.producer, e.label, ...e.tags, ...e.tracks.map((t) => t.title)]
      .join('\n').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated));
}

function renderHistory() {
  const all = logged(store.all());
  const artists = [...new Set(all.map((e) => e.artist).filter(Boolean))].sort(cmpText);
  const tags = [...new Set(all.flatMap((e) => e.tags))].sort(cmpText);
  if (ui.artist && !artists.includes(ui.artist)) ui.artist = '';
  if (ui.tag && !tags.includes(ui.tag)) ui.tag = '';
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;

  view.innerHTML = `
    <div class="filters">
      <label class="search">
        <span class="sr-only">Search history</span>
        ${ICON.search}
        <input class="input" type="search" id="h-q" placeholder="Search titles, artists, notes" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search">
      </label>
      <div class="filter-row">
        <label><span class="sr-only">Artist</span><select class="select" id="h-artist">${opt('', 'All artists', ui.artist)}${artists.map((a) => opt(a, a, ui.artist)).join('')}</select></label>
        <label><span class="sr-only">Tag</span><select class="select" id="h-tag">${opt('', 'All tags', ui.tag)}${tags.map((t) => opt(t, t, ui.tag)).join('')}</select></label>
        <label><span class="sr-only">Rating</span><select class="select" id="h-rating">${RATING_FILTERS.map(([v, l]) => opt(v, l, ui.rating)).join('')}</select></label>
      </div>
      <div class="result-line"><span id="h-count"></span><button type="button" class="linkish" id="h-clear" hidden>Clear filters</button></div>
    </div>
    <div id="h-list"></div>`;

  const update = () => {
    const items = historyItems();
    const filtered = ui.q || ui.artist || ui.tag || ui.rating;
    $('#h-count').textContent = filtered ? `${items.length} of ${all.length} listens` : `${all.length} ${all.length === 1 ? 'listen' : 'listens'}`;
    $('#h-clear').hidden = !filtered;
    $('#h-list').innerHTML = items.length ? groupByMonth(items) : `<div class="empty"><p>${all.length ? 'No listens match.' : 'No listens logged yet.'}</p></div>`;
    saveUI();
  };
  $('#h-q').addEventListener('input', debounce((e) => { ui.q = e.target.value; update(); }, 120));
  $('#h-artist').addEventListener('change', (e) => { ui.artist = e.target.value; update(); });
  $('#h-tag').addEventListener('change', (e) => { ui.tag = e.target.value; update(); });
  $('#h-rating').addEventListener('change', (e) => { ui.rating = e.target.value; update(); });
  $('#h-clear').addEventListener('click', () => { Object.assign(ui, { q: '', artist: '', tag: '', rating: '' }); renderHistory(); });
  update();
}

function groupByMonth(items) {
  const groups = new Map();
  items.forEach((e) => {
    const k = monthKey(e.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  });
  return [...groups].map(([k, list]) => `
    <section class="month">
      <div class="month-head"><h3>${monthLabel(k, true)}</h3><span>${list.length}</span></div>
      ${list.map((e) => `<button type="button" class="hrow" data-open="${esc(e.id)}">
        <span class="hrow-date"><b>${parseISO(e.date).getDate()}</b>${monthShort(k)}</span>
        ${coverHTML(e, 'xs')}
        <span class="hrow-main">
          <span class="hrow-title">${esc(e.title)}${e.sample ? ' <span class="badge">Sample</span>' : ''}</span>
          <span class="hrow-sub">${esc(e.artist)}${e.type === 'song' ? ' · Song' : ''}${e.tags.length ? ' · ' + esc(e.tags.join(', ')) : ''}</span>
        </span>
        ${e.rating ? starsHTML(e.rating, 'xs') : '<span class="muted small">–</span>'}
      </button>`).join('')}
    </section>`).join('');
}

// ---------------------------------------------------------------- Stats
function renderStats() {
  const s = computeStats(store.all());
  if (!s.total) {
    view.innerHTML = `<div class="view-head"><h2 class="view-title">Stats</h2></div>
      <div class="empty"><p>Stats appear once you log a listen.</p><button type="button" class="btn btn-ink" data-act="add">Log a listen</button></div>`;
    return;
  }
  const monthData = s.months.map((m) => ({
    label: monthShort(m.key).slice(0, 1),
    value: m.n,
    readout: `${monthLabel(m.key)} · ${m.n} ${m.n === 1 ? 'listen' : 'listens'}`,
  }));
  const distData = s.dist.map((d) => ({
    label: Number.isInteger(d.r) ? String(d.r) : '·',
    value: d.n,
    readout: `${d.r} stars · ${d.n}`,
  }));
  const topDist = s.dist.reduce((best, d, i) => (d.n > s.dist[best].n ? i : best), 0);
  const st = s.streak;
  view.innerHTML = `
    <div class="view-head"><h2 class="view-title">Stats</h2><span class="view-meta">since ${esc(fmtDate(s.first))}</span></div>
    <div class="tiles">
      <div class="tile"><span class="label">Listens</span><div class="tile-value">${s.total}</div><div class="tile-sub">${s.thisMonth} this month</div></div>
      <div class="tile"><span class="label">Average</span><div class="tile-value">${s.rated ? s.avg.toFixed(2) : '–'}<small>/ 5</small></div><div class="tile-sub">${s.rated} rated</div></div>
      <div class="tile"><span class="label">Streak</span><div class="tile-value">${st.current}<small>${st.current === 1 ? 'day' : 'days'}</small></div><div class="tile-sub">${st.current ? (st.activeToday ? 'Logged today' : 'Log today to keep it') : 'No current streak'}</div></div>
      <div class="tile"><span class="label">Longest</span><div class="tile-value">${st.longest}<small>${st.longest === 1 ? 'day' : 'days'}</small></div><div class="tile-sub">Consecutive days</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Listens per month</h3><span class="readout" data-readout>${esc(monthData[monthData.length - 1].readout)}</span></div>
      ${columnChart(monthData, { id: 'chart-months' })}
    </div>
    <div class="panel-pair">
      <div class="panel"><div class="panel-head"><h3>Top artists</h3><span class="readout">${s.artists.length} total</span></div>${barList(s.artists)}</div>
      <div class="panel"><div class="panel-head"><h3>Top tags</h3><span class="readout">${s.tags.length} total</span></div>${barList(s.tags, { empty: 'No tags yet.' })}</div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Ratings</h3><span class="readout" data-readout>${s.rated ? esc(distData[topDist].readout) : 'No ratings yet'}</span></div>
      ${columnChart(distData, { id: 'chart-dist', height: 100, activeIndex: s.rated ? topDist : -1 })}
    </div>`;
  bindColumnChart($('#chart-months'));
  bindColumnChart($('#chart-dist'));
}

// ---------------------------------------------------------------- Data
function renderData() {
  const m = store.meta();
  const d = daysAgo(m.lastExport);
  const stale = store.hasUnexported() && (d === null || d >= 7);
  const all = store.all();
  const counts = SHELVES.map((s) => [s.label, all.filter((e) => e.shelf === s.id).length]);
  const nSamples = store.samples().length;
  const canShare = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
  view.innerHTML = `
    <div class="view-head"><h2 class="view-title">Data</h2><span class="view-meta">Stored on this device</span></div>
    <div class="card">
      <h3>Backup</h3>
      <div class="export-status ${stale ? 'is-stale' : ''}">
        <span class="label">Last exported</span>
        <strong>${m.lastExport ? esc(relDays(d)) : 'Never'}</strong>
        ${m.lastExport ? `<span class="muted small">${esc(fmtLongDate(m.lastExport.slice(0, 10)))}</span>` : ''}
      </div>
      <p>${store.hasUnexported() ? 'You have changes that are not in a backup file.' : 'Your latest changes are in your last backup file.'}
      Data is kept in this browser only. Export a file regularly and keep it somewhere safe.</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-act="export">Export JSON</button>
        ${canShare ? '<button type="button" class="btn" data-act="share">Share file</button>' : ''}
        <button type="button" class="btn" data-act="import">Import JSON</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
    </div>
    <div class="card">
      <h3>Entries</h3>
      <dl class="kv">
        ${counts.map(([l, n]) => `<dt>${l}</dt><dd>${n}</dd>`).join('')}
        <dt>Sample entries</dt><dd>${nSamples}</dd>
      </dl>
      <div class="actions">
        ${nSamples ? '<button type="button" class="btn" data-act="remove-samples">Remove samples</button>' : ''}
        <button type="button" class="btn btn-danger" data-act="erase">Erase all data</button>
      </div>
    </div>
    <p class="muted small">Quick add uses MusicBrainz and the Cover Art Archive. Everything else works offline.</p>`;
  $('#import-file').addEventListener('change', onImportFile);
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const exportName = () => `listening-${todayISO()}.json`;

function doExport() {
  download(store.exportJSON(), exportName());
  store.markExported();
  toast('Backup file saved');
  render();
}
async function doShare() {
  const file = new File([store.exportJSON()], exportName(), { type: 'application/json' });
  try {
    await navigator.share({ files: [file], title: 'Listening backup' });
    store.markExported();
    toast('Backup file shared');
    render();
  } catch (err) {
    if (err.name !== 'AbortError') toast('Sharing failed. Use Export instead.');
  }
}

async function onImportFile(ev) {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  let entries;
  try {
    entries = store.parseImport(await file.text());
  } catch (err) {
    toast(err.message);
    return;
  }
  openSheet('Import backup', `
    <p>${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} found in <strong>${esc(file.name)}</strong>.</p>
    <p class="muted small"><strong>Merge</strong> adds new entries and updates ones you already have.
    <strong>Replace</strong> removes everything on this device first.</p>`,
  `<button type="button" class="btn" data-imp="replace">Replace</button><button type="button" class="btn btn-primary" data-imp="merge">Merge</button>`,
  (root) => {
    $$('[data-imp]', root).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.imp === 'replace' && !confirm(`Replace all ${store.all().length} entries on this device?`)) return;
      store.importEntries(entries, b.dataset.imp);
      closeSheet();
      toast(`Imported ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`);
    }));
  });
}

function removeSamples() {
  const removed = store.remove(store.samples().map((e) => e.id));
  toast(`Removed ${removed.length} sample ${removed.length === 1 ? 'entry' : 'entries'}`, { label: 'Undo', run: () => store.restore(removed) });
}

// ---------------------------------------------------------------- Sheet
function openSheet(title, body, foot, mount, { tall = false } = {}) {
  sheet.classList.toggle('sheet-tall', tall);
  sheet.innerHTML = `
    <div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close">${ICON.close}</button></div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  if (!sheet.open) sheet.showModal();
  $('.sheet-body', sheet).scrollTop = 0;
  if (mount) mount(sheet);
}
function closeSheet() { if (sheet.open) sheet.close(); }

// Keep the sheet inside the visible area when the on-screen keyboard is open.
// iOS Safari does not resize the layout viewport for the keyboard, so fixed
// elements at bottom: 0 end up behind it.
function trackViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const below = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    document.documentElement.style.setProperty('--vv-h', `${vv.height}px`);
    document.documentElement.style.setProperty('--vv-bottom', `${below}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}
trackViewport();
sheet.addEventListener('focusin', (e) => {
  if (!e.target.matches('input, textarea, select')) return;
  setTimeout(() => e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300);
});
sheet.addEventListener('click', (e) => {
  if (e.target === sheet || e.target.closest('[data-close]')) closeSheet();
});
sheet.addEventListener('close', () => { sheet.innerHTML = ''; render(); });

// ---------------------------------------------------------------- Detail
function openDetail(id) {
  const e = store.get(id);
  if (!e) return;
  const meta = [e.type === 'song' ? 'Song' : 'Album', e.year, e.album && `from ${e.album}`, e.label].filter(Boolean).join(' · ');
  const rated = e.tracks.filter((t) => t.rating);
  const trackAvg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : '';
  const body = `
    <div class="detail-head">
      ${coverHTML(e, 'lg')}
      <div style="min-width:0">
        <h3 class="detail-title">${esc(e.title)}</h3>
        <p class="detail-artist">${esc(e.artist || 'Unknown artist')}</p>
        <div class="detail-meta">${esc(meta)}${e.producer ? `<br>Produced by ${esc(e.producer)}` : ''}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="label">Shelf</span>${e.sample ? '<span class="badge">Sample</span>' : ''}</div>
      <div class="seg seg-full" role="group" aria-label="Move to shelf">
        ${SHELVES.map((s) => `<button type="button" data-move="${s.id}" aria-pressed="${e.shelf === s.id}">${s.label}</button>`).join('')}
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="label">Rating</span>${e.shelf === 'done' && e.date ? `<span class="muted small">${esc(fmtLongDate(e.date))}</span>` : ''}</div>
      <div class="rating-field">${starInputHTML(e.rating, { key: 'main' })}<span class="rating-value">${fmtRating(e.rating)}</span></div>
    </div>
    ${e.note || e.tags.length ? `<div class="section">
      ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
      ${e.tags.length ? `<div class="chips" style="margin-top:${e.note ? 8 : 0}px">${e.tags.map((t) => `<span class="chip chip-static" style="--chip:${colorVar(t)}">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>` : ''}
    ${e.tracks.length ? `<div class="section">
      <div class="section-head"><span class="label">Tracks · ${e.tracks.length}</span><span class="muted small" id="track-avg">${trackAvg ? `Track average ${trackAvg}` : 'Tap stars to rate'}</span></div>
      <ol class="tracks">${e.tracks.map((t, i) => `<li class="track">
        <span class="track-n">${i + 1}</span>
        <span class="track-title">${esc(t.title)}${t.length ? `<span class="track-len">${fmtLen(t.length)}</span>` : ''}</span>
        ${starInputHTML(t.rating, { size: 'sm', label: `Rate ${t.title}`, key: `t${i}` })}
      </li>`).join('')}</ol>
    </div>` : ''}`;
  const foot = `
    <button type="button" class="btn btn-danger" data-d="delete">Delete</button>
    ${e.shelf === 'done' ? '<button type="button" class="btn" data-d="again">Log again</button>' : '<button type="button" class="btn" data-d="log">Log listen</button>'}
    <button type="button" class="btn btn-ink" data-d="edit">Edit</button>`;

  openSheet(e.type === 'song' ? 'Song' : 'Album', body, foot, (root) => {
    $$('[data-move]', root).forEach((b) => b.addEventListener('click', () => {
      const shelf = b.dataset.move;
      const cur = store.get(id);
      store.patch(id, { shelf, date: shelf === 'done' && !cur.date ? todayISO() : cur.date });
      openDetail(id);
    }));
    root.addEventListener('rate', onDetailRate);
    $('[data-d="delete"]', root).addEventListener('click', () => {
      const removed = store.remove(id);
      closeSheet();
      toast(`Deleted “${e.title}”`, { label: 'Undo', run: () => store.restore(removed) });
    });
    $('[data-d="edit"]', root).addEventListener('click', () => openForm({ id }));
    $('[data-d="again"], [data-d="log"]', root).addEventListener('click', (ev) => {
      if (ev.currentTarget.dataset.d === 'log') {
        store.patch(id, { shelf: 'done', date: todayISO() });
        toast('Logged');
        openDetail(id);
        return;
      }
      const { id: _old, created, updated, sample, ...copy } = store.get(id);
      openForm({ preset: { ...copy, date: todayISO(), rating: 0, note: '', shelf: 'done', tracks: copy.tracks.map((t) => ({ ...t, rating: 0 })) } });
    });
  });

  function onDetailRate(ev) {
    const key = ev.target.dataset.stars;
    const cur = store.get(id);
    if (key === 'main') {
      store.patch(id, { rating: ev.detail });
    } else if (key && key[0] === 't') {
      const i = Number(key.slice(1));
      const tracks = cur.tracks.map((t, j) => (j === i ? { ...t, rating: ev.detail } : t));
      store.patch(id, { tracks });
      const r = tracks.filter((t) => t.rating);
      $('#track-avg', sheet).textContent = r.length ? `Track average ${(r.reduce((s, t) => s + t.rating, 0) / r.length).toFixed(1)}` : 'Tap stars to rate';
    }
  }
  if (e.tracks.length) sheet.classList.add('sheet-tall');
}

// ---------------------------------------------------------------- Form
function openForm({ id, preset } = {}) {
  const existing = id && store.get(id);
  const draft = existing ? structuredClone(existing) : {
    type: 'album', title: '', artist: '', album: '', date: todayISO(), shelf: 'done', rating: 0,
    note: '', tags: [], year: '', producer: '', label: '', cover: '', tracks: [], mbid: '', ...preset,
  };
  const qa = { kind: draft.type, results: [], status: '', busy: false };

  const quickHTML = () => `
    <div class="quick">
      <div class="quick-top">
        <span class="label">Quick add</span>
        <div class="seg" role="group" aria-label="Search for">
          <button type="button" data-qk="album" aria-pressed="${qa.kind === 'album'}">Album</button>
          <button type="button" data-qk="song" aria-pressed="${qa.kind === 'song'}">Song</button>
        </div>
      </div>
      <div class="quick-row">
        <input class="input" type="search" id="qa-q" placeholder="${qa.kind === 'album' ? 'Album title or artist' : 'Song title or artist'}" autocomplete="off" enterkeyhint="search" aria-label="Search">
        <button type="button" class="btn btn-ink" id="qa-go">Search</button>
      </div>
      <div class="quick-status" id="qa-status" role="status"></div>
      <ul class="results" id="qa-results"></ul>
    </div>`;

  const suggestions = () => store.allTags().filter((t) => !draft.tags.includes(t)).slice(0, 10);

  const bodyHTML = () => `
    <div class="form-cover">
      <span id="f-cover">${coverHTML(draft, 'lg')}</span>
      <div class="stack">
        <div class="field"><label class="label" for="f-title">Title</label>
          <input class="input" id="f-title" name="title" value="${esc(draft.title)}" autocomplete="off" required></div>
        <div class="field"><label class="label" for="f-artist">Artist</label>
          <input class="input" id="f-artist" name="artist" value="${esc(draft.artist)}" autocomplete="off" list="artist-list"></div>
      </div>
    </div>
    <datalist id="artist-list">${[...new Set(store.all().map((e) => e.artist))].filter(Boolean).sort(cmpText).map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
    <div class="grid2">
      <div class="field"><label class="label" for="f-type">Type</label>
        <select class="select" id="f-type" name="type">
          <option value="album"${draft.type === 'album' ? ' selected' : ''}>Album</option>
          <option value="song"${draft.type === 'song' ? ' selected' : ''}>Song</option>
        </select></div>
      <div class="field"><label class="label" for="f-shelf">Shelf</label>
        <select class="select" id="f-shelf" name="shelf">${SHELVES.map((s) => `<option value="${s.id}"${draft.shelf === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label class="label" for="f-date">Date</label>
        <input class="input" type="date" id="f-date" name="date" value="${esc(draft.date)}" max="${todayISO()}"></div>
      <div class="field"><label class="label" for="f-year">Released</label>
        <input class="input" id="f-year" name="year" value="${esc(draft.year)}" inputmode="numeric" maxlength="4" placeholder="Year"></div>
    </div>
    <div class="field">
      <span class="label" id="f-rating-label">Rating</span>
      <div class="rating-field">${starInputHTML(draft.rating, { key: 'main', label: 'Rating' })}<span class="rating-value">${fmtRating(draft.rating)}</span></div>
    </div>
    <div class="field"><label class="label" for="f-tags">Tags</label>
      <input class="input" id="f-tags" name="tags" value="${esc(draft.tags.join(', '))}" placeholder="Genre, mood — separate with commas" autocomplete="off" autocapitalize="none">
      <div class="chips" id="f-tag-sugg">${tagChips()}</div></div>
    <div class="field"><label class="label" for="f-note">Note</label>
      <textarea class="textarea" id="f-note" name="note" rows="2" maxlength="280" placeholder="Optional">${esc(draft.note)}</textarea></div>
    <details class="more"${draft.producer || draft.label || draft.album ? ' open' : ''}>
      <summary><span class="label">Credits and cover</span></summary>
      <div class="more-body">
        <div class="field"><label class="label" for="f-producer">Producer</label>
          <input class="input" id="f-producer" name="producer" value="${esc(draft.producer)}" autocomplete="off"></div>
        <div class="grid2">
          <div class="field"><label class="label" for="f-label">Label</label>
            <input class="input" id="f-label" name="label" value="${esc(draft.label)}" autocomplete="off"></div>
          <div class="field"><label class="label" for="f-album">From album</label>
            <input class="input" id="f-album" name="album" value="${esc(draft.album)}" autocomplete="off" placeholder="Songs only"></div>
        </div>
        <div class="field"><label class="label" for="f-cover-url">Cover image URL</label>
          <input class="input" id="f-cover-url" name="cover" value="${esc(draft.cover)}" inputmode="url" autocomplete="off" placeholder="https://"></div>
      </div>
    </details>
    <div class="field" id="f-tracks-wrap"${draft.type === 'song' ? ' hidden' : ''}>
      <div class="section-head"><span class="label">Tracks · ${draft.tracks.length}</span>
        <button type="button" class="btn btn-sm" id="f-add-track">Add track</button></div>
      <ol class="tracks" id="f-tracks">${tracksHTML()}</ol>
    </div>`;

  function tagChips() {
    return suggestions().map((t) => `<button type="button" class="chip" data-tag="${esc(t)}" style="--chip:${colorVar(t)}">+ ${esc(t)}</button>`).join('');
  }
  function tracksHTML() {
    return draft.tracks.map((t, i) => `<li class="track track-edit">
      <span class="track-n">${i + 1}</span>
      <input class="input" data-track-title="${i}" value="${esc(t.title)}" aria-label="Track ${i + 1} title">
      ${starInputHTML(t.rating, { size: 'sm', label: `Rate track ${i + 1}`, key: `t${i}` })}
      <button type="button" class="icon-btn" data-track-del="${i}" aria-label="Remove track ${i + 1}">${ICON.minus}</button>
    </li>`).join('');
  }

  const body = `<form class="form" id="entry-form" novalidate>
      ${existing ? '' : quickHTML()}
      <div class="form" id="f-body">${bodyHTML()}</div>
      <p class="err" id="f-err" hidden></p>
    </form>`;
  const foot = `<button type="button" class="btn" data-close>Cancel</button>
    <button type="submit" class="btn btn-primary" form="entry-form">${existing ? 'Save changes' : 'Save'}</button>`;

  openSheet(existing ? 'Edit entry' : 'Log a listen', body, foot, (root) => {
    const form = $('#entry-form', root);
    const fbody = $('#f-body', root);

    const syncTags = () => {
      draft.tags = $('#f-tags', root).value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      $('#f-tag-sugg', root).innerHTML = tagChips();
    };
    const refreshBody = () => { fbody.innerHTML = bodyHTML(); };

    fbody.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.trackTitle !== undefined) { draft.tracks[Number(t.dataset.trackTitle)].title = t.value; return; }
      if (!t.name) return;
      if (t.name === 'tags') { draft.tags = t.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); return; }
      draft[t.name] = t.value;
      if (t.name === 'title') t.classList.remove('is-invalid');
      if (t.name === 'cover' || t.name === 'title' || t.name === 'artist') $('#f-cover', root).innerHTML = coverHTML(draft, 'lg');
    });
    fbody.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.name === 'type') { draft.type = t.value; $('#f-tracks-wrap', root).hidden = draft.type === 'song'; }
      if (t.name === 'shelf') draft.shelf = t.value;
      if (t.name === 'tags') syncTags();
    });
    fbody.addEventListener('rate', (ev) => {
      const key = ev.target.dataset.stars;
      if (key === 'main') draft.rating = ev.detail;
      else if (key && key[0] === 't') draft.tracks[Number(key.slice(1))].rating = ev.detail;
    });
    fbody.addEventListener('click', (ev) => {
      const tag = ev.target.closest('[data-tag]');
      if (tag) {
        draft.tags.push(tag.dataset.tag);
        $('#f-tags', root).value = draft.tags.join(', ');
        $('#f-tag-sugg', root).innerHTML = tagChips();
        return;
      }
      const del = ev.target.closest('[data-track-del]');
      if (del) {
        draft.tracks.splice(Number(del.dataset.trackDel), 1);
        refreshBody();
        return;
      }
      if (ev.target.closest('#f-add-track')) {
        draft.tracks.push({ title: '', length: 0, rating: 0 });
        refreshBody();
        const inputs = $$('[data-track-title]', root);
        inputs[inputs.length - 1].focus();
      }
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      syncTags();
      if (!draft.title.trim()) {
        const t = $('#f-title', root);
        t.classList.add('is-invalid');
        t.focus();
        const err = $('#f-err', root);
        err.textContent = 'Add a title to save.';
        err.hidden = false;
        return;
      }
      if (draft.type === 'song') draft.tracks = [];
      draft.tracks = draft.tracks.filter((t) => t.title.trim());
      if (draft.shelf === 'done' && !draft.date) draft.date = todayISO();
      const saved = store.upsert(draft);
      const err = store.lastWriteError();
      if (err) { toast('Could not save. Storage may be full.'); return; }
      if (!existing && saved.shelf !== ui.shelf && currentView() === 'shelves') ui.shelf = saved.shelf;
      closeSheet();
      toast(existing ? 'Changes saved' : saved.shelf === 'done' ? 'Listen logged' : `Added to ${shelfLabel(saved.shelf)}`);
    });

    if (existing) return;

    // ----- Quick add
    const qInput = $('#qa-q', root);
    const status = $('#qa-status', root);
    const list = $('#qa-results', root);
    let token = 0;

    const setStatus = (msg) => { status.textContent = msg; status.hidden = !msg; };
    setStatus('');

    $$('[data-qk]', root).forEach((b) => b.addEventListener('click', () => {
      qa.kind = b.dataset.qk;
      $$('[data-qk]', root).forEach((x) => x.setAttribute('aria-pressed', x === b));
      qInput.placeholder = qa.kind === 'album' ? 'Album title or artist' : 'Song title or artist';
      list.innerHTML = '';
      if (qInput.value.trim()) runSearch();
    }));

    async function runSearch() {
      const q = qInput.value.trim();
      if (q.length < 2) { setStatus('Type at least two characters.'); return; }
      const my = ++token;
      setStatus('Searching…');
      list.innerHTML = '';
      try {
        const results = await (qa.kind === 'album' ? searchAlbums(q) : searchSongs(q));
        if (my !== token) return;
        qa.results = results;
        setStatus(results.length ? '' : 'No matches. Try different words, or "title - artist".');
        list.innerHTML = results.map((r, i) => `<li><button type="button" class="result" data-r="${i}">
          ${coverHTML({ title: r.title, artist: r.artist, cover: r.cover }, 'sm')}
          <span style="min-width:0"><span class="result-title" style="display:block">${esc(r.title)}</span>
          <span class="result-sub" style="display:block">${esc(r.artist)}${r.sub ? ' · ' + esc(r.sub) : ''}</span></span>
          <span class="result-year">${esc(r.year)}</span></button></li>`).join('');
      } catch (err) {
        if (my === token) setStatus(err.message);
      }
    }

    $('#qa-go', root).addEventListener('click', runSearch);
    qInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); runSearch(); } });

    list.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-r]');
      if (!b) return;
      const r = qa.results[Number(b.dataset.r)];
      const my = ++token;
      setStatus(`Loading details for “${r.title}”…`);
      $$('.result', list).forEach((x) => { x.disabled = true; });
      let fields;
      try {
        fields = await (r.kind === 'album' ? albumDetails(r) : songDetails(r));
      } catch (err) {
        fields = { type: r.kind, title: r.title, artist: r.artist, year: r.year, cover: r.cover, album: r.album || '', mbid: r.rgid || r.recordingId };
        if (my === token) setStatus(`Filled in the basics. ${err.message}`);
      }
      if (my !== token) return;
      const userTags = draft.tags;
      Object.assign(draft, fields, {
        tags: [...new Set([...userTags, ...(fields.tags || [])])],
        tracks: (fields.tracks || []).map((t) => ({ ...t, rating: 0 })),
      });
      refreshBody();
      list.innerHTML = '';
      qInput.value = '';
      if (status.textContent.startsWith('Loading')) {
        const n = draft.tracks.length;
        setStatus(`Filled in from MusicBrainz${n ? ` with ${n} tracks` : ''}. Check the details, then save.`);
      }
    });
    // Only autofocus with a mouse; on phones, let a tap open the keyboard.
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => qInput.focus({ preventScroll: true }), 50);
  }, { tall: true });
}

// ---------------------------------------------------------------- global actions
document.addEventListener('click', (ev) => {
  const open = ev.target.closest('[data-open]');
  if (open) { openDetail(open.dataset.open); return; }
  const shelf = ev.target.closest('[data-shelf]');
  if (shelf) { ui.shelf = shelf.dataset.shelf; saveUI(); renderShelves(); return; }
  const act = ev.target.closest('[data-act]');
  if (!act) return;
  switch (act.dataset.act) {
    case 'add': openForm({ preset: act.dataset.shelfPreset ? { shelf: act.dataset.shelfPreset } : {} }); break;
    case 'export': doExport(); break;
    case 'share': doShare(); break;
    case 'import': $('#import-file').click(); break;
    case 'remove-samples': removeSamples(); break;
    case 'erase':
      if (confirm('Erase every entry on this device? Export first if you want a copy.')) {
        const removed = store.all().slice();
        store.eraseAll();
        toast('All entries erased', { label: 'Undo', run: () => store.restore(removed) });
      }
      break;
    default:
  }
});
$('#log-btn').addEventListener('click', () => {
  const preset = currentView() === 'shelves' && ui.shelf !== 'done' ? { shelf: ui.shelf } : {};
  openForm({ preset });
});

// ---------------------------------------------------------------- start
installStarInputs(document);
store.seedIfNeeded(makeSamples);
store.subscribe(() => { if (!sheet.open) render(); });
render();
if (store.loadError()) toast('Saved data could not be read. A copy was kept on this device.');

// Re-render when the date changes (e.g. app left open overnight).
let lastDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayISO() !== lastDay) { lastDay = todayISO(); if (!sheet.open) render(); }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Reload once when a new version of the app takes over, so fixes apply right away.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || sheet.open) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => reg && reg.update()).catch((err) => console.warn('Service worker not registered', err));
}
