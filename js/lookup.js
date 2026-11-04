// Quick add: album and song lookup via MusicBrainz (metadata, tracks,
// producers) and the Cover Art Archive (covers). Both are free, need no
// API key, and allow cross-origin requests from the browser.

const MB = 'https://musicbrainz.org/ws/2';
const CAA = 'https://coverartarchive.org';

// MusicBrainz asks clients to stay at about one request per second.
let lastCall = 0;
async function mb(path) {
  const wait = lastCall + 1050 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${MB}${path}${path.includes('?') ? '&' : '?'}fmt=json`;
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error(navigator.onLine === false
      ? 'You are offline. Fill in the details by hand.'
      : 'Could not reach the music database. Try again, or fill in the details by hand.');
  }
  if (res.status === 503 || res.status === 429) throw new Error('The music database is busy. Try again in a moment.');
  if (!res.ok) throw new Error(`Lookup failed (${res.status}).`);
  return res.json();
}

export const coverFor = (releaseGroupId, size = 250) =>
  releaseGroupId ? `${CAA}/release-group/${releaseGroupId}/front-${size}` : '';

const credit = (ac) => (Array.isArray(ac) ? ac.map((c) => (c.name || c.artist?.name || '') + (c.joinphrase || '')).join('').trim() : '');
const year = (d) => (d ? String(d).slice(0, 4) : '');
const luceneTerms = (q) => q.replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, ' ').replace(/\s+/g, ' ').trim();

/** "Title - Artist" or "Title by Artist" narrows the search; otherwise search both fields. */
function buildQuery(q, field) {
  const parts = q.split(/\s+(?:-|–|—|by)\s+/i);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return `${field}:(${luceneTerms(parts[0])}) AND artist:(${luceneTerms(parts[1])})`;
  }
  const t = luceneTerms(q);
  return `${field}:(${t})^3 OR artist:(${t}) OR ${field}:"${t}"^5`;
}

export async function searchAlbums(q) {
  const query = buildQuery(q, 'releasegroup');
  const data = await mb(`/release-group?query=${encodeURIComponent(query)}&limit=12`);
  return (data['release-groups'] || []).map((rg) => {
    const releases = rg.releases || [];
    const release = releases.find((r) => r.status === 'Official') || releases[0];
    return {
      kind: 'album',
      rgid: rg.id,
      releaseId: release ? release.id : '',
      title: rg.title,
      artist: credit(rg['artist-credit']),
      year: year(rg['first-release-date']),
      sub: [rg['primary-type'], ...(rg['secondary-types'] || [])].filter(Boolean).join(' · '),
      cover: coverFor(rg.id),
    };
  });
}

export async function searchSongs(q) {
  const query = buildQuery(q, 'recording');
  const data = await mb(`/recording?query=${encodeURIComponent(query)}&limit=12`);
  const seen = new Set();
  return (data.recordings || []).map((rec) => {
    const rels = rec.releases || [];
    const rel = rels.find((r) => r['release-group']?.['primary-type'] === 'Album' && r.status === 'Official')
      || rels.find((r) => r.status === 'Official') || rels[0];
    const rgid = rel?.['release-group']?.id || '';
    return {
      kind: 'song',
      recordingId: rec.id,
      rgid,
      title: rec.title,
      artist: credit(rec['artist-credit']),
      album: rel ? rel.title : '',
      year: year(rec['first-release-date'] || rel?.date),
      length: rec.length || 0,
      sub: rel ? rel.title : '',
      cover: coverFor(rgid),
    };
  }).filter((r) => {
    const k = `${r.title}|${r.artist}|${r.album}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function producersFrom(relations, out) {
  (relations || []).forEach((rel) => {
    if (rel.type === 'producer' && rel.artist?.name) out.add(rel.artist.name);
  });
}
const topGenres = (obj) => [...(obj.genres || []), ...(obj.tags || [])]
  .sort((a, b) => (b.count || 0) - (a.count || 0))
  .map((g) => g.name.toLowerCase())
  .filter((v, i, a) => a.indexOf(v) === i)
  .slice(0, 3);

/** Full details for an album search result. */
export async function albumDetails(result) {
  const fields = {
    type: 'album', title: result.title, artist: result.artist, year: result.year,
    cover: result.cover, mbid: result.rgid, tracks: [], producer: '', label: '', tags: [],
  };
  if (!result.releaseId) return fields;
  const r = await mb(`/release/${result.releaseId}?inc=recordings+artist-credits+labels+genres+artist-rels+recording-level-rels`);
  const producers = new Set();
  producersFrom(r.relations, producers);
  fields.tracks = (r.media || []).flatMap((m) => (m.tracks || []).map((t) => {
    producersFrom(t.recording?.relations, producers);
    return { title: t.title || t.recording?.title || '', length: t.length || t.recording?.length || 0, rating: 0 };
  }));
  fields.producer = [...producers].slice(0, 4).join(', ');
  fields.label = r['label-info']?.find((l) => l.label?.name)?.label.name || '';
  fields.tags = topGenres(r);
  if (!fields.year) fields.year = year(r.date);
  return fields;
}

/** Full details for a song search result. */
export async function songDetails(result) {
  const fields = {
    type: 'song', title: result.title, artist: result.artist, album: result.album,
    year: result.year, cover: result.cover, mbid: result.recordingId, producer: '', tags: [], tracks: [],
  };
  const r = await mb(`/recording/${result.recordingId}?inc=artist-rels+genres`);
  const producers = new Set();
  producersFrom(r.relations, producers);
  fields.producer = [...producers].slice(0, 4).join(', ');
  fields.tags = topGenres(r);
  return fields;
}
