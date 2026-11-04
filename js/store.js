// localStorage-backed data store.
import { uid, todayISO } from './util.js';
import { isKnownGenre } from './genres.js';

const KEY = 'listening.v1';
export const SHELVES = [
  { id: 'now', label: 'Listening now' },
  { id: 'want', label: 'Want to hear' },
  { id: 'done', label: 'Logged' },
];
export const shelfLabel = (id) => (SHELVES.find((s) => s.id === id) || SHELVES[2]).label;

const listeners = new Set();

function blank() {
  return { version: 1, entries: [], meta: { seeded: false, lastExport: null, lastChange: null, genresSplit: true } };
}

/** Before genres had their own field they were stored as tags. Move the ones that are clearly genres. */
function splitGenreTags(e) {
  if (e.genres.length) return;
  e.genres = e.tags.filter(isKnownGenre);
  e.tags = e.tags.filter((t) => !isKnownGenre(t));
}

let loadProblem = null;
export const loadError = () => loadProblem;

function safeNormalize(e) {
  try { return normalize(e); } catch (err) { console.warn('Skipped an unreadable entry', err, e); return null; }
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const loaded = {
        version: 1,
        entries: Array.isArray(d.entries) ? d.entries.map(safeNormalize).filter(Boolean) : [],
        meta: { ...blank().meta, ...(d.meta || {}), genresSplit: !!(d.meta && d.meta.genresSplit) },
      };
      if (!loaded.meta.genresSplit) {
        loaded.entries.forEach(splitGenreTags);
        loaded.meta.genresSplit = true;
        try { localStorage.setItem(KEY, JSON.stringify(loaded)); } catch { /* ignore */ }
      }
      return loaded;
    }
  } catch (err) {
    console.error('Could not read saved data', err);
    // Never write over data we could not read: keep a copy and skip the samples.
    if (raw) {
      loadProblem = err;
      try { localStorage.setItem(`${KEY}.unreadable-${Date.now()}`, raw); } catch { /* ignore */ }
      return { ...blank(), meta: { ...blank().meta, seeded: true } };
    }
  }
  return blank();
}

let writeError = null;
function persist(userChange = true) {
  if (userChange) db.meta.lastChange = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    writeError = null;
  } catch (err) {
    writeError = err;
    console.error('Could not save', err);
  }
  listeners.forEach((fn) => fn());
}
export const lastWriteError = () => writeError;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function halfStep(n) {
  const v = Math.round(Number(n) * 2) / 2;
  return Number.isFinite(v) ? Math.min(5, Math.max(0, v)) : 0;
}
function str(v, max = 300) {
  return v == null ? '' : String(v).trim().slice(0, max);
}

function cleanList(v) {
  return [...new Set((Array.isArray(v) ? v : String(v || '').split(','))
    .map((t) => str(t, 40).toLowerCase()).filter(Boolean))].slice(0, 12);
}

/** Coerce anything entry-shaped into a valid entry (or null). */
export function normalize(e) {
  if (!e || typeof e !== 'object') return null;
  const title = str(e.title);
  if (!title) return null;
  const now = new Date().toISOString();
  const shelf = SHELVES.some((s) => s.id === e.shelf) ? e.shelf : 'done';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : (shelf === 'done' ? todayISO() : '');
  return {
    id: str(e.id, 80) || uid(),
    type: e.type === 'song' ? 'song' : 'album',
    title,
    artist: str(e.artist),
    album: str(e.album),
    date,
    shelf,
    rating: halfStep(e.rating),
    note: str(e.note, 1000),
    genres: cleanList(e.genres),
    tags: cleanList(e.tags),
    year: str(e.year, 4).replace(/\D/g, ''),
    producer: str(e.producer),
    label: str(e.label),
    cover: /^https?:\/\//.test(e.cover || '') ? str(e.cover, 500) : '',
    mbid: str(e.mbid, 60),
    tracks: (Array.isArray(e.tracks) ? e.tracks : [])
      .map((t) => ({ title: str(t && t.title), length: Number(t && t.length) || 0, rating: halfStep(t && t.rating) }))
      .filter((t) => t.title).slice(0, 200),
    sample: !!e.sample,
    created: str(e.created, 40) || now,
    updated: str(e.updated, 40) || now,
  };
}

export const all = () => db.entries;
export const get = (id) => db.entries.find((e) => e.id === id);
export const meta = () => db.meta;

export function upsert(entry) {
  const e = normalize({ ...entry, updated: new Date().toISOString() });
  if (!e) return null;
  const i = db.entries.findIndex((x) => x.id === e.id);
  if (i >= 0) db.entries[i] = e; else db.entries.push(e);
  persist();
  return e;
}
export function patch(id, changes) {
  const cur = get(id);
  return cur ? upsert({ ...cur, ...changes }) : null;
}
export function remove(ids) {
  const set = new Set([].concat(ids));
  const removed = db.entries.filter((e) => set.has(e.id));
  db.entries = db.entries.filter((e) => !set.has(e.id));
  persist();
  return removed;
}
export function restore(entries) {
  entries.forEach((e) => { if (!get(e.id)) db.entries.push(e); });
  persist();
}
export const samples = () => db.entries.filter((e) => e.sample);
export const userEntries = () => db.entries.filter((e) => !e.sample);

export function seedIfNeeded(makeSamples) {
  if (db.meta.seeded) return;
  db.entries.push(...makeSamples().map(normalize));
  db.meta.seeded = true;
  persist(false);
}

export const allTags = () => ranked('tags');
export const allGenres = () => ranked('genres');
function ranked(field) {
  const counts = new Map();
  db.entries.forEach((e) => e[field].forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

// ---------- Backup ----------
export function exportJSON() {
  return JSON.stringify({
    app: 'listening',
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: db.entries,
  }, null, 2);
}
export function markExported() {
  db.meta.lastExport = new Date().toISOString();
  persist(false);
}
/** True when there are changes that are not in the last export. */
export function hasUnexported() {
  const { lastExport, lastChange } = db.meta;
  if (!lastExport) return userEntries().length > 0;
  return !!lastChange && lastChange > lastExport;
}

/** Parse an export file. Returns normalized entries or throws. */
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.entries) ? data.entries : null;
  if (!list) throw new Error('No entries found in this file.');
  const entries = list.map(normalize).filter(Boolean);
  if (!(data && Array.isArray(data.entries) && data.version >= 2)) entries.forEach(splitGenreTags);
  if (!entries.length && list.length) throw new Error('None of the entries in this file could be read.');
  return entries;
}
export function importEntries(entries, mode) {
  if (mode === 'replace') {
    db.entries = entries;
  } else {
    const byId = new Map(db.entries.map((e) => [e.id, e]));
    entries.forEach((e) => {
      const cur = byId.get(e.id);
      if (!cur || e.updated >= cur.updated) byId.set(e.id, e);
    });
    db.entries = [...byId.values()];
  }
  db.meta.seeded = true;
  persist();
}
export function eraseAll() {
  db.entries = [];
  persist();
}

// Load last, once every helper above is defined.
let db = load();
