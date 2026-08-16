/* TruFlow Mobile — service worker.
   Bump VERSION on every deploy so old caches are dropped and clients update.
   Strategy: never touch writes; navigations network-first with a cached shell
   fallback; API network-first with cache fallback (last-synced data offline);
   fonts + own static assets cache-first. */
var VERSION = "tfm-2026-08-16i";
var CORE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(function () {
      return caches.match("/index.html").then(function (r) { return r || caches.match("/"); });
    }));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.indexOf("/api/") === 0) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  if (url.hostname.indexOf("fonts.g") === 0 ||
      url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  e.respondWith(fetch(req).catch(function () { return caches.match(req); }));
});
