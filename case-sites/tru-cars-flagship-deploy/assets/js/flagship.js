/* ==============================================================
   TRUECARS SA — FLAGSHIP DOM AUGMENTATION
   Loads LAST. Additive only — no DOM restructure of existing
   markup. Adds:
     · eyebrows above every H2
     · custom cursor
     · TruOrbit signature section
     · Editorial outro/footer moment
     · Tru3D → TruOrbit label swap
     · Scroll gate for mobile TruAfford launcher
   ============================================================== */
(function () {
  "use strict";
  if (window.__TC_FLAGSHIP__) return;
  window.__TC_FLAGSHIP__ = true;

  var doc = document;

  /* --- 1 · Tru3D → TruOrbit label swap in visible text -------- */
  function relabelTru3D() {
    var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !/Tru3D/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p || p.tagName === "SCRIPT" || p.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node, batch = [];
    while ((node = walker.nextNode())) batch.push(node);
    batch.forEach(function (n) { n.nodeValue = n.nodeValue.replace(/Tru3D/g, "TruOrbit"); });
  }

  /* --- 2 · Eyebrows above every H2 --------------------------- */
  var EYEBROWS = [
    { rx: /buy with confidence/i,       label: "The promise" },
    { rx: /three simple steps/i,        label: "How it works" },
    { rx: /featured stock/i,            label: "The floor" },
    { rx: /orbit|every mark/i,          label: "TruOrbit · Live capture" },
    { rx: /ai[- ]inspected/i,           label: "TruLens · Every car" },
    { rx: /we.?ll buy your car/i,       label: "Trade-in" },
    { rx: /additional products/i,       label: "The stack" },
    { rx: /shop by budget/i,            label: "Ways in" },
    { rx: /engineered for adrenaline/i, label: "Performance" },
    { rx: /verified inspection/i,       label: "The report" },
    { rx: /deliver to your door/i,      label: "Nationwide delivery" },
    { rx: /hand[- ]?curated|finest/i,   label: "Premium Select" },
    { rx: /find your car/i,             label: "This week" },
    { rx: /wants you back/i,            label: "— The close —" }
  ];
  function eyebrowFor(text) {
    var t = String(text || "");
    for (var i = 0; i < EYEBROWS.length; i++) if (EYEBROWS[i].rx.test(t)) return EYEBROWS[i].label;
    return null;
  }
  function injectEyebrows() {
    doc.querySelectorAll("h2").forEach(function (h) {
      if (h.dataset.fsEyebrow === "1") return;
      // Skip if the parent already contains an eyebrow-ish element right above it
      var prev = h.previousElementSibling;
      if (prev && (prev.classList.contains("fs-eyebrow") ||
                   prev.classList.contains("eyebrow") ||
                   prev.classList.contains("kicker") ||
                   prev.classList.contains("hero-demo-badge"))) {
        h.dataset.fsEyebrow = "1";
        return;
      }
      var label = eyebrowFor(h.textContent);
      if (!label) return;
      var e = doc.createElement("div");
      e.className = "fs-eyebrow";
      e.innerHTML = '<span class="fs-pulse" aria-hidden="true"></span>' + label;
      h.parentNode.insertBefore(e, h);
      h.dataset.fsEyebrow = "1";
    });
  }

  /* --- 3 · Custom cursor (desktop pointer only) -------------- */
  function mountCursor() {
    var mq = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)");
    var c = doc.createElement("div");
    c.className = "fs-cursor";
    c.style.display = mq.matches ? "" : "none";
    doc.body.appendChild(c);
    var apply = function () { c.style.display = mq.matches ? "" : "none"; };
    (mq.addEventListener ? mq.addEventListener("change", apply) : mq.addListener(apply));
    window.addEventListener("resize", apply);
    var x = 0, y = 0, tx = 0, ty = 0;
    function move(e) { tx = e.clientX; ty = e.clientY; }
    doc.addEventListener("mousemove", move, { passive: true });
    doc.addEventListener("mousedown", function () { c.classList.add("is-down"); });
    doc.addEventListener("mouseup",   function () { c.classList.remove("is-down"); });
    var HOVER = "a, button, [role='button'], input, select, textarea, label, .veh-card, .card, .fs-cta";
    doc.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(HOVER)) c.classList.add("is-hover");
    });
    doc.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(HOVER)) c.classList.remove("is-hover");
    });
    (function loop() {
      x += (tx - x) * .28;
      y += (ty - y) * .28;
      c.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();
  }

  /* --- 4 · TruOrbit signature section ------------------------ */

  /** Local 36-frame 360° capture (Honda) — real scroll-linked orbit. */
  var ORBIT_FRAMES = 36;
  var ORBIT_BASE = "assets/img/360-honda/slide-";
  var ORBIT_EXT  = ".webp";
  function frameSrc(i) { return ORBIT_BASE + i + ORBIT_EXT; }

  var ORBIT_META = {
    title:   "2023 Honda Civic RS · Sport Hatch",
    variant: "1.5T VTEC · TruLens 360° capture",
    vir: 97
  };

  function buildOrbit() {
    if (doc.getElementById("truOrbit")) return;
    // Anchor: insert before the first featured/stock section, else before the trade-in / footer
    var anchor =
      doc.querySelector("#why + section, .featured, .storyband, .buybox, footer, .fs-outro") ||
      doc.querySelector("main > section:nth-of-type(3)");
    if (!anchor) return;

    var s = doc.createElement("section");
    s.className = "tru-orbit";
    s.id = "truOrbit";
    s.innerHTML =
      '<div class="tru-orbit__sticky">' +
        '<div class="tru-orbit__stage">' +
          '<div class="tru-orbit__quote">' +
            '<span class="fs-eyebrow" style="margin-bottom:28px"><span class="fs-pulse"></span>TruOrbit · Live capture</span>' +
            '<br>Every mark.<br><em>Every panel.</em><br>Tagged.' +
            '<small>Scroll to orbit — 36 real frames from the yard floor</small>' +
          '</div>' +
          '<div class="tru-orbit__ring" id="truOrbitRing"></div>' +
          '<div class="tru-orbit__car" id="truOrbitCar">' +
            '<div class="tru-orbit__photo" id="truOrbitPhoto">' +
              // 36 stacked frames, all eager — scroll-driven swap needs them ready
              (function () {
                var out = "";
                for (var i = 1; i <= ORBIT_FRAMES; i++) {
                  out += '<img class="tru-orbit__frame-img" data-i="' + i + '" ' +
                         'src="' + frameSrc(i) + '" alt="" decoding="async" />';
                }
                return out;
              })() +
              '<div class="tru-orbit__sweep" aria-hidden="true"></div>' +
            '</div>' +
            '<div class="tru-orbit__spot"></div>' +
            '<div class="tru-orbit__hud">' +
              '<div class="tru-orbit__hud-title">' + ORBIT_META.title + '</div>' +
              '<div class="tru-orbit__hud-sub">' + ORBIT_META.variant + ' · <b>TruVIR ' + ORBIT_META.vir + '</b></div>' +
            '</div>' +
          '</div>' +
          '<div class="tru-orbit__tags">' +
            '<div class="tru-orbit__tag tru-orbit__tag--1" data-at=".14">Front bumper · A-grade</div>' +
            '<div class="tru-orbit__tag tru-orbit__tag--2" data-at=".38">RH panel · minor mark</div>' +
            '<div class="tru-orbit__tag tru-orbit__tag--3" data-at=".62">Alloy rear · kerb rash</div>' +
            '<div class="tru-orbit__tag tru-orbit__tag--4" data-at=".84">Boot floor · clean</div>' +
          '</div>' +
          '<div class="tru-orbit__frame">Frame <b id="truOrbitFrame">01</b> / 36 · <b>TruLens</b> capture</div>' +
        '</div>' +
      '</div>';
    anchor.parentNode.insertBefore(s, anchor);

    // Scroll-linked frame swap (real 360°)
    var imgs  = Array.from(s.querySelectorAll(".tru-orbit__frame-img"));
    var frame = s.querySelector("#truOrbitFrame");
    var tags  = Array.from(s.querySelectorAll(".tru-orbit__tag"));
    var currentIdx = -1;
    imgs[0].classList.add("is-live");

    function tick() {
      var rect = s.getBoundingClientRect();
      var winH = window.innerHeight;
      var total = rect.height - winH;
      var prog = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      var idx = Math.max(0, Math.min(ORBIT_FRAMES - 1, Math.round(prog * (ORBIT_FRAMES - 1))));
      if (idx !== currentIdx) {
        if (currentIdx >= 0) imgs[currentIdx].classList.remove("is-live");
        imgs[idx].classList.add("is-live");
        currentIdx = idx;
        frame.textContent = (idx + 1 < 10 ? "0" : "") + (idx + 1);
      }
      tags.forEach(function (t) {
        var at = parseFloat(t.dataset.at) || .5;
        t.classList.toggle("is-live", prog >= at);
      });
    }
    document.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    tick();
  }

  /* --- 5 · Editorial outro / footer moment ------------------- */
  function buildOutro() {
    if (doc.querySelector(".fs-outro")) return;
    var footer = doc.querySelector("footer");
    var outro = doc.createElement("section");
    outro.className = "fs-outro";
    outro.innerHTML =
      '<div class="wrap">' +
        '<div class="fs-outro__eyebrow">— True-Cars · Cape Town —</div>' +
        '<h2 class="fs-outro__line">Buy from someone <span>who wants you back.</span></h2>' +
        '<div class="fs-outro__meta">' +
          '<b>Cape Town yard</b> · Mon–Fri 08:00–17:00 · Sat 08:00–13:00' +
          '<br>Nationwide delivery · TruLens verified · Powered by <b>TruSaaS</b>' +
        '</div>' +
      '</div>';
    if (footer) footer.parentNode.insertBefore(outro, footer);
    else doc.body.appendChild(outro);
  }

  /* --- 6 · Mobile TruAfford scroll-gate ---------------------- */
  function gateTruAfford() {
    var hero = doc.querySelector(".hero, header.hero");
    if (!hero || !("IntersectionObserver" in window)) {
      doc.body.classList.add("fs-below-hero");
      return;
    }
    new IntersectionObserver(function (entries) {
      doc.body.classList.toggle("fs-below-hero", !entries[0].isIntersecting);
    }, { threshold: 0.02 }).observe(hero);
  }

  /* --- 6.5 · Image fallback shim -----------------------------
     Cross-origin CDN images (autotrader.co.za) can fail without
     firing onerror on all browsers, which leaves .vcard-media
     with a blank block. Actively verify and swap. */

  /* STRICT model→local-render map. Only exact model matches are
     allowed. Showing a different vehicle under a listing is worse
     than showing no photo at all in a sales demo, so there is
     deliberately NO catch-all fallback here. */
  var LOCAL_CAR_MAP = null;
  function localCarFor(v) {
    if (!LOCAL_CAR_MAP) {
      LOCAL_CAR_MAP = [
        ["911 carrera",      "assets/img/cars/911-carrera-21-side.png"],
        ["m4 competition",   "assets/img/cars/m4-comp-22-side.png"],
        ["range rover sport","assets/img/cars/rangerover-sport-22-side.png"],
        ["corolla cross",    "assets/img/cars/corolla-cross-23-side.png"],
        ["ranger wildtrak",  "assets/img/cars/ranger-wildtrak-22-side.png"],
        ["hilux legend",     "assets/img/cars/hilux-legend-23-side.png"],
        ["polo vivo",        "assets/img/cars/polo-vivo-22-side.png"],
        ["golf gti",         "assets/img/cars/golf-gti-22-side.png"],
        ["golf r",           "assets/img/cars/golf-r-23-side.png"],
        ["atto 3",           "assets/img/cars/byd-atto3-23-side.png"],
        ["dolphin",          "assets/img/cars/byd-dolphin-24-side.png"],
        ["seal",             "assets/img/cars/byd-seal-24-side.png"],
        ["fortuner",         "assets/img/cars/fortuner-23-side.png"],
        ["hilux",            "assets/img/cars/hilux-2831-22-side.png"],
        ["g 63",             "assets/img/cars/gwagen-22-side.png"],
        ["g63",              "assets/img/cars/gwagen-22-side.png"],
        ["g-wagen",          "assets/img/cars/gwagen-22-side.png"],
        ["polo",             "assets/img/cars/polo-tsi-23-side.png"]
      ];
    }
    var t = (v || "").toLowerCase();
    for (var i = 0; i < LOCAL_CAR_MAP.length; i++) {
      if (t.indexOf(LOCAL_CAR_MAP[i][0]) !== -1) return LOCAL_CAR_MAP[i][1];
    }
    return null;   // no confident match → branded placeholder
  }

  /** Branded "photo unavailable" state. Reads as a deliberate system
      state rather than a broken page, and never misrepresents stock. */
  function brandPlaceholder(media, altText) {
    if (!media || media.querySelector(".fs-nophoto")) return;
    var make = String(altText || "").replace(/^\d{4}\s+/, "").split(/\s+/)[0] || "Vehicle";
    var box = doc.createElement("div");
    box.className = "fs-nophoto";
    box.innerHTML =
      '<svg viewBox="0 0 196 78" fill="none" aria-hidden="true">' +
        '<path d="M18 62 L18 50 Q18 44 26 42 L44 36 Q52 30 66 30 L104 30 Q120 30 130 42 ' +
                 'L150 44 Q168 46 172 54 L172 62" stroke="currentColor" stroke-width="2.4" ' +
                 'stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="58" cy="62" r="11" stroke="currentColor" stroke-width="2.4"/>' +
        '<circle cx="140" cy="62" r="11" stroke="currentColor" stroke-width="2.4"/>' +
      '</svg>' +
      '<span class="fs-nophoto__make">' + make + '</span>' +
      '<span class="fs-nophoto__note">Photography in progress · TruLens</span>';
    media.appendChild(box);
  }

  /**
   * Only reacts to a GENUINE load failure (error event, or an image
   * that finished loading with zero intrinsic size). Never fires on a
   * timeout — a slow CDN response is not a failure, and swapping a
   * still-loading photo would misrepresent the listing.
   */
  function repairBrokenImages() {
    doc.querySelectorAll(".vcard-media img, .budget-car img, img[src*='autotrader.co.za']").forEach(function (img) {
      if (img.dataset.fsRepairBound === "1") return;
      img.dataset.fsRepairBound = "1";

      var repair = function () {
        if (img.dataset.fsRepaired === "1") return;
        img.dataset.fsRepaired = "1";

        var media = img.closest(".vcard-media") || img.parentElement;
        var match = localCarFor(img.alt || "");

        if (match && img.src.indexOf(match) === -1) {
          // Confident same-model local render
          img.src = match;
          img.style.display = "block";
          img.style.opacity = "1";
          img.style.objectFit = "contain";
          img.style.padding = "8%";
          // If the local render ALSO fails, fall through to placeholder
          img.addEventListener("error", function () {
            img.style.display = "none";
            brandPlaceholder(media, img.alt);
          }, { once: true });
        } else {
          // No confident match — branded placeholder, never a wrong car
          img.style.display = "none";
          var fb = media && media.querySelector(".vcard-fallback");
          if (fb) fb.style.display = "none";   // hide the site's bare silhouette
          brandPlaceholder(media, img.alt);
        }
      };

      // Genuine failure signals only
      img.addEventListener("error", repair, { once: true });
      if (img.complete && img.naturalWidth === 0) repair();
    });
  }

  /* --- 6.8 · AUTO-CONTRAST SAFETY NET -------------------------
     The dark theme flip can leave text stranded on a surface of the
     same tone (light-on-white, ink-on-ink). Rather than chase every
     component in CSS, measure the real rendered contrast and repair
     only what actually fails. Self-correcting for future content. */

  var LIGHT_INK = "#F2F6FB";
  var LIGHT_INK_MUTED = "rgba(232,238,246,.76)";
  var DARK_INK = "#16212E";
  var DARK_INK_MUTED = "#4A5A6E";

  function rgbParse(c) {
    var m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function relLum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    var l1 = relLum(a), l2 = relLum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  /** Average the colour stops of a gradient string. */
  function gradientAvg(bgImage) {
    var stops = String(bgImage).match(/rgba?\([^)]+\)/g);
    if (!stops || !stops.length) return null;
    var acc = { r: 0, g: 0, b: 0, n: 0 };
    stops.forEach(function (s) {
      var c = rgbParse(s);
      if (!c || c.a < 0.25) return;   // near-transparent stops don't define the surface
      acc.r += c.r; acc.g += c.g; acc.b += c.b; acc.n++;
    });
    if (!acc.n) return null;
    return { r: acc.r / acc.n, g: acc.g / acc.n, b: acc.b / acc.n, a: 1 };
  }
  /** First surface that actually paints behind this element.
      NOTE on paint order: background-image is composited ON TOP of
      background-color, so when both exist the gradient is what the
      eye actually sees and must win. */
  function surfaceBehind(el) {
    var n = el;
    while (n && n !== doc.documentElement) {
      var cs = getComputedStyle(n);
      var bg = rgbParse(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        var g = gradientAvg(cs.backgroundImage);
        if (g) return g;                    // gradient sits above the colour
      }
      if (bg && bg.a >= 0.85) return bg;
      n = n.parentElement;
    }
    return { r: 6, g: 16, b: 27, a: 1 };   // page ink
  }

  /**
   * Layer a translucent black (or white) scrim over an element's own
   * background so its existing text colour clears `need`. Compositing
   * over opaque bg: result = bg*(1-a) for black, bg+(255-bg)*a for white.
   * Returns the applied alpha, or null if even a full scrim can't help.
   */
  function shadeSurfaceToPass(el, fg, bg, need) {
    var fgLight = relLum(fg) > 0.5;
    // Light text wants a darker surface; dark text wants a lighter one.
    var toBlack = fgLight;
    for (var a = 0.15; a <= 0.86; a += 0.07) {
      var c = toBlack
        ? { r: bg.r * (1 - a),            g: bg.g * (1 - a),            b: bg.b * (1 - a) }
        : { r: bg.r + (255 - bg.r) * a,   g: bg.g + (255 - bg.g) * a,   b: bg.b + (255 - bg.b) * a };
      if (contrast(fg, c) >= need) {
        var rgba = toBlack ? "rgba(0,0,0," + a.toFixed(2) + ")"
                           : "rgba(255,255,255," + a.toFixed(2) + ")";
        var cs = getComputedStyle(el);
        var existing = (cs.backgroundImage && cs.backgroundImage !== "none")
          ? cs.backgroundImage : null;
        var layers = "linear-gradient(" + rgba + "," + rgba + ")";
        if (existing) layers += "," + existing;
        el.style.setProperty("background-image", layers, "important");
        if (!existing) {
          // no gradient to sit on — make sure the base colour is present
          el.style.setProperty("background-color", cs.backgroundColor, "important");
        }
        return a;
      }
    }
    return null;
  }

  function autoContrast() {
    var nodes = doc.querySelectorAll("body *:not(script):not(style):not(svg):not(path):not(circle)");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.fsContrast === "1") continue;

      // Only elements rendering their own short-ish text
      var own = "", kids = el.childNodes;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].nodeType === 3 && kids[k].nodeValue.trim()) own += kids[k].nodeValue.trim() + " ";
      }
      if (!own || own.length > 240) continue;

      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.1) continue;
      // Skip gradient-clipped text (the .ta-big / hero treatments)
      if (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" ||
          cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text") {
        el.dataset.fsContrast = "1"; continue;
      }
      var rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;

      var fg = rgbParse(cs.color);
      if (!fg || fg.a < 0.2) continue;

      var bg = surfaceBehind(el);
      var cr = contrast(fg, bg);
      var size = parseFloat(cs.fontSize);
      var large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 600);
      var need = large ? 3 : 4.5;

      el.dataset.fsContrast = "1";
      if (cr >= need) continue;

      // Repair: pick the ink that suits the measured surface
      var bgIsLight = relLum(bg) > 0.42;
      var muted = size <= 13 && +cs.fontWeight < 600;
      var fix = bgIsLight
        ? (muted ? DARK_INK_MUTED : DARK_INK)
        : (muted ? LIGHT_INK_MUTED : LIGHT_INK);

      // Verify the replacement genuinely passes before applying
      var fixC = rgbParse(fix.indexOf("rgba") === 0 ? fix : null) ||
                 rgbParse(bgIsLight ? "rgb(22,33,46)" : "rgb(242,246,251)");
      if (contrast(fixC, bg) >= need) {
        el.style.setProperty("color", fix, "important");
        el.setAttribute("data-fs-fixed", cr.toFixed(2));
        continue;
      }
      // Pure black/white as a second attempt
      var extreme = bgIsLight ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
      if (contrast(extreme, bg) >= need) {
        el.style.setProperty("color", bgIsLight ? "#000" : "#fff", "important");
        el.setAttribute("data-fs-fixed", "max");
        continue;
      }
      /* Mid-tone surface (saturated brand chip): no text colour can
         pass, so shade the element's OWN surface instead. A black or
         white scrim layered over the existing background preserves
         the gradient while moving luminance far enough to clear the
         ratio. Keeps the brand hue, fixes the legibility. */
      var scrim = shadeSurfaceToPass(el, fg, bg, need);
      if (scrim) el.setAttribute("data-fs-fixed", "surface");
    }
  }

  /* --- 7 · Live pulse chip in nav (subtle "showroom is live") - */
  function addLiveChip() {
    if (doc.querySelector(".fs-live[data-nav]")) return;
    var host = doc.querySelector(".nav .wrap") || doc.querySelector("nav");
    if (!host) return;
    var chip = doc.createElement("span");
    chip.className = "fs-live";
    chip.setAttribute("data-nav", "1");
    chip.innerHTML = '<i></i>Live · Cape Town';
    chip.style.marginLeft = "18px";
    var cta = host.querySelector(".nav-cta");
    if (cta) host.insertBefore(chip, cta);
    else host.appendChild(chip);
  }

  /* --- Boot ---------------------------------------------------- */
  function boot() {
    relabelTru3D();
    injectEyebrows();
    mountCursor();
    buildOrbit();
    buildOutro();
    gateTruAfford();
    addLiveChip();
    repairBrokenImages();
    autoContrast();
    // Re-run injectors on late DOM additions (cards load async via stock-bridge)
    var re = 0;
    var ticker = setInterval(function () {
      injectEyebrows();
      relabelTru3D();
      repairBrokenImages();
      autoContrast();
      if (++re > 8) clearInterval(ticker);
    }, 600);
    // Also on stock update (bridge re-render)
    window.addEventListener("tcsa:stock", function () {
      setTimeout(function () { repairBrokenImages(); autoContrast(); }, 100);
    });
    // Late-opening UI (modals, wizard steps, tabs) gets a pass too
    doc.addEventListener("click", function () {
      setTimeout(autoContrast, 260);
    }, true);

    /* Dashboards (portal.html) and filtered lists re-render their DOM
       long after boot. Watch for inserted subtrees and re-measure the
       new nodes only — debounced so a big render costs one pass. */
    if ("MutationObserver" in window) {
      var pending = null;
      var mo = new MutationObserver(function (records) {
        var sawNodes = false;
        for (var i = 0; i < records.length; i++) {
          if (records[i].addedNodes && records[i].addedNodes.length) { sawNodes = true; break; }
        }
        if (!sawNodes) return;
        clearTimeout(pending);
        pending = setTimeout(function () {
          autoContrast();
          repairBrokenImages();
        }, 180);
      });
      mo.observe(doc.body, { childList: true, subtree: true });
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
