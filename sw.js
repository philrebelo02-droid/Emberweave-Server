/* Emberweave Heroes service worker.
   Network-first for the app so pushed updates reach players immediately,
   with a cache fallback so the installed app still opens offline.            */

/* 30 Aug (v308) — WHY THE GAME GOT SLOW TO OPEN.
   There used to be ONE cache, named after the build, and `activate` deleted every cache that
   wasn't the current one. Every deploy bumps the build, so every deploy threw away the ENTIRE
   art cache — about 20 MB of sprite sheets for a single campaign battle — and the next open
   re-downloaded all of it over the player's connection. Ship twice in an afternoon and the
   player pays that twice.
   The art does not change when the code does. So it now lives in its own cache that SURVIVES
   deploys, and only the shell (the HTML, icons, manifest) is versioned. Sheets are served from
   cache instantly and revalidated in the background, so a genuinely changed file is picked up on
   the next open instead of never — and a ?v= bumped URL is a new key anyway, so it is fetched
   immediately. */
const BUILD  = '1788484687570';
const SHELL_CACHE = 'ember-shell-' + BUILD;   // versioned: wiped on every deploy
const ASSET_CACHE = 'ember-assets-v1';        // persistent: survives deploys
const SHELL = ['/play', '/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== ASSET_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;                                   // never cache API calls
  if (url.pathname.endsWith('/version.json')) {                                   // always live
    e.respondWith(fetch(req).catch(()=>new Response('{}',{headers:{'Content-Type':'application/json'}})));
    return;
  }
  const isDoc = req.mode === 'navigate' || (req.destination === '' && url.pathname === '/') || req.destination === 'document';
  const isOwnAsset = url.origin === location.origin && url.pathname.startsWith('/assets/');

  // ART: stale-while-revalidate out of the persistent cache. A hit returns with no network round
  // trip at all (this is what stops sprite sheets popping in on a slow phone); the refresh happens
  // afterwards and lands for the next open.
  if (isOwnAsset) {
    e.respondWith(
      caches.open(ASSET_CACHE).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) c.put(req, res.clone()).catch(()=>{});
          return res;
        }).catch(() => hit);
        if (hit) { e.waitUntil(net.catch(()=>{})); return hit; }                   // instant, refresh in background
        return net;
      }))
    );
    return;
  }

  // APP SHELL: network-first so a pushed update always wins, cache as the offline fallback.
  const fetchOpts = isDoc ? { cache: 'reload' } : {};
  e.respondWith(
    fetch(new Request(req, fetchOpts)).then(res => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match(isDoc ? '/play' : '/')))
  );
});
