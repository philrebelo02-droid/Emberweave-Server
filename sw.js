/* Emberweave Heroes service worker.
   Network-first for the app so your pushed updates reach players immediately,
   with a cache fallback so the installed app still opens offline.            */
const CACHE = 'emberweave-v7';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return; // never cache API calls
  if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(req).catch(()=>new Response('{}',{headers:{'Content-Type':'application/json'}}))); return; } // always live
  // network-first: always try to get the freshest game (bypassing the HTTP cache), fall back to cache offline.
  // navigations / the HTML doc are fetched with cache:'reload' so a stale browser-cached page can never win.
  const isDoc = req.mode === 'navigate' || (req.destination === '' && url.pathname === '/') || req.destination === 'document';
  const fetchOpts = isDoc ? { cache: 'reload' } : {};
  e.respondWith(
    fetch(new Request(req, fetchOpts)).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match('/')))
  );
});
