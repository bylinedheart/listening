// Service worker: keeps the app shell available offline and caches album covers.
// Bump VERSION when you change the list of shell files.
const VERSION = 'v4';
const SHELL_CACHE = `listening-shell-${VERSION}`;
const COVER_CACHE = 'listening-covers';
const COVER_LIMIT = 150; // opaque responses count heavily toward storage quota

const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/seed.js',
  'js/stars.js',
  'js/lookup.js',
  'js/stats.js',
  'js/charts.js',
  'js/util.js',
  'js/genres.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/bricolage-grotesque-latin-600-normal.woff2',
  'fonts/bricolage-grotesque-latin-800-normal.woff2',
  'fonts/instrument-serif-latin-400-normal.woff2',
  'fonts/instrument-serif-latin-400-italic.woff2',
  'fonts/manrope-latin-500-normal.woff2',
  'fonts/manrope-latin-600-normal.woff2',
  'fonts/manrope-latin-700-normal.woff2',
  'fonts/dm-mono-latin-400-normal.woff2',
  'fonts/dm-mono-latin-500-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('listening-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isCover = (url) => /(^|\.)coverartarchive\.org$|(^|\.)archive\.org$/.test(url.hostname);

async function trimCovers() {
  const cache = await caches.open(COVER_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - COVER_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App shell: serve from cache, refresh in the background (stale-while-revalidate).
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
    return;
  }

  // Album covers: cache first so they show offline.
  if (isCover(url) && req.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(COVER_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') {
          cache.put(req, res.clone());
          event.waitUntil(trimCovers());
        }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
  }
  // Everything else (MusicBrainz lookups) goes straight to the network.
});
