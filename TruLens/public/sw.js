/* TruLens PWA service worker — app shell cache; never cache API photo payloads */
/* v3: the activate handler deletes every cache whose key !== CACHE_VERSION, so
   bumping this is what makes an installed phone drop the shell cached by the
   version with the broken navigation fallback. Without the bump a device would
   keep serving the old entry indefinitely. */
const CACHE_VERSION = 'trulens-v3';

/* Shown only when a navigation fails and nothing is cached — a first run with
   no signal. Inline and dependency-free: it has to render when the app bundle
   is exactly what could not be fetched. */
const OFFLINE_PAGE =
  '<!doctype html><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>TruLens — no connection</title>' +
  '<body style="margin:0;background:#06080D;color:#E8EAE6;font:16px/1.5 system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center">' +
  '<div style="padding:24px;max-width:22rem">' +
  '<h1 style="font-size:20px;font-weight:600;margin:0 0 8px">No connection</h1>' +
  '<p style="margin:0 0 16px;color:rgba(232,234,230,0.72)">TruLens needs signal to start up. Any photos already taken are saved on this phone and will export once you are back online.</p>' +
  '<button onclick="location.reload()" style="appearance:none;border:0;border-radius:14px;padding:12px 20px;background:#4FE3DC;color:#06080D;font:600 15px system-ui,sans-serif">Try again</button>' +
  '</div>';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/embed/') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always network for APIs / large data — never put base64 inventory in cache
  if (isApiRequest(url)) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          // respondWith(undefined) is a failed request, not a fallback: an
          // uncached API call used to surface as a browser-level load error
          // instead of something the app could show. Answer with JSON it can.
          const cached = await caches.match(req);
          return (
            cached ||
            new Response(JSON.stringify({ error: 'Offline — TruLens could not reach the server.' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
      })()
    );
    return;
  }

  // Navigation: network first, fall back to cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const copy = res.clone();
          caches
            .open(CACHE_VERSION)
            .then((c) => c.put('/', copy))
            .catch(() => undefined);
          return res;
        } catch {
          /* This was `caches.match('/') || caches.match('/index.html')`, and
             caches.match returns a *Promise* — always truthy — so the second
             branch never ran and a miss resolved to undefined. respondWith of
             undefined is what the browser reports as a load error, which is
             what a yard phone hit whenever a navigation landed during a deploy
             restart or a signal drop. Await both, and always answer with a
             real page. */
          const cached = (await caches.match('/')) || (await caches.match('/index.html'));
          if (cached) return cached;
          return new Response(OFFLINE_PAGE, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy).catch(() => undefined));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
