// TruTrade service worker — caches the app shell so it launches instantly and
// survives a flaky signal on the lot. Live video/signalling always go to network.
const CACHE = 'trutrade-v12';
const SHELL = ['/', '/logo.png', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // never cache API, websocket upgrades, or buyer session links — always live
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/a/') || url.pathname.startsWith('/ws')) {
    return; // let it hit the network
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('/')))
  );
});
