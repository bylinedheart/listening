// Small helpers shared across modules.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

/** Local date as YYYY-MM-DD. */
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export const todayISO = () => isoDate(new Date());

/** Parse YYYY-MM-DD as a local date. */
export function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
/** Whole-day number, timezone-safe, for streak maths. */
export function dayNumber(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthKey = (iso) => String(iso).slice(0, 7);
export function monthLabel(key, long = false) {
  const [y, m] = key.split('-').map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}
export const monthShort = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
export function fmtDate(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}
export function fmtLongDate(iso) {
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function topbarDate() {
  const d = new Date();
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}
export function daysAgo(isoTimestamp) {
  if (!isoTimestamp) return null;
  const then = new Date(isoTimestamp);
  return Math.floor((dayNumber(todayISO()) - dayNumber(isoDate(then))));
}
export function relDays(n) {
  if (n === null || n === undefined) return 'Never';
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  return `${n} days ago`;
}

export const fmtRating = (r) => (r ? (Number.isInteger(r) ? `${r}.0` : String(r)) : '–');
export function fmtLen(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function initials(e) {
  const words = String(e.title || '?').replace(/^the\s+/i, '').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Album cover, or a record-style placeholder tinted from the title. */
export function coverHTML(e, size = '') {
  const h = hash((e.artist || '') + (e.title || '')) % 360;
  const img = e.cover ? `<img src="${esc(e.cover)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
  return `<span class="cover ${size ? 'cover-' + size : ''}" style="--h:${h}" data-initials="${esc(initials(e))}" aria-hidden="true">${img}</span>`;
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const cmpText = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
