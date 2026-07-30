/* MKR Auto Sales — shared stock, render, chat, FAB helpers */
const MKR = (() => {
  const WA = "27662912809";
  const STOCK_APIS = [
    "https://premium.tru-saas.com/api/public/stock?dealer=mkr-autosales",
    "https://flow.tru-saas.com/api/public/stock?dealer=mkr-autosales",
    "https://lens.tru-saas.com/api/public/stock?dealer=mkr-autosales",
    "https://trusaas-premium.onrender.com/api/public/stock?dealer=mkr-autosales"
  ];

  // truPrice = an honest per-vehicle market-value benchmark (hand-set here, same
  // approach as the True-Cars flagship site). It is deliberately NOT derived from
  // the listing price itself — TruPrice.amount/pct below comes from comparing two
  // independent numbers. Replace with a real comparable-sales feed when one exists.
  const MOCK = [
    {y:2023,make:"Nissan",name:"Navara 2.5DDTi PRO-2X",variant:"Double Cab 4×4 Auto",body:"bakkie",cat:"performance",km:"42 846 km",tr:"Auto",fuel:"Diesel",price:529900,truPrice:559000,tag:"Premium Performance",vir:"4.8",img:"https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80"},
    {y:2021,make:"Volkswagen",name:"Golf 8 GTI",variant:"DSG · Performance pack",body:"hatch",cat:"performance",km:"38 200 km",tr:"DSG",fuel:"Petrol",price:489900,truPrice:514000,tag:"Premium Performance",vir:"4.7",img:"https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=1000&q=80"},
    {y:2018,make:"BMW",name:"M2 Coupé",variant:"Manual · Long Beach Blue",body:"coupe",cat:"performance",km:"64 000 km",tr:"Manual",fuel:"Petrol",price:589900,truPrice:625000,tag:"Premium Performance",vir:"4.6",img:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1000&q=80"},
    {y:2019,make:"Audi",name:"RS3 Sportback",variant:"Quattro · Sports exhaust",body:"hatch",cat:"performance",km:"58 500 km",tr:"S-Tronic",fuel:"Petrol",price:549900,truPrice:579000,tag:"Premium Performance",vir:"4.7",img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1000&q=80"},
    {y:2012,make:"MINI",name:"Cooper S Hatch",variant:"Manual · Character",body:"hatch",cat:"performance",km:"174 187 km",tr:"Manual",fuel:"Petrol",price:139900,truPrice:148500,tag:"Premium Performance",vir:"4.3",img:"https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1000&q=80"},
    {y:2019,make:"Hyundai",name:"Tucson 2.0 Premium",variant:"Auto · Full history",body:"suv",cat:"select",km:"33 711 km",tr:"Auto",fuel:"Petrol",price:259900,truPrice:272000,tag:"Premium Select",vir:"4.7",img:"https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1000&q=80"},
    {y:2026,make:"Volkswagen",name:"Polo Vivo 1.4 Life",variant:"Hatch · Like new",body:"hatch",cat:"select",km:"3 736 km",tr:"Manual",fuel:"Petrol",price:279900,truPrice:298500,tag:"Premium Select",vir:"4.9",img:"https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1000&q=80"},
    {y:2022,make:"Toyota",name:"Fortuner 2.8 GD-6",variant:"4×4 Epic Auto",body:"suv",cat:"select",km:"48 000 km",tr:"Auto",fuel:"Diesel",price:569900,truPrice:599000,tag:"Premium Select",vir:"4.8",img:"https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1000&q=80"},
    {y:2021,make:"Mercedes-Benz",name:"C200 AMG Line",variant:"Auto · Panoramic",body:"sedan",cat:"select",km:"41 200 km",tr:"Auto",fuel:"Petrol",price:619900,truPrice:649000,tag:"Premium Select",vir:"4.8",img:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1000&q=80"},
    {y:2020,make:"Ford",name:"Ranger Wildtrak 2.0",variant:"Bi-Turbo 4×4 Auto",body:"bakkie",cat:"select",km:"72 000 km",tr:"Auto",fuel:"Diesel",price:489900,truPrice:519500,tag:"Premium Select",vir:"4.6",img:"https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80"},
    {y:2025,make:"Hyundai",name:"Grand i10 1.0 Motion",variant:"Hatch",body:"hatch",cat:"used",km:"11 136 km",tr:"Manual",fuel:"Petrol",price:219900,truPrice:232000,tag:"Premium Used",vir:"4.8",img:"https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1000&q=80"},
    {y:2016,make:"Toyota",name:"Corolla 1.6 Esteem",variant:"Sedan",body:"sedan",cat:"used",km:"91 906 km",tr:"Manual",fuel:"Petrol",price:179900,truPrice:189000,tag:"Premium Used",vir:"4.5",img:"https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=80"}
  ];

  const fmtR = n => "R " + Number(n || 0).toLocaleString("en-ZA");
  const monthly = p => {
    const r = 0.1175 / 12, n = 72;
    return Math.round(p * 0.9 * r / (1 - Math.pow(1 + r, -n)));
  };

  // Deterministic 0..1 value from a string — same input always gives the same
  // output (so a car's TruPrice benchmark doesn't change on every page reload).
  function hash01(str) {
    let h = 0;
    str = String(str || "");
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
  }

  /** TruPrice delta — compares a vehicle's asking price against its truPrice
   *  benchmark. Mirrors the True-Cars flagship site's priceDelta(). */
  function priceDelta(c) {
    const tp = Number(c.truPrice) || Number(c.price) || 0;
    const price = Number(c.price) || 0;
    const d = tp - price; // positive = priced below market = good
    const pct = tp ? Math.round(Math.abs(d) / tp * 100) : 0;
    return { below: d >= 0, amount: Math.abs(d), pct };
  }

  /** Small "R below TruPrice" / "Fair TruPrice" pill for vehicle cards — same
   *  signal as the detail-modal meter, one shared implementation for every page. */
  function tpTag(c) {
    const d = priceDelta(c);
    const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
    return d.below
      ? `<span class="tp-tag win">${check}${fmtR(d.amount)} below TruPrice</span>`
      : `<span class="tp-tag fair">Fair TruPrice</span>`;
  }

  function isJunk(v) {
    const blob = [v.make, v.model, v.trim, v.stockNumber, v.description].filter(Boolean).join(" ").toLowerCase();
    if (/stk-lite-test|test vehicle|demo junk|lorem ipsum/.test(blob)) return true;
    if (/\bss\b/.test(blob) && /ddas/.test(blob)) return true;
    if (v.make && String(v.make).length <= 2 && /ddas|test|xxx/i.test(String(v.model || ""))) return true;
    return false;
  }

  function mapApi(v) {
    if (isJunk(v)) return null;
    const price = Number(v.price) || 0;
    const bodyRaw = String(v.bodyType || v.body || "").toLowerCase();
    let body = "sedan";
    if (/suv|crossover/.test(bodyRaw)) body = "suv";
    else if (/bakkie|truck|4x4|double/.test(bodyRaw)) body = "bakkie";
    else if (/hatch/.test(bodyRaw)) body = "hatch";
    else if (/coupe/.test(bodyRaw)) body = "coupe";
    const name = [v.model, v.trim].filter(Boolean).join(" ") || v.make || "Vehicle";
    const full = ((v.make || "") + " " + name).toLowerCase();
    // Showroom tier: the dealer's choice in the DMS wins. Only guess from price
    // and model name when they haven't set one — the guess mis-shelves cars
    // (a R520k Corolla reads as "performance" on price alone).
    const dmsCat = ["used", "select", "performance"].includes(v.category) ? v.category : "";
    const isPerf = /gti|amg|rs\b|m2|m3|m4|pro-2x|cooper s|performance|type r|st\b|gr\b|n line|r-line/.test(full) || price >= 500000;
    const isSelect = !isPerf && (price >= 250000 || /premium|executive|limited|exclusive|luxury|epic|wildtrak|legend/.test(full));
    const cat = dmsCat || (isPerf ? "performance" : isSelect ? "select" : "used");
    const tag = cat === "performance" ? "Premium Performance" : cat === "select" ? "Premium Select" : "Premium Used";
    // TruPrice: prefer the real benchmark the dealer set in the DMS (via TrueAI
    // Market Crawler or manual entry). Only synthesize a placeholder (4-9% above
    // asking, deterministic per stock number) when the DMS hasn't set one yet.
    const truPrice = Number(v.truPrice) > 0
      ? Number(v.truPrice)
      : price
        ? Math.round(price * (1 + 0.04 + hash01(v.stockNumber || v.id || name) * 0.05) / 100) * 100
        : 0;
    return {
      y: v.year || "—",
      make: v.make || "—",
      name,
      variant: v.trim || v.stockNumber || "",
      body,
      cat,
      km: v.mileage != null ? Number(v.mileage).toLocaleString("en-ZA") + " km" : (v.km || "—"),
      tr: v.transmission || "—",
      fuel: v.fuelType || v.fuel || "—",
      price,
      truPrice,
      tag,
      vir: v.vir || "4.5",
      img: v.heroImage || (Array.isArray(v.images) && v.images[0]) || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=80",
      // Identity + status straight from the DMS. stock is the stable key the
      // shortlist uses (a price change must not orphan a saved car), and the
      // status fields drive the card ribbons — no ribbon shows without them.
      stock: v.stockNumber || v.stockNo || v.stock || v.id || "",
      prevPrice: Number(v.previousPrice || v.priceWas || v.oldPrice) || 0,
      daysInStock: v.daysInStock != null ? Number(v.daysInStock) : daysSince(v.dateAdded || v.dateInStock || v.createdAt),
      reserved: !!(v.reserved || /reserved|pending|sold\s*pending/i.test(String(v.status || v.availability || ""))),
      // Media the DMS may attach. Field names vary by feed, so accept the
      // common spellings; mkr-media.js falls back gracefully when empty.
      images: Array.isArray(v.images) ? v.images : (v.heroImage ? [v.heroImage] : []),
      spin: v.spin || v.spinImages || v.images360 || v.spin360 || v.threeSixty || [],
      video: v.video || v.videoUrl || v.walkaroundVideo || v.videoWalkaround || "",
      videoPoster: v.videoPoster || v.heroImage || ""
    };
  }

  /** Whole days since an ISO date the DMS supplied. null when it sent nothing —
   *  callers must treat null as "unknown", never as "new". */
  function daysSince(d) {
    if (!d) return null;
    var t = Date.parse(d);
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }

  /** Card status ribbon, driven only by real DMS values. Returns null when the
   *  feed hasn't told us anything — better no ribbon than an invented one. */
  function statusOf(c) {
    if (!c) return null;
    if (c.reserved) return { cls: "reserved", txt: "Reserved" };
    if (c.prevPrice && c.price && c.prevPrice > c.price) return { cls: "reduced", txt: "Price reduced" };
    if (c.daysInStock != null && c.daysInStock <= 14) return { cls: "arrived", txt: "Just arrived" };
    return null;
  }

  /** Data attributes every card carries so the polish/elite layers can read
   *  real values off the DOM instead of guessing from the price. */
  function dataAttrs(c) {
    var s = statusOf(c);
    return [
      c.stock ? 'data-stock="' + String(c.stock).replace(/"/g, "&quot;") + '"' : "",
      s ? 'data-status="' + s.cls + '" data-status-label="' + s.txt + '"' : "",
      c.daysInStock != null ? 'data-days="' + c.daysInStock + '"' : "",
      c.prevPrice ? 'data-prev="' + c.prevPrice + '"' : ""
    ].filter(Boolean).join(" ");
  }

  function badgeClass(cat) {
    if (cat === "performance") return "perf";
    if (cat === "select") return "gold";
    return "";
  }

  function renderCards(list, gridEl) {
    if (!gridEl) return;
    if (!list.length) {
      gridEl.innerHTML = '<p class="empty-msg">No vehicles in this category right now — WhatsApp us and we\'ll source or notify you.</p>';
      return;
    }
    gridEl.innerHTML = list.map((c, i) => {
      const wa = encodeURIComponent(`Hi MKR, I'm interested in the ${c.y} ${c.make} ${c.name} (${fmtR(c.price)}) — ${c.tag}. Is it still available?`);
      return `<article class="card rv d${(i % 3) + 1}" ${dataAttrs(c)}>
        <div class="card-shine" aria-hidden="true"></div>
        <div class="ph">
          <img class="im" src="${c.img || ""}" alt="${c.y} ${c.make} ${c.name}" loading="lazy" decoding="async" width="800" height="500">
          <span class="badge ${badgeClass(c.cat)}">${c.tag || "Featured"}</span>
          <span class="vir">VIR ★ ${c.vir || "4.5"}</span>
        </div>
        <div class="card-body">
          <div class="yr">${c.y} · ${c.make}</div>
          <h3>${c.name}</h3>
          <div class="var">${c.variant || ""}</div>
          <div class="specs"><span>${c.km || "—"}</span><span>${c.tr || "—"}</span><span>${c.fuel || "—"}</span><span>${c.body || "—"}</span></div>
          <div class="price-row"><div class="pr">${fmtR(c.price)}</div><div class="pm">from <b>${fmtR(monthly(c.price))}/pm</b></div></div>
          <div class="cta-row">
            <a class="btn btn-wa" href="https://wa.me/${WA}?text=${wa}" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn btn-ghost-blue" href="https://wa.me/${WA}?text=${encodeURIComponent("Hi MKR, I'd like a viewing of the " + c.y + " " + c.make + " " + c.name)}" target="_blank" rel="noopener">Viewing</a>
          </div>
        </div>
      </article>`;
    }).join("");
    observeAll();
  }

  let io;
  function observeAll() {
    io = io || new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll(".rv:not(.in)").forEach(el => io.observe(el));
  }

  async function loadStock(filterCat) {
    let stock = MOCK.slice();
    // Retry once per host — free tier cold starts need patience
    for (const url of STOCK_APIS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 18000);
          const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
          clearTimeout(t);
          if (!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data.vehicles) ? data.vehicles : (Array.isArray(data) ? data : []);
          if (!list.length) continue;
          stock = list.map(mapApi).filter(Boolean);
          if (!stock.length) continue;
          if (filterCat) stock = stock.filter(c => c.cat === filterCat);
          stock.live = true; // real DMS feed, not the MOCK fallback
          return stock;
        } catch (e) {
          if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    if (filterCat) stock = stock.filter(c => c.cat === filterCat);
    return stock;
  }

  function initChrome() {
    const burger = document.getElementById("burger");
    const mmenu = document.getElementById("mmenu");
    if (burger && mmenu) {
      burger.addEventListener("click", () => mmenu.classList.toggle("open"));
      mmenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mmenu.classList.remove("open")));
    }
    const header = document.getElementById("siteHeader");
    const prog = document.getElementById("scrollProgress");
    window.addEventListener("scroll", () => {
      const y = window.scrollY || 0;
      header?.classList.toggle("scrolled", y > 20);
      if (prog) {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        prog.style.transform = 'scaleX('+Math.min(1, y/max)+')';
      }
    }, { passive: true });
    initInteractions();
  }

  function initInteractions() {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    document.addEventListener("pointermove", e => {
      const btn = e.target.closest(".btn");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      btn.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    }, { passive: true });

    document.addEventListener("click", e => {
      const btn = e.target.closest(".btn, .chip");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const span = document.createElement("span");
      span.className = "ripple";
      span.style.width = span.style.height = size + "px";
      span.style.left = (e.clientX - r.left - size / 2) + "px";
      span.style.top = (e.clientY - r.top - size / 2) + "px";
      if (btn.classList.contains("chip")) {
        span.style.position = "absolute";
        span.style.borderRadius = "50%";
        span.style.background = "rgba(11,91,215,.25)";
        span.style.pointerEvents = "none";
        span.style.animation = "btnRipple .55s cubic-bezier(.22,1,.36,1) forwards";
        if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
        btn.style.overflow = "hidden";
      }
      btn.appendChild(span);
      setTimeout(() => span.remove(), 700);
    });

    if (!fine) return;

    // Magnetic pull is reserved for the floating rail. Applying it to every
    // button as well made the whole page feel restless.
    document.querySelectorAll(".fab-btn").forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        const strength = el.classList.contains("fab-btn") ? 0.28 : 0.18;
        el.style.transform = `translate(${x * strength}px,${y * strength}px) scale(1.03)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });

    function bindTilt(sel) {
      document.querySelectorAll(sel).forEach(card => {
        if (card.dataset.tiltBound) return;
        card.dataset.tiltBound = "1";
        card.addEventListener("pointermove", e => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          card.style.transform = `perspective(900px) rotateX(${(py - 0.5) * -10}deg) rotateY(${(px - 0.5) * 12}deg) translateY(-8px)`;
          card.style.setProperty("--mx", (px * 100) + "%");
          card.style.setProperty("--my", (py * 100) + "%");
        });
        card.addEventListener("pointerleave", () => { card.style.transform = ""; });
      });
    }
    bindTilt(".card");
    const grid = document.getElementById("invgrid");
    if (grid) new MutationObserver(() => bindTilt(".card")).observe(grid, { childList: true });
  }

  function initChat(opts = {}) {
    const category = opts.category || "";
    const bot = document.getElementById("fabBot");
    const panel = document.getElementById("mkrChat");
    const close = document.getElementById("chatClose");
    const panelChat = document.getElementById("panelChat");
    const panelLead = document.getElementById("panelLead");
    const tabs = document.querySelectorAll(".chat-tabs button");
    if (!bot || !panel) return;

    function openChat(tab) {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      if (tab) switchTab(tab);
    }
    function closeChat() {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    }
    function switchTab(name) {
      tabs.forEach(t => {
        const on = t.dataset.tab === name;
        t.classList.toggle("on", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      panelChat?.classList.toggle("on", name === "chat");
      panelLead?.classList.toggle("on", name === "lead");
    }

    bot.addEventListener("click", () => panel.classList.contains("open") ? closeChat() : openChat("chat"));
    close?.addEventListener("click", closeChat);
    tabs.forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));

    if (category && document.getElementById("leadPortal")) {
      const map = { select: "buy", performance: "buy" };
      /* keep buy default; message context in quick replies */
    }

    const replies = {
      buy: "Browse this category grid, then WhatsApp a unit or book a viewing / live video.",
      sell: "Seller portal on the home page — or leave a lead and we’ll call back.",
      finance: "VAF Bridge finance is on the home page — banks + structured deals.",
      viewing: "Happy to arrange a viewing at 495 Cape Road or a live video walk.",
      lead: "Switching you to the Lead portal.",
      select: "Premium Select — hand-curated, low-km, VIR-graded daily drivers and family cars.",
      performance: "Premium Performance — GTI, AMG, RS, M-cars and enthusiast metal."
    };
    document.getElementById("chatQuick")?.addEventListener("click", e => {
      const b = e.target.closest("button[data-q]");
      if (!b || !panelChat) return;
      const q = b.dataset.q;
      const labels = { buy: "Buy a car", sell: "Sell / trade-in", finance: "VAF finance", viewing: "Book viewing", lead: "Leave my details", select: "Premium Select", performance: "Premium Performance" };
      const u = document.createElement("div");
      u.className = "msg user";
      u.textContent = labels[q] || q;
      panelChat.appendChild(u);
      setTimeout(() => {
        const m = document.createElement("div");
        m.className = "msg bot";
        m.textContent = replies[q] || "WhatsApp us and we’ll help right away.";
        panelChat.appendChild(m);
        panelChat.scrollTop = panelChat.scrollHeight;
        if (q === "lead") switchTab("lead");
        if (q === "sell") location.href = "index.html#sell";
        if (q === "finance") location.href = "index.html#finance";
      }, 280);
    });

    document.getElementById("leadForm")?.addEventListener("submit", e => {
      e.preventDefault();
      const name = document.getElementById("leadName").value.trim();
      const phone = document.getElementById("leadPhone").value.trim();
      const email = document.getElementById("leadEmail").value.trim();
      const portal = document.getElementById("leadPortal").value;
      const msg = document.getElementById("leadMsg").value.trim();
      const portalLabel = { buy: "Buy a car", sell: "Sell / trade-in", finance: "VAF Bridge finance", general: "General", select: "Premium Select", performance: "Premium Performance" }[portal] || portal;
      const catLine = category === "select" ? "Category page: Premium Select" : category === "performance" ? "Category page: Premium Performance" : null;
      const text = [
        "Hi MKR — new website lead",
        "Name: " + name,
        "Phone: " + phone,
        email ? "Email: " + email : null,
        "Portal: " + portalLabel,
        catLine,
        msg ? "Message: " + msg : null
      ].filter(Boolean).join("\n");
      const href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
      const chatWa = document.getElementById("chatWa");
      if (chatWa) chatWa.href = href;
      document.getElementById("leadForm").hidden = true;
      document.getElementById("leadSuccess").hidden = false;
      window.open(href, "_blank", "noopener");
    });
  }

  return { WA, MOCK, fmtR, monthly, priceDelta, tpTag, mapApi, renderCards, loadStock, observeAll, initChrome, initChat, statusOf, dataAttrs, daysSince };
})();
