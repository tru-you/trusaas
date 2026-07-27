/* ============================================================
   TRUECAR SA — TruSaaS live stock bridge
   Pulls public inventory from TruFlow Premium and populates
   TCSA.vehicles. No static fallback — this is a live DMS site.
   ============================================================ */
(function () {
  window.TCSA = window.TCSA || {};

  TCSA.TRUSAAS = {
    dealer: "truecars",
    apis: [
      "https://premium.tru-saas.com/api/public/stock",
      "https://flow.tru-saas.com/api/public/stock",
      "https://trusaas-premium.onrender.com/api/public/stock",
    ],
    mergeMode: "live-only",
  };

  TCSA._staticVehicles = [];

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
      lvs: !!v.walkaroundVideo,
      walkaroundVideo: v.walkaroundVideo || null,
      videoPoster: v.videoPoster || hero,
      premium: category === "select",
      certUsed: true,
      tags: (function () {
        var t = [];
        if (images.length) t.push("Tru3D");
        if (virScore) t.push("VIR");
        if (v.walkaroundVideo) t.push("LVS");
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

    if (live.vehicles.length) {
      TCSA.vehicles = live.vehicles;
      TCSA.stockSource = live.source;
    } else {
      TCSA.vehicles = [];
      TCSA.stockSource = "empty";
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
