/* Partitures Festeres Web W1: només guarda els arxius públics de l'aplicació.
   Les partitures privades es guarden en IndexedDB al dispositiu. */
const CACHE = 'pfweb-shell-w11-20261116';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './db.js', './backup.js',
  './manifest.webmanifest', './vendor/jszip.min.js',
  './assets/pergami.png', './assets/icon-180.png',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-original.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('pfweb-shell-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
    }
    return response;
  })));
});
