/* ============================================================
   TRUECAR SA — TruSaaS live stock bridge
   Pulls public inventory from TruFlow Premium/Lite and merges into
   TCSA.vehicles. Static data.js remains the offline fallback.
   ============================================================ */
(function () {
  window.TCSA = window.TCSA || {};

  /** Live product hosts (Render free URLs) */
  TCSA.TRUSAAS = {
    dealer: "true-cars",
    apis: [
      "https://premium.tru-saas.com/api/public/stock",
      "https://flow.tru-saas.com/api/public/stock",
      "https://trusaas-premium.onrender.com/api/public/stock",
    ],
    /** Keep static demo cars when live feed is empty or partial */
    mergeMode: "prepend-live", // "prepend-live" | "live-only" | "static-only"
  };

  TCSA._staticVehicles = Array.isArray(TCSA.vehicles) ? TCSA.vehicles.slice() : [];

  function mapBody(raw) {
    const b = String(raw || "").toLowerCase();
    if (b.includes("suv") || b.includes("crossover")) return "suv";
    if (b.includes("bakkie") || b.includes("truck") || b.includes("4x4") || b.includes("double")) return "bakkie";
    if (b.includes("hatch")) return "hatch";
    if (b.includes("coupe")) return "coupe";
    return "sedan";
  }

  function isJunk(v) {
    const make = String(v.make || "").trim();
    const model = String(v.model || "").trim();
    if (!make || !model) return true;
    if (make.length < 2 || model.length < 2) return true;
    // test junk from pilot shoots
    if (/^ss$/i.test(make) || /^ddas$/i.test(model)) return true;
    return false;
  }

  /** Map TruSaaS public stock row → TCSA vehicle card shape */
  TCSA.mapTruSaasVehicle = function (v) {
    if (!v || isJunk(v)) return null;
    const price = Number(v.price || v.retailPrice || 0) || 0;
    const km = Number(v.mileage || v.km || 0) || 0;
    const stock = String(v.stockNumber || v.id || "").trim();
    const id = (stock || (v.year + "-" + v.make + "-" + v.model))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const images = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
    const hero = v.heroImage || images[0] || null;
    // TruPrice: prefer the real per-vehicle benchmark the dealer set in the DMS
    // (TrueAI Market Crawler or manual entry). Only synthesize a flat 6% estimate
    // when the DMS hasn't set one — same fallback rule as every other dealer site.
    const truecarPrice = Number(v.truPrice) > 0
      ? Number(v.truPrice)
      : price > 0 ? Math.round(price * 1.06) : 0;

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
      fuel: v.fuelType || v.fuel || "Petrol",
      trans: v.transmission || v.tr || "Automatic",
      body: mapBody(v.bodyType || v.body),
      power: "",
      drive: "",
      colour: v.color || v.colour || "",
      location: "Live · TruSaaS stock",
      badges: [{ t: "Live DMS", c: "hot" }],
      vir: Number(v.vir) || 92,
      lvs: false,
      premium: false,
      certUsed: true,
      tags: ["TruSaaS", "Live"],
      featured: true,
      blurb: v.description || "Live unit from TruSaaS Flow — photos & status from the yard system.",
      img: hero,
      gallery: images.length ? images : hero ? [hero] : [],
      liveFromDms: true,
      source: v.source || "trusaas",
    };
  };

  TCSA.fetchTruSaasStock = async function () {
    const dealer = encodeURIComponent(TCSA.TRUSAAS.dealer || "true-cars");
    const errors = [];
    for (const base of TCSA.TRUSAAS.apis) {
      const url = base + (base.includes("?") ? "&" : "?") + "dealer=" + dealer;
      try {
        const res = await fetch(url, { cache: "no-store", mode: "cors" });
        if (!res.ok) {
          errors.push(url + " → " + res.status);
          continue;
        }
        const data = await res.json();
        const list = Array.isArray(data.vehicles) ? data.vehicles : Array.isArray(data) ? data : [];
        const mapped = list.map(TCSA.mapTruSaasVehicle).filter(Boolean);
        if (mapped.length) {
          console.info("[TCSA] Live stock from", url, "count=", mapped.length, "source=", data.source || "api");
          return { vehicles: mapped, url: url, source: data.source || "api" };
        }
        errors.push(url + " → empty");
      } catch (e) {
        errors.push(url + " → " + (e.message || e));
      }
    }
    console.info("[TCSA] Live stock unavailable; using static catalogue.", errors);
    return { vehicles: [], url: null, source: "static" };
  };

  /**
   * Merge live feed into TCSA.vehicles.
   * Call after data.js loads. Pages that render on DOMContentLoaded
   * should await this (or listen for tcsa:stock).
   */
  TCSA.loadLiveStock = async function () {
    if (TCSA.TRUSAAS.mergeMode === "static-only") {
      TCSA.vehicles = TCSA._staticVehicles.slice();
      TCSA.stockSource = "static";
      return TCSA.vehicles;
    }

    const live = await TCSA.fetchTruSaasStock();
    const staticList = TCSA._staticVehicles.slice();

    if (TCSA.TRUSAAS.mergeMode === "live-only" && live.vehicles.length) {
      TCSA.vehicles = live.vehicles;
      TCSA.stockSource = live.source;
    } else if (live.vehicles.length) {
      // Live units first; drop static rows with same stock# / id
      const liveIds = new Set(live.vehicles.map(function (v) { return v.id; }));
      const liveStocks = new Set(live.vehicles.map(function (v) { return v.stockNumber; }).filter(Boolean));
      const rest = staticList.filter(function (v) {
        if (liveIds.has(v.id)) return false;
        if (v.stockNumber && liveStocks.has(v.stockNumber)) return false;
        return true;
      });
      TCSA.vehicles = live.vehicles.concat(rest);
      TCSA.stockSource = live.source + "+static";
    } else {
      TCSA.vehicles = staticList;
      TCSA.stockSource = "static";
    }

    window.dispatchEvent(
      new CustomEvent("tcsa:stock", {
        detail: { source: TCSA.stockSource, count: TCSA.vehicles.length, live: live.vehicles.length },
      })
    );
    return TCSA.vehicles;
  };

  // Auto-run (pages can still re-render on tcsa:stock)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      TCSA.loadLiveStock();
    });
  } else {
    TCSA.loadLiveStock();
  }
})();
