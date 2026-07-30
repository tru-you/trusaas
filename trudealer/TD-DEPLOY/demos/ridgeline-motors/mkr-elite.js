/* Ridgeline Elite — shortlist & compare, structured data, accessibility, back-to-top
   Shared across index.html, premium-used.html, premium-select.html, premium-performance.html

   Everything here is DOM-driven: it reads the already-rendered stock cards rather
   than the stock array, so it works identically on the home page (inline render)
   and the category pages (Ridgeline.renderCards), and survives a live DMS re-render. */
(function () {
  "use strict";

  var WA = "15125550142";
  var KEY = "mkr:saved:v1";
  var MAX = 4; // side-by-side compare stays readable at four

  /* ===== STORE ===== */
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    paintCounts();
    paintHearts();
  }
  var saved = read();
  var has = function (id) { return saved.some(function (c) { return c.id === id; }); };

  /* ===== CARD READER ===== */
  function bgUrl(el) {
    if (!el) return "";
    // Cards render a real <img> now (lazy, sized, alt-texted); older markup used
    // a background-image div, so both shapes are still read.
    if (el.tagName === "IMG") return el.getAttribute("src") || "";
    var m = /url\(["']?([^"')]+)/.exec(el.style.backgroundImage || "");
    return m ? m[1] : "";
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function readCard(card) {
    var txt = function (sel) { var e = card.querySelector(sel); return e ? e.textContent.trim() : ""; };
    var price = +(txt(".pr").replace(/[^\d]/g, "")) || 0;
    var specs = Array.prototype.map.call(card.querySelectorAll(".specs span"), function (s) { return s.textContent.trim(); });
    var head = txt(".yr").split("·"); // "2023 · Nissan"
    var name = txt("h3");
    // Prefer the DMS stock number: it survives a price change, where a slug
    // built from the price would orphan anything already shortlisted.
    var stock = card.getAttribute("data-stock");
    return {
      id: stock ? "stk-" + slug(stock) : slug(txt(".yr") + "-" + name + "-" + price),
      stock: stock || "",
      y: (head[0] || "").trim(),
      make: (head[1] || "").trim(),
      name: name,
      variant: txt(".var"),
      km: specs[0] || "", tr: specs[1] || "", fuel: specs[2] || "", body: specs[3] || "",
      price: price,
      pm: txt(".pm").replace(/^from\s*/i, ""),
      vir: txt(".vir").replace(/[^\d.]/g, ""),
      tag: txt(".badge"),
      img: bgUrl(card.querySelector(".im")),
      url: location.pathname.split("/").pop() || "index.html"
    };
  }

  /* ===== HEARTS ON CARDS ===== */
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  function decorate() {
    var cards = document.querySelectorAll(".card:not([data-mkr-save])");
    Array.prototype.forEach.call(cards, function (card) {
      card.setAttribute("data-mkr-save", "1");
      var ph = card.querySelector(".ph");
      if (!ph) return;
      var data = readCard(card);
      card.setAttribute("data-vid", data.id);
      // Keep a shortlisted car in step with the live feed — if the DMS drops the
      // price, the drawer must not keep quoting yesterday's number.
      if (has(data.id)) {
        var changed = false;
        saved = saved.map(function (c) {
          if (c.id !== data.id) return c;
          if (c.price !== data.price || c.km !== data.km) changed = true;
          return data;
        });
        if (changed) write(saved);
      }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mkr-save" + (has(data.id) ? " on" : "");
      b.innerHTML = HEART;
      b.setAttribute("aria-pressed", has(data.id) ? "true" : "false");
      b.setAttribute("aria-label", "Save " + data.y + " " + data.make + " " + data.name + " to shortlist");
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        toggle(readCard(card), b);
      });
      ph.appendChild(b);
    });
  }

  function toggle(data, btn) {
    if (has(data.id)) {
      saved = saved.filter(function (c) { return c.id !== data.id; });
      toast("Removed from shortlist");
    } else {
      if (saved.length >= MAX) { toast("Shortlist full — compare holds " + MAX + " cars"); return; }
      saved = saved.concat([data]);
      if (btn) { btn.classList.add("pop"); setTimeout(function () { btn.classList.remove("pop"); }, 500); }
      toast("Saved — " + saved.length + " in your shortlist");
    }
    write(saved);
    if (drawer && drawer.classList.contains("open")) paintDrawer();
  }

  function paintHearts() {
    Array.prototype.forEach.call(document.querySelectorAll(".card[data-vid]"), function (card) {
      var b = card.querySelector(".mkr-save");
      if (!b) return;
      var on = has(card.getAttribute("data-vid"));
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  /* ===== TRIGGERS (header + mobile bar) ===== */
  var BOOKMARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

  function mountTriggers() {
    var ctas = document.querySelector(".nav-ctas");
    if (ctas && !ctas.querySelector(".mkr-saved-btn")) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mkr-saved-btn";
      b.innerHTML = BOOKMARK + "Shortlist <span class=\"n\">0</span>";
      b.addEventListener("click", openDrawer);
      ctas.insertBefore(b, ctas.firstChild);
    }
    var bar = document.querySelector(".mkr-mbar");
    if (bar && !bar.querySelector(".mb-saved")) {
      var a = document.createElement("button");
      a.type = "button";
      a.className = "mb-saved";
      a.innerHTML = BOOKMARK + "Saved<span class=\"n\">0</span>";
      a.addEventListener("click", openDrawer);
      bar.appendChild(a);
    }
    paintCounts();
  }

  function paintCounts() {
    Array.prototype.forEach.call(document.querySelectorAll(".mkr-saved-btn, .mb-saved"), function (el) {
      var n = el.querySelector(".n");
      if (n) n.textContent = saved.length;
      el.setAttribute("data-empty", saved.length ? "0" : "1");
    });
  }

  /* ===== DRAWER ===== */
  var drawer = null, lastFocus = null;

  function buildDrawer() {
    drawer = document.createElement("div");
    drawer.className = "mkr-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "Your shortlist");
    drawer.innerHTML =
      '<div class="mkr-dw">'
      + '<div class="mkr-dw-head">'
      + '<div><h2>Your shortlist</h2><span class="sub" id="mkrDwSub"></span></div>'
      + '<div class="sp"></div>'
      + '<button type="button" class="mkr-dw-x" aria-label="Close shortlist">&#10005;</button>'
      + '</div>'
      + '<div class="mkr-dw-body" id="mkrDwBody"></div>'
      + '</div>';
    document.body.appendChild(drawer);
    drawer.addEventListener("click", function (e) { if (e.target === drawer) closeDrawer(); });
    drawer.querySelector(".mkr-dw-x").addEventListener("click", closeDrawer);
  }

  function fmtR(n) { return "$" + Number(n || 0).toLocaleString("en-US"); }
  function kmNum(s) { return +(String(s).replace(/[^\d]/g, "")) || Infinity; }

  function paintDrawer() {
    var body = document.getElementById("mkrDwBody");
    var sub = document.getElementById("mkrDwSub");
    if (!body) return;
    if (sub) sub.textContent = saved.length
      ? saved.length + " of " + MAX + " compared · saved on this device"
      : "Tap the heart on any car to compare";

    if (!saved.length) {
      body.innerHTML =
        '<div class="mkr-dw-empty">' + BOOKMARK
        + '<p>Nothing shortlisted yet</p>'
        + '<small>Tap the heart on any vehicle to line it up here — up to ' + MAX + ' side by side,<br>then send the whole list to us on Text in one tap.</small>'
        + '</div>';
      return;
    }

    var bestPrice = Math.min.apply(null, saved.map(function (c) { return c.price || Infinity; }));
    var bestKm = Math.min.apply(null, saved.map(function (c) { return kmNum(c.km); }));

    body.innerHTML =
      '<div class="mkr-cmp">'
      + saved.map(function (c) {
        var row = function (label, val, best) {
          return '<div><span>' + label + '</span><b' + (best ? ' class="best"' : '') + '>' + (val || "—") + '</b></div>';
        };
        return '<article class="mkr-cmp-card">'
          + (c.price === bestPrice && saved.length > 1 ? '<span class="mkr-cmp-flag">Lowest price</span>' : '')
          + '<button type="button" class="mkr-cmp-x" data-rm="' + c.id + '" aria-label="Remove ' + c.name + ' from shortlist">&#10005;</button>'
          + '<div class="im" style="background-image:url(\'' + c.img + '\')"></div>'
          + '<div class="in">'
          + '<div class="yr">' + c.y + ' · ' + c.make + '</div>'
          + '<h3>' + c.name + '</h3>'
          + '<div class="var">' + (c.variant || "") + '</div>'
          + '<div class="pr">' + fmtR(c.price) + '</div>'
          + '<div class="pm">' + (c.pm || "") + '</div>'
          + '<div class="mkr-cmp-rows">'
          + row("Mileage", c.km, kmNum(c.km) === bestKm && saved.length > 1)
          + row("Gearbox", c.tr)
          + row("Fuel", c.fuel)
          + row("Body", c.body)
          + row("VIR", c.vir ? "★ " + c.vir : "")
          + row("Lane", c.tag)
          + '</div></div></article>';
      }).join("")
      + '</div>'
      + '<div class="mkr-dw-acts">'
      + '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + encodeURIComponent(waText()) + '">Text this shortlist</a>'
      + '<a class="btn btn-ghost-blue" href="index.html#finance">Finance these</a>'
      + '<button type="button" class="mkr-dw-clear">Clear all</button>'
      + '</div>'
      + '<div class="mkr-dw-note">Your shortlist is stored on this device only — no account, no sign-up. '
      + 'Send it through and a consultant comes back with availability, a firm out-the-door price and a VIR report for each unit.</div>';

    Array.prototype.forEach.call(body.querySelectorAll("[data-rm]"), function (b) {
      b.addEventListener("click", function () {
        saved = saved.filter(function (c) { return c.id !== b.getAttribute("data-rm"); });
        write(saved); paintDrawer();
      });
    });
    var clear = body.querySelector(".mkr-dw-clear");
    if (clear) clear.addEventListener("click", function () { saved = []; write(saved); paintDrawer(); toast("Shortlist cleared"); });
  }

  function waText() {
    return ["Hi Ridgeline — I've shortlisted these from your site:"]
      .concat(saved.map(function (c, i) {
        return (i + 1) + ". " + c.y + " " + c.make + " " + c.name + (c.variant ? " (" + c.variant + ")" : "") + " — " + fmtR(c.price) + " · " + c.km;
      }))
      .concat(["", "Are they all still available, and what would you do on the best one?"])
      .join("\n");
  }

  function openDrawer() {
    if (!drawer) buildDrawer();
    lastFocus = document.activeElement;
    paintDrawer();
    drawer.classList.add("open");
    document.body.style.overflow = "hidden";
    var x = drawer.querySelector(".mkr-dw-x");
    if (x) x.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ===== TOAST ===== */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "mkr-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  /* ===== ACCESSIBILITY ===== */
  function a11y() {
    if (!document.querySelector(".mkr-skip")) {
      var target = document.getElementById("stock") ? "stock" : (document.getElementById("top") ? "top" : null);
      if (target) {
        var a = document.createElement("a");
        a.className = "mkr-skip";
        a.href = "#" + target;
        a.textContent = "Skip to " + (target === "stock" ? "stock" : "content");
        document.body.insertBefore(a, document.body.firstChild);
      }
    }
    var burger = document.getElementById("burger");
    var mmenu = document.getElementById("mmenu");
    if (burger && mmenu) {
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-controls", "mmenu");
      burger.addEventListener("click", function () {
        burger.setAttribute("aria-expanded", mmenu.classList.contains("open") ? "true" : "false");
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (drawer && drawer.classList.contains("open")) { closeDrawer(); return; }
      if (mmenu && mmenu.classList.contains("open")) {
        mmenu.classList.remove("open");
        if (burger) burger.setAttribute("aria-expanded", "false");
      }
    });
    // The card image is decorative background; give the card itself a name.
    Array.prototype.forEach.call(document.querySelectorAll(".card[data-vid]:not([aria-label])"), function (c) {
      var h = c.querySelector("h3"), y = c.querySelector(".yr");
      if (h) c.setAttribute("aria-label", (y ? y.textContent.trim() + " " : "") + h.textContent.trim());
    });
  }

  /* ===== BACK TO TOP ===== */
  function backToTop() {
    if (document.querySelector(".mkr-top")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mkr-top";
    b.setAttribute("aria-label", "Back to top");
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    b.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
    });
    document.body.appendChild(b);
    window.addEventListener("scroll", function () {
      b.classList.toggle("show", (window.scrollY || 0) > 900);
    }, { passive: true });
  }

  /* ===== STRUCTURED DATA (SEO) ===== */
  var DEALER = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": "https://ridgelinemotors.example/#dealer",
    name: "Ridgeline Motors",
    description: "Premium pre-owned vehicle dealership in Austin — Premium Used, Premium Select and Premium Performance, with VAF Bridge finance, trade-ins and free nationwide delivery.",
    url: "https://ridgelinemotors.example/",
    logo: "https://ridgelinemotors.example/demo-logo.svg",
    image: "https://ridgelinemotors.example/demo-logo.svg",
    telephone: "+15125550142",
    priceRange: "RR",
    currenciesAccepted: "ZAR",
    areaServed: { "@type": "Country", name: "United States" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "4400 South Congress Ave",
      addressLocality: "Austin",
      addressRegion: "Central Texas",
      addressCountry: "ZA"
    },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:30" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "08:00", closes: "14:00" }
    ]
    // NOTE: no aggregateRating here on purpose. Google requires the rating to be
    // genuine, verifiable and visible on the page. Add it back only once real
    // review data is wired in — never from the placeholder testimonials.
  };

  function jsonld(id, obj) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(obj);
  }

  function stockSchema() {
    var cards = document.querySelectorAll(".card[data-vid]");
    if (!cards.length) return;
    var items = Array.prototype.map.call(cards, function (card, i) {
      var c = readCard(card);
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Car",
          name: c.y + " " + c.make + " " + c.name,
          brand: { "@type": "Brand", name: c.make },
          model: c.name,
          vehicleModelDate: c.y,
          bodyType: c.body,
          fuelType: c.fuel,
          vehicleTransmission: c.tr,
          mileageFromOdometer: { "@type": "QuantitativeValue", value: kmNum(c.km) === Infinity ? undefined : kmNum(c.km), unitCode: "KMT" },
          image: c.img,
          offers: {
            "@type": "Offer",
            price: c.price,
            priceCurrency: "ZAR",
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/UsedCondition",
            seller: { "@id": "https://ridgelinemotors.example/#dealer" }
          }
        }
      };
    });
    jsonld("mkr-ld-stock", {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: (document.title || "Ridgeline Motors").split("—")[0].trim() + " stock",
      numberOfItems: items.length,
      itemListElement: items
    });
  }

  function seo() {
    jsonld("mkr-ld-dealer", DEALER);
    stockSchema();
  }

  /* ===== INIT ===== */
  function refresh() {
    // localStorage is the source of truth — re-read before decorating so the
    // in-memory copy can't drift (another tab, or a write between renders).
    saved = read();
    decorate();
    a11y();
    stockSchema();
  }

  function init() {
    try { mountTriggers(); } catch (e) {}
    try { refresh(); } catch (e) {}
    try { seo(); } catch (e) {}
    try { backToTop(); } catch (e) {}

    var grid = document.getElementById("invgrid");
    if (grid) new MutationObserver(function () { try { refresh(); } catch (e) {} }).observe(grid, { childList: true });

    // mkr-polish.js builds the mobile bar; pick it up whenever it lands.
    var bodyMo = new MutationObserver(function () {
      if (document.querySelector(".mkr-mbar") && !document.querySelector(".mb-saved")) {
        try { mountTriggers(); } catch (e) {}
      }
    });
    bodyMo.observe(document.body, { childList: true });

    // Another tab changed the shortlist.
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY) return;
      saved = read();
      paintCounts(); paintHearts();
      if (drawer && drawer.classList.contains("open")) paintDrawer();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.RidgelineElite = { open: openDrawer, close: closeDrawer, saved: function () { return saved.slice(); } };
})();
