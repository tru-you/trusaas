const CACHE = "trudealer-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.url.includes("/wp-json/") || e.request.url.includes("/api/")) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (r) { return r || fetch(e.request); })
  );
});

self.addEventListener("push", function (e) {
  var data = { title: "New Lead!", body: "You have a new lead waiting.", icon: "icon-192.png", badge: "icon-192.png", tag: "lead" };
  if (e.data) { try { data = JSON.parse(e.data.text()); } catch (err) { data.body = e.data.text(); } }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || "icon-192.png",
    badge: data.badge || "icon-192.png",
    tag: data.tag || "lead",
    renotify: true,
    vibrate: [200, 100, 200]
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].focused) return list[i].focus(); }
    return clients.openWindow("./index.html");
  }));
});
