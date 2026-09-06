const CACHE_NAME = 'trubrand-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/trubrand-logo-nav.svg',
  './assets/trubrand-logo-3d.svg',
  './assets/icon.svg'
];


self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(x => x !== CACHE_NAME).map(x => caches.delete(x)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (!res || res.status !== 200 || res.type !== 'basic') return res;
      const cl = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(e.request, cl));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});