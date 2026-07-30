/* ============================================================
   TRUECAR SA — TruSaaS live stock bridge
   Pulls public inventory from TruFlow Premium and merges it
   with mock stock from data.js. Live vehicles take priority;
   mock vehicles with non-colliding IDs are kept alongside.
   ============================================================ */
(function () {
  window.TCSA = window.TCSA || {};

  TCSA.TRUSAAS = {
    /* "true-cars", not "truecars".
       Both exist as dealerships on the instance, and the stock is filed under
       the hyphenated one — so this asked for a slug that owns no vehicles, got
       an empty list from every API in the chain, and rendered an empty site
       while the cars sat published and correct in the DMS the whole time. */
    dealer: "true-cars",
    /* TruFlow first, TruLens last.
       Both speak the same public-stock contract, so this is a genuine
       fallback rather than a guess: a dealer running the full DMS is served
       from it, and a dealer who only uses the capture app and a website is
       served straight from TruLens. An empty result falls through to the next
       one, so a dealer can move between the two without touching this file.

       flow.tru-saas.com is deliberately absent: it is a custom domain on the
       same Render service as premium, not a separate deployment, so listing it
       bought a second round-trip to the identical app rather than a fallback.
       The onrender.com host is the same service too, but reaching it by its
       platform name is what survives a custom-domain DNS or certificate
       failure. TruLens is the only genuinely independent source here. */
    apis: [
      "https://premium.tru-saas.com/api/public/stock",
      "https://trusaas-premium.onrender.com/api/public/stock",
      "https://lens.tru-saas.com/api/public/stock",
    ],
    mergeMode: "live-only",
  };

  if (!TCSA._staticVehicles || !TCSA._staticVehicles.length) {
    TCSA._staticVehicles = [];
  }

  function mapBody(raw) {
    var b = String(raw || "").toLowerCase();
    if (b.includes("suv") || b.includes("crossover")) return "suv";
    if (b.includes("bakkie") || b.includes("truck") || b.includes("4x4") || b.includes("double")) return "bakkie";
    if (b.includes("hatch")) return "hatch";
    if (b.includes("coupe")) return "coupe";
    return "sedan";
  }

  function isJunk(v) {
    var make = String(v.make || "").trim();
    var model = String(v.model || "").trim();
    if (!make || !model) return true;
    if (make.length < 2 || model.length < 2) return true;
    if (/^ss$/i.test(make) || /^ddas$/i.test(model)) return true;
    return false;
  }

  /** Map TruFlow public stock row → TCSA vehicle card shape.
   *  Fields match toPublicVehicle() in server.ts exactly. */
  TCSA.mapTruSaasVehicle = function (v) {
    if (!v || isJunk(v)) return null;
    var price = Number(v.price || v.retailPrice || 0) || 0;
    var km = Number(v.mileage || v.km || 0) || 0;
    var stock = String(v.stockNumber || v.id || "").trim();
    var id = (stock || (v.year + "-" + v.make + "-" + v.model))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    var images = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
    var hero = v.heroImage || images[0] || null;

    var truecarPrice = Number(v.truPrice) > 0
      ? Number(v.truPrice)
      : price > 0 ? Math.round(price * 1.06) : 0;

    var virScore = typeof v.vir === "number" ? v.vir : null;
    var category = v.category || null;

    var badges = [];
    if (category === "performance") badges.push({ t: "Performance", c: "hot" });
    else if (category === "select") badges.push({ t: "Premium Select", c: "gold" });
    if (truecarPrice > price && price > 0) badges.push({ t: "Great Price", c: "good" });
    if (km < 5000 && km >= 0) badges.push({ t: "Near New", c: "hot" });
    var fuel = v.fuelType || v.fuel || "Petrol";
    if (fuel === "Electric" || fuel === "Hybrid") badges.push({ t: fuel === "Electric" ? "Electric" : "Hybrid", c: "hot" });

    return {
      id: id || "live-" + Date.now(),
      stockNumber: stock,
      make: v.make,
      model: v.model,
      variant: v.trim || v.variant || "",
      year: Number(v.year) || new Date().getFullYear(),
      price: price,
      truecarPrice: truecarPrice,
      km: km,
      fuel: fuel,
      trans: v.transmission || v.tr || "Automatic",
      body: mapBody(v.bodyType || v.body),
      power: "",
      drive: "",
      colour: v.color || v.colour || "",
      vin: v.vin || "",
      location: v.location || "",
      category: category,
      badges: badges,
      vir: virScore,
      virReport: Array.isArray(v.virReport) ? v.virReport : null,
      damage: Array.isArray(v.damage) ? v.damage : null,
      /* TruFlow embeds the orbit frames in the feed; TruLens serves them from
         its own endpoint and sends a URL, because the frames are a large set
         of base64 stills and this is a list response. Carry whichever arrived
         and let the detail view fetch the URL form on demand. */
      web3d: v.web3d || null,
      web3dUrl: v.web3dUrl || null,
      premium: category === "select",
      certUsed: true,
      tags: (function () {
        var t = [];
        if ((v.web3d && v.web3d.frames && v.web3d.frames.length) || v.web3dUrl) t.push("360");
        if (images.length) t.push("Tru3D");
        if (virScore) t.push("VIR");
        return t;
      })(),
      featured: true,
      blurb: v.description || "",
      img: hero,
      thumb: hero,
      gallery: images.length ? images : hero ? [hero] : [],
      liveFromDms: true,
      source: v.source || "trusaas",
      daysInStock: v.daysInStock || null,
    };
  };

  TCSA.fetchTruSaasStock = async function () {
    var dealer = encodeURIComponent(TCSA.TRUSAAS.dealer || "truecars");
    var errors = [];
    for (var i = 0; i < TCSA.TRUSAAS.apis.length; i++) {
      var base = TCSA.TRUSAAS.apis[i];
      var url = base + (base.includes("?") ? "&" : "?") + "dealer=" + dealer;
      try {
        var res = await fetch(url, { cache: "no-store", mode: "cors" });
        if (!res.ok) {
          errors.push(url + " → " + res.status);
          continue;
        }
        var data = await res.json();
        var list = Array.isArray(data.vehicles) ? data.vehicles : Array.isArray(data) ? data : [];
        var mapped = list.map(TCSA.mapTruSaasVehicle).filter(Boolean);
        if (mapped.length) {
          console.info("[TCSA] Live stock from", url, "count=", mapped.length, "source=", data.source || "api");
          return { vehicles: mapped, url: url, source: data.source || "api" };
        }
        errors.push(url + " → empty");
      } catch (e) {
        errors.push(url + " → " + (e.message || e));
      }
    }
    console.warn("[TCSA] Live stock unavailable — no vehicles to show.", errors);
    return { vehicles: [], url: null, source: "empty" };
  };

  TCSA.loadLiveStock = async function () {
    var live = await TCSA.fetchTruSaasStock();
    var mock = (TCSA._staticVehicles || []).slice();

    if (live.vehicles.length) {
      var liveIds = {};
      live.vehicles.forEach(function (v) { liveIds[v.id] = true; });
      var kept = mock.filter(function (v) { return !liveIds[v.id]; });
      TCSA.vehicles = live.vehicles.concat(kept);
      TCSA.stockSource = live.source;
    } else {
      TCSA.vehicles = mock;
      TCSA.stockSource = mock.length ? "mock" : "empty";
    }

    window.dispatchEvent(
      new CustomEvent("tcsa:stock", {
        detail: { source: TCSA.stockSource, count: TCSA.vehicles.length, live: live.vehicles.length },
      })
    );
    return TCSA.vehicles;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      TCSA.loadLiveStock();
    });
  } else {
    TCSA.loadLiveStock();
  }
})();
