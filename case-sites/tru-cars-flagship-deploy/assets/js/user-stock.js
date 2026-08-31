/* ============================================================
   TRUECARS SA — user-added vehicle state layer
   Keeps a dynamic list of vehicles (localStorage) that is merged
   into TCSA.vehicles *without* mutating the static mockStock in
   data.js. Load this AFTER data.js and BEFORE stock-bridge.js.

   Public API:
     TCSA.addUserVehicle(v)      → id
     TCSA.removeUserVehicle(id)  → bool
     TCSA.clearUserVehicles()
     TCSA.getUserVehicles()      → [...]

   Any change fires window `tcsa:user-stock` and asks the bridge
   to re-merge so lists re-render.
   ============================================================ */
(function () {
  "use strict";
  window.TCSA = window.TCSA || {};
  var KEY = "tcsa_user_vehicles_v1";

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function normalise(v) {
    if (!v || !v.make || !v.model) return null;
    var year = Number(v.year) || new Date().getFullYear();
    var id = v.id || slug([year, v.make, v.model, v.variant || "", Date.now()].join("-"));
    var price = Number(v.price) || 0;
    var hero = v.img || (Array.isArray(v.gallery) && v.gallery[0]) || null;
    return Object.assign({
      id: id,
      stockNumber: v.stockNumber || ("USR-" + id.slice(0, 8).toUpperCase()),
      variant: "",
      truecarPrice: price ? Math.round(price * 1.06) : 0,
      km: Number(v.km) || 0,
      fuel: "Petrol",
      trans: "Automatic",
      body: "sedan",
      colour: "",
      location: "Added on true-cars",
      badges: [{ t: "New listing", c: "hot" }],
      vir: 90,
      lvs: false,
      premium: false,
      certUsed: false,
      tags: ["User added"],
      featured: false,
      blurb: "",
      img: hero,
      gallery: hero ? [hero] : [],
      addedBy: "true-cars-flow",
      addedAt: Date.now(),
      source: "user"
    }, v, { id: id, year: year, price: price });
  }

  var cache = read();

  TCSA.getUserVehicles = function () { return cache.slice(); };

  TCSA.addUserVehicle = function (v) {
    var n = normalise(v);
    if (!n) return null;
    // Replace if id collides
    cache = cache.filter(function (x) { return x.id !== n.id; });
    cache.unshift(n);
    write(cache);
    notify("add", n);
    return n.id;
  };

  TCSA.removeUserVehicle = function (id) {
    var before = cache.length;
    cache = cache.filter(function (x) { return x.id !== id; });
    if (cache.length === before) return false;
    write(cache);
    notify("remove", { id: id });
    return true;
  };

  TCSA.clearUserVehicles = function () {
    cache = [];
    write(cache);
    notify("clear", null);
  };

  function notify(kind, payload) {
    window.dispatchEvent(new CustomEvent("tcsa:user-stock", {
      detail: { kind: kind, payload: payload, count: cache.length }
    }));
    // Ask the bridge to remerge so cards re-render across the site
    if (typeof TCSA.loadLiveStock === "function") {
      // fire-and-forget; bridge dispatches tcsa:stock
      TCSA.loadLiveStock();
    }
  }

  // Cross-tab sync
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    cache = read();
    if (typeof TCSA.loadLiveStock === "function") TCSA.loadLiveStock();
  });
})();
