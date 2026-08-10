/**
 * TruSaaS Public Stock Widget
 * One embed for every dealership HTML site — works with TruFlow Premium, Lite, or TruLens.
 *
 * Usage:
 *   <div id="trusass-stock"></div>
 *   <script
 *     src="http://localhost:3001/embed/stock-widget.js"
 *     data-api="http://localhost:3001/api/public/stock"
 *     data-dealer="mkr-autosales"
 *     data-theme="light"
 *     data-wa="27662912809"
 *   ></script>
 *
 * Optional data attributes:
 *   data-container  — element id (default: trusass-stock)
 *   data-limit      — max cards (default: 24)
 *   data-theme      — light | dark
 *   data-wa         — WhatsApp number for enquire links
 */
(function () {
  const script = document.currentScript;
  if (!script) return;

  const containerId = script.getAttribute("data-container") || "trusass-stock";
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("TruSaaS stock widget: #" + containerId + " not found");
    return;
  }

  const apiAttr = script.getAttribute("data-api") || "";
  // Default: same origin as the script, /api/public/stock
  let apiBase = apiAttr;
  if (!apiBase) {
    try {
      apiBase = new URL(script.src).origin + "/api/public/stock";
    } catch {
      apiBase = "/api/public/stock";
    }
  }

  const dealer = script.getAttribute("data-dealer") || "demo";
  const theme = script.getAttribute("data-theme") || "light";
  const limit = parseInt(script.getAttribute("data-limit") || "24", 10) || 24;
  const wa = (script.getAttribute("data-wa") || "").replace(/\D/g, "");

  const styles = document.createElement("style");
  styles.textContent = `
    .ts-stock{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${theme === "dark" ? "#E8EEF6" : "#0A1626"};}
    .ts-stock *{box-sizing:border-box}
    .ts-meta{font-size:12px;opacity:.65;margin:0 0 14px}
    .ts-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
    .ts-filters input,.ts-filters select{
      padding:10px 12px;border-radius:10px;border:1px solid ${theme === "dark" ? "rgba(255,255,255,.12)" : "#E3E9F1"};
      background:${theme === "dark" ? "#0f1826" : "#fff"};color:inherit;font-size:13px;min-width:140px
    }
    .ts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
    .ts-card{
      border-radius:16px;overflow:hidden;border:1px solid ${theme === "dark" ? "rgba(255,255,255,.08)" : "#E3E9F1"};
      background:${theme === "dark" ? "#0f1826" : "#fff"};
      box-shadow:0 12px 30px -18px rgba(6,17,35,.35);transition:transform .2s ease,box-shadow .2s ease
    }
    .ts-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px -16px rgba(6,17,35,.4)}
    .ts-img{aspect-ratio:16/10;background:${theme === "dark" ? "#1a2c3d" : "#F3F4F6"};position:relative;overflow:hidden}
    .ts-img img{width:100%;height:100%;object-fit:cover;display:block}
    .ts-badge{position:absolute;top:10px;left:10px;background:#0B5BD7;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:.04em}
    .ts-photos{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border-radius:999px}
    .ts-body{padding:14px 14px 16px}
    .ts-title{font-size:16px;font-weight:800;line-height:1.25;margin:0 0 4px}
    .ts-sub{font-size:12px;opacity:.65;margin:0 0 10px}
    .ts-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
    .ts-tag{font-size:11px;padding:4px 8px;border-radius:6px;background:${theme === "dark" ? "rgba(255,255,255,.06)" : "#F3F4F6"};opacity:.9}
    .ts-price{font-size:20px;font-weight:900;color:${theme === "dark" ? "#4D9BFF" : "#0B5BD7"};margin-bottom:12px}
    .ts-btn{
      display:block;width:100%;text-align:center;text-decoration:none;padding:11px 12px;border-radius:10px;
      background:#0B5BD7;color:#fff;font-weight:700;font-size:13px
    }
    .ts-btn:hover{filter:brightness(1.08)}
    .ts-empty,.ts-loading{text-align:center;padding:40px 16px;opacity:.7;font-size:14px}
    .ts-powered{margin-top:16px;font-size:10px;opacity:.45;text-align:right}
    .ts-powered b{opacity:.8}
  `;
  document.head.appendChild(styles);

  function zar(n) {
    if (n == null || n === "" || isNaN(Number(n))) return "POA";
    return "R " + Number(n).toLocaleString("en-ZA");
  }
  function km(n) {
    if (n == null || n === "") return null;
    return Number(n).toLocaleString("en-ZA") + " km";
  }
  function waLink(v) {
    if (!wa) return null;
    const msg = encodeURIComponent(
      `Hi, I'm interested in ${v.year} ${v.make} ${v.model} (Stock ${v.stockNumber}).`
    );
    return `https://wa.me/${wa}?text=${msg}`;
  }

  let all = [];

  function card(v) {
    const title = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim();
    const hero = v.heroImage || (v.images && v.images[0]) || "";
    const img = hero
      ? `<img src="${hero}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:.4;font-weight:800">${(v.make || "TS").slice(0, 2).toUpperCase()}</div>`;
    const tags = [km(v.mileage), v.transmission, v.fuelType, v.bodyType].filter(Boolean);
    const href = waLink(v);
    return `
      <article class="ts-card" data-make="${v.make || ""}" data-year="${v.year || ""}" data-q="${title.toLowerCase()} ${v.trim || ""} ${v.stockNumber || ""}">
        <div class="ts-img">
          ${img}
          <span class="ts-badge">${v.stockNumber || "STOCK"}</span>
          ${(v.photoCount || (v.images && v.images.length) || 0) > 0 ? `<span class="ts-photos">${v.photoCount || v.images.length} photos</span>` : ""}
        </div>
        <div class="ts-body">
          <h3 class="ts-title">${title}</h3>
          <p class="ts-sub">${v.trim || "Standard"} · ${v.color || "—"}</p>
          <div class="ts-tags">${tags.map((t) => `<span class="ts-tag">${t}</span>`).join("")}</div>
          <div class="ts-price">${zar(v.price)}</div>
          ${
            href
              ? `<a class="ts-btn" href="${href}" target="_blank" rel="noopener">Enquire on WhatsApp</a>`
              : `<span class="ts-btn" style="opacity:.7;cursor:default">Available</span>`
          }
        </div>
      </article>`;
  }

  function paint(list) {
    if (!list.length) {
      container.innerHTML = `<div class="ts-stock"><div class="ts-empty">No vehicles available right now.</div></div>`;
      return;
    }
    const makes = [...new Set(list.map((v) => v.make).filter(Boolean))].sort();
    const years = [...new Set(list.map((v) => v.year).filter(Boolean))].sort((a, b) => b - a);
    container.innerHTML = `
      <div class="ts-stock">
        <div class="ts-meta">Showing <b>${list.length}</b> vehicle${list.length === 1 ? "" : "s"} · live from TruSaaS</div>
        <div class="ts-filters">
          <input id="ts-q" type="search" placeholder="Search make, model, stock…">
          <select id="ts-make"><option value="">All makes</option>${makes.map((m) => `<option value="${m}">${m}</option>`).join("")}</select>
          <select id="ts-year"><option value="">All years</option>${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>
        </div>
        <div class="ts-grid" id="ts-grid">${list.slice(0, limit).map(card).join("")}</div>
        <div class="ts-powered">Powered by <a href="https://true-cars.co.za/truesaas.html" target="_blank" rel="noopener" style="color:inherit"><b>TruSaaS</b></a> · <a href="https://true-cars.co.za" target="_blank" rel="noopener" style="color:inherit">true-cars.co.za</a></div>
      </div>`;

    const apply = () => {
      const q = (document.getElementById("ts-q").value || "").toLowerCase();
      const make = document.getElementById("ts-make").value;
      const year = document.getElementById("ts-year").value;
      const filtered = all.filter((v) => {
        const hay = `${v.year} ${v.make} ${v.model} ${v.trim || ""} ${v.stockNumber || ""}`.toLowerCase();
        return (!q || hay.includes(q)) && (!make || v.make === make) && (!year || String(v.year) === year);
      });
      document.getElementById("ts-grid").innerHTML = filtered.slice(0, limit).map(card).join("");
      container.querySelector(".ts-meta").innerHTML =
        `Showing <b>${filtered.length}</b> vehicle${filtered.length === 1 ? "" : "s"} · live from TruSaaS`;
    };
    document.getElementById("ts-q").addEventListener("input", apply);
    document.getElementById("ts-make").addEventListener("change", apply);
    document.getElementById("ts-year").addEventListener("change", apply);
  }

  container.innerHTML = `<div class="ts-stock"><div class="ts-loading">Loading live stock…</div></div>`;

  const url = apiBase.includes("?")
    ? `${apiBase}&dealer=${encodeURIComponent(dealer)}`
    : `${apiBase}?dealer=${encodeURIComponent(dealer)}`;

  fetch(url, { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      const list = Array.isArray(data.vehicles)
        ? data.vehicles
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
      all = list;
      if (!all.length) {
        container.innerHTML = `<div class="ts-stock"><div class="ts-empty">No published stock yet. Export from TruLens → DMS, then refresh.</div></div>`;
        return;
      }
      paint(all);
    })
    .catch((err) => {
      console.error("TruSaaS stock widget error", err);
      container.innerHTML = `<div class="ts-stock"><div class="ts-empty">Could not load stock feed. Check API URL / CORS.</div></div>`;
    });
})();
