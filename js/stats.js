// Derived statistics over logged listens.
import { dayNumber, todayISO, monthKey, isoDate } from './util.js';

export const logged = (entries) => entries.filter((e) => e.shelf === 'done' && e.date);

function countBy(items, keyFn) {
  const m = new Map();
  items.forEach((x) => [].concat(keyFn(x)).forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); }));
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, n }));
}

export function streaks(dates, today = todayISO()) {
  const days = [...new Set(dates.map(dayNumber))].sort((a, b) => a - b);
  let longest = 0, run = 0, prev = null, longestEnd = null;
  days.forEach((d) => {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    if (run > longest) { longest = run; longestEnd = d; }
    prev = d;
  });
  const set = new Set(days);
  const t = dayNumber(today);
  let start = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  let current = 0;
  while (start !== null && set.has(start - current)) current++;
  return { current, longest, longestEnd, activeToday: set.has(t) };
}

export function computeStats(entries) {
  const L = logged(entries);
  const rated = L.filter((e) => e.rating > 0);
  const avg = rated.length ? rated.reduce((s, e) => s + e.rating, 0) / rated.length : 0;

  // Last 12 months, oldest first.
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    months.push({ key: monthKey(isoDate(new Date(now.getFullYear(), now.getMonth() - i, 1))), n: 0 });
  }
  const mIndex = new Map(months.map((m, i) => [m.key, i]));
  L.forEach((e) => { const i = mIndex.get(monthKey(e.date)); if (i !== undefined) months[i].n++; });

  const dist = Array.from({ length: 10 }, (_, i) => ({ r: (i + 1) / 2, n: 0 }));
  rated.forEach((e) => { dist[Math.round(e.rating * 2) - 1].n++; });

  const thisMonth = months[months.length - 1].n;
  return {
    total: L.length,
    rated: rated.length,
    avg,
    artists: countBy(L, (e) => e.artist),
    tags: countBy(L, (e) => e.tags),
    months,
    thisMonth,
    dist,
    streak: streaks(L.map((e) => e.date)),
    first: L.reduce((m, e) => (!m || e.date < m ? e.date : m), ''),
  };
}
