/* ============================================================
   True Cars showroom — stock layer
   Serves the demo catalogue (assets/js/catalog.js) and merges any real
   published stock from the true-cars tenant on top of it. One schema
   throughout: the public stock feed contract, exactly as the API returns it.
   Nothing is invented here — a car has a VIR score or it doesn't.
   ============================================================ */
(function () {
  var TRU = (window.TruShowroom = window.TruShowroom || {});

  var FEEDS = [
    "https://premium.tru-saas.com/api/public/stock",
    "https://flow.tru-saas.com/api/public/stock",
    "https://trusaas-premium.onrender.com/api/public/stock",
  ];
  /* The storefront renders the true-cars tenant AND the demo tenant together,
     so a prospect in demo mode sees their own stock appear on the site — the
     capture → DMS → showroom loop, live. Each slug is still fetched separately
     (the feed is single-tenant); the merge is a showroom-side choice. */
  var DEALERS = ["true-cars", "demo"];

  /* ---- finance maths: same defaults and balloon PMT as tru-repay.js, so a
     card's "from R x pm" matches what the calculator shows for that car ---- */
  TRU.FINANCE = { rate: 11.75, depositPct: 10, term: 72, balloonPct: 0 };

  TRU.monthly = function (price, opts) {
    var o = opts || {};
    var rate = o.rate != null ? o.rate : TRU.FINANCE.rate;
    var term = o.term != null ? o.term : TRU.FINANCE.term;
    var depPct = o.depositPct != null ? o.depositPct : TRU.FINANCE.depositPct;
    var balPct = o.balloonPct != null ? o.balloonPct : TRU.FINANCE.balloonPct;

    var principal = price - price * (depPct / 100);
    var balloon = price * (balPct / 100);
    if (!(principal > 0) || !(term > 0)) return 0;
    var r = rate / 100 / 12;
    if (r <= 0) return (principal - balloon) / term;
    var pv = principal - balloon / Math.pow(1 + r, term);
    return (pv * r) / (1 - Math.pow(1 + r, -term));
  };

  /* ---- formatting ---- */
  TRU.money = function (n) {
    return "R" + Math.round(Number(n) || 0).toLocaleString("en-ZA").replace(/\s/g, "\u00A0");
  };
  TRU.km = function (n) {
    return Math.round(Number(n) || 0).toLocaleString("en-ZA") + " km";
  };
  TRU.title = function (v) {
    return [v.year, v.make, v.model].filter(Boolean).join(" ");
  };

  /* ---- stock catalogue with instant initial load ---- */
  var demo = (window.TRU_CATALOG && Array.isArray(window.TRU_CATALOG.vehicles) && window.TRU_CATALOG.vehicles.length)
    ? window.TRU_CATALOG.vehicles.slice()
    : ((window.TCSA && Array.isArray(window.TCSA.catalog)) ? window.TCSA.catalog.slice() : []);
  TRU.vehicles = demo.slice();
  TRU.source = demo.length ? "cached" : "live";

  /* ---- 3D Orbit / TruOrbit Enrichment ----
     Ensure every vehicle has a functional 360 walkaround:
     1. Live feed payload if present
     2. Lazy fetch from TruLens public API
     3. Fallback mock package via TCSA.buildMockWeb3DPackage() or Honda stills
  */
  function enrichVehicleOrbit(v) {
    if (!v) return;
    if (!v.images || !v.images.length) {
      if (v.gallery && v.gallery.length) v.images = v.gallery.slice();
      else if (v.img) v.images = [v.img];
      else v.images = [];
    }
    /* removed fake 360 injection */
    /* Demo/seed cars have no photos — give them the orbit's first frame as a
       card image so the floor never renders a broken <img>. */
    if ((!v.heroImage || v.heroImage === "null") && v.web3d && v.web3d.frames && v.web3d.frames.length) {
      v.heroImage = v.web3d.frames[0].image;
    }
    // Attempt lazy upgrade from TruLens if stockNumber is available
    var stock = v.stockNumber || v.id || v.tag;
    if (stock && (!v.web3d || v.web3d.mock)) {
      fetch("https://lens.tru-saas.com/api/public/web3d/" + encodeURIComponent(stock), { mode: "cors" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.package && data.package.frames && data.package.frames.length) {
            v.web3d = data.package;
            window.dispatchEvent(new CustomEvent("tru:stock", { detail: { source: TRU.source, count: TRU.vehicles.length } }));
          }
        })
        .catch(function () {});
    }
  }

  function enrichAllVehicles(list) {
    (list || []).forEach(enrichVehicleOrbit);
  }

  enrichAllVehicles(TRU.vehicles);

  TRU.get = function (stockNumber, allowFallback) {
    if (!stockNumber) {
      if (allowFallback && TRU.vehicles && TRU.vehicles.length > 0) {
        var fb = TRU.vehicles[0];
        enrichVehicleOrbit(fb);
        return fb;
      }
      return null;
    }
    var raw = String(stockNumber).trim().toLowerCase();
    var key = raw.replace(/[^a-z0-9]/g, "");

    for (var i = 0; i < TRU.vehicles.length; i++) {
      var v = TRU.vehicles[i];
      var sNum = v.stockNumber ? String(v.stockNumber).trim().toLowerCase() : "";
      var vId = v.id ? String(v.id).trim().toLowerCase() : "";
      var vTag = v.tag ? String(v.tag).trim().toLowerCase() : "";

      if (sNum === raw || vId === raw || vTag === raw) {
        enrichVehicleOrbit(v);
        return v;
      }
      if (sNum.replace(/[^a-z0-9]/g, "") === key || vId.replace(/[^a-z0-9]/g, "") === key) {
        enrichVehicleOrbit(v);
        return v;
      }
    }

    // Fallback to first vehicle only when explicitly requested (e.g. VDP page)
    if (allowFallback && TRU.vehicles && TRU.vehicles.length > 0) {
      var fallback = TRU.vehicles[0];
      enrichVehicleOrbit(fallback);
      return fallback;
    }

    return null;
  };

  /* ---- facets and filtering, driven off whatever is in TRU.vehicles ---- */
  TRU.facets = function (list) {
    var src = list || TRU.vehicles;
    var count = function (key) {
      var out = {};
      src.forEach(function (v) {
        var k = v[key];
        if (!k) return;
        out[k] = (out[k] || 0) + 1;
      });
      return Object.keys(out)
        .sort()
        .map(function (k) { return { value: k, count: out[k] }; });
    };
    return {
      make: count("make"),
      bodyType: count("bodyType"),
      fuelType: count("fuelType"),
      transmission: count("transmission"),
    };
  };

  TRU.filter = function (q) {
    q = q || {};
    var text = String(q.q || "").trim().toLowerCase();
    return TRU.vehicles.filter(function (v) {
      if (q.make && v.make !== q.make) return false;
      if (q.bodyType && v.bodyType !== q.bodyType) return false;
      if (q.fuelType && v.fuelType !== q.fuelType) return false;
      if (q.transmission && v.transmission !== q.transmission) return false;
      if (q.minPrice && v.price < Number(q.minPrice)) return false;
      if (q.maxPrice && v.price > Number(q.maxPrice)) return false;
      if (text) {
        var hay = [v.year, v.make, v.model, v.trim, v.bodyType, v.color]
          .join(" ")
          .toLowerCase();
        if (
          !text.split(/\s+/).every(function (word) {
            return hay.indexOf(word) !== -1;
          })
        ) return false;
      }
      return true;
    });
  };

  TRU.sort = function (list, mode) {
    var out = list.slice();
    switch (mode) {
      case "price-desc": return out.sort(function (a, b) { return b.price - a.price; });
      case "year-desc":  return out.sort(function (a, b) { return b.year - a.year; });
      case "km-asc":     return out.sort(function (a, b) { return a.mileage - b.mileage; });
      case "monthly":    return out.sort(function (a, b) { return TRU.monthly(a.price) - TRU.monthly(b.price); });
      case "price-asc":
      default:           return out.sort(function (a, b) { return a.price - b.price; });
    }
  };

  /* ---- live stock merge ------------------------------------------------
     Stores real units published to true-cars and demo tenants from TruFlow DMS. */
  function mergeLive(liveList) {
    var seen = {};
    var unique = [];
    liveList.forEach(function (v) {
      var key = String(v.stockNumber || v.id || "").toLowerCase();
      if (key && !seen[key]) {
        seen[key] = true;
        unique.push(v);
      }
    });
    TRU.vehicles = unique;
    enrichAllVehicles(TRU.vehicles);
    TRU.source = "live";
  }

  TRU.loadLive = function () {
    var feedIdx = 0;
    var collected = [];

    function announce() {
      window.dispatchEvent(
        new CustomEvent("tru:stock", {
          detail: { source: TRU.source, count: TRU.vehicles.length },
        })
      );
    }

    function fetchAll() {
      var pending = DEALERS.length;
      var settled = 0;
      var gotAny = false;

      function settle() {
        settled++;
        if (settled !== pending) return;
        /* Any non-empty slug on this feed is enough; only fall to the next
           feed when this one returned nothing for every slug. */
        if (gotAny || feedIdx + 1 >= FEEDS.length) {
          if (collected.length) {
            mergeLive(collected);
            console.info("[TruShowroom] live stock:", collected.length, "from", FEEDS[feedIdx]);
          }
          announce();
        } else {
          feedIdx++;
          fetchAll();
        }
      }

      DEALERS.forEach(function (slug) {
        var url = FEEDS[feedIdx] + "?dealer=" + encodeURIComponent(slug);
        fetch(url, { cache: "no-store", mode: "cors" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            var list = data && Array.isArray(data.vehicles) ? data.vehicles : [];
            if (list.length) {
              collected = collected.concat(list);
              gotAny = true;
            }
            settle();
          })
          .catch(function () { settle(); });
      });
    }

    fetchAll();
  };

  // Pages render the demo catalogue immediately, then re-render on tru:stock.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", TRU.loadLive);
  } else {
    TRU.loadLive();
  }
})();
