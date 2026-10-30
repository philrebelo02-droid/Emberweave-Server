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
const BUILD='1793388313996';
const SHELL_CACHE = 'ember-shell-' + BUILD;   // versioned: wiped on every deploy
const ASSET_CACHE = 'ember-assets-v1';        // persistent: survives deploys
const SHELL = ['/play', '/', '/manifest.webmanifest', '/icon-192.png?v=lumi1', '/icon-512.png?v=lumi1', '/icon-512-maskable.png?v=lumi1', '/apple-touch-icon.png?v=lumi1', '/hero-profiles.js?v=r1169', '/hero-paths.js?v=r1025'];

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
  // v605: video is streamed with Range requests; the Cache API cannot store a 206, so let the browser fetch it directly.
  if (isOwnAsset && /\.(mp4|webm)$/i.test(url.pathname)) return;
  // v1124: the same for any Range request (the lore narration's <audio> element streams .m4a by Range) - a 206 cannot be cached
  // and a cached whole file must not answer a Range. Ult lines are fetched whole (no Range) and stay cached like art.
  /* v1159: MUSIC streams by Range too (an <audio> element). Update all features saves each song whole; a Range read of a saved song is
     answered from that copy as a 206 slice, so a downloaded song plays from the device. Not saved -> the network, uncached, as before. */
  if (isOwnAsset && req.headers.has('range') && url.pathname.startsWith('/assets/audio/music/')) {
    e.respondWith(caches.open(ASSET_CACHE).then(c => c.match(req.url)).then(hit => {
      if (!hit) return fetch(req);
      return hit.arrayBuffer().then(buf => {
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || ''), n = buf.byteLength;
        let a = m && m[1] !== '' ? +m[1] : 0, z = m && m[2] !== '' ? +m[2] : n - 1;
        if (m && m[1] === '' && m[2] !== '') { a = Math.max(0, n - +m[2]); z = n - 1; }
        if (!(a < n)) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + n } });
        z = Math.min(z, n - 1);
        return new Response(buf.slice(a, z + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
          'Content-Range': 'bytes ' + a + '-' + z + '/' + n, 'Content-Length': String(z - a + 1), 'Accept-Ranges': 'bytes' } });
      });
    }).catch(() => fetch(req)));
    return;
  }
  if (isOwnAsset && req.headers.has('range')) return;
  if (isOwnAsset) {
    // v576 (Phil: "it should only allow me to download new content"). A ?v= URL is IMMUTABLE by
    // protocol - SHIPPING RULE 2.5 forbids reusing a version number, so a bumped asset is a new
    // key, never new bytes under an old one. Revalidating one in the background re-downloaded the
    // whole library as the player played. A versioned hit is now served and left alone; only an
    // UNversioned asset still gets the stale-while-revalidate treatment.
    const versioned = url.searchParams.has('v');
    e.respondWith(
      caches.open(ASSET_CACHE).then(c => c.match(req).then(hit => {
        if (hit && versioned) return hit;                                          // immutable: done
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
  /* v1141: 'no-cache' REVALIDATES the page (If-None-Match -> 304, no body, when nothing was deployed) where 'reload' downloaded the whole
     ~1 MB page on every launch. The server's ETag is a hash of the bytes, so a deploy always gets the new page. */
  const fetchOpts = isDoc ? { cache: 'no-cache' } : {};
  e.respondWith(
    fetch(new Request(req, fetchOpts)).then(res => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match(isDoc ? '/play' : '/')))
  );
});



