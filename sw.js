// Rydoku service worker v9
// Cache first for everything: the app always opens instantly from the phone, online or not.
// A new version downloads in the background (fresh copies, bypassing the browser HTTP cache) and WAITS.
// The page shows a "Refresh for update" button; tapping it activates the new version and deletes old caches.
const CACHE = 'rydoku-cache-v9';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(res => { if (res.ok) return c.put(f, res); })));
    // Older builds (before the update button existed) can't show the button, so take over right away for them.
    const keys = await caches.keys();
    if (keys.some(k => !k.startsWith('rydoku-cache-'))) self.skipWaiting();
  })());
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && req.mode !== 'navigate') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
