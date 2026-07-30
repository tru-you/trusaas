/* TruDealer demo harness — injected, not part of the original site build.
 *
 * Loaded before every site script so the page below it runs completely
 * unmodified. It only changes what the page TALKS to:
 *   - public stock API  -> ./stock.json (mock inventory)
 *   - any other TruSaas host -> inert stub (no lead can reach a real DMS)
 *   - wa.me / tel: / mailto: -> blocked (no message reaches a real dealer)
 */
(function () {
  var CFG = {"stockUrl": "stock.json", "accent": "#4D9BFF", "blurb": "Halstead Motor Co. is a fictional United Kingdom floor, built on the same stack to show it in \u00a3.", "links": "<a href=\"/trudealer/#work\">Other demos \u2197</a>"};
  // Resolve stock.json against THIS script's own URL, not the document's.
  // Pages nested in subfolders (truchat/, etc.) would otherwise look for
  // stock.json beside themselves and fall back to an empty catalogue.
  var self = document.currentScript && document.currentScript.src;
  CFG.stockUrl = self ? self.replace(/[^/]*$/, "") + "stock.json" : "stock.json";
  // stock-data.js sets this. Preferring it over fetch() is what makes the demos
  // work when opened straight off disk: file:// blocks fetch of a sibling JSON,
  // which left every site WITHOUT its own hardcoded fallback showing an empty
  // yard (Caledon, True-Cars, Halstead) while MKR/Ridgeline looked fine.
  var EMBEDDED = window.__TD_STOCK__ || null;

  var STOCK_RE = /\/api\/public\/stock/i;
  var TRU_RE = /(tru-saas\.com|trusaas|onrender\.com)/i;

  /* ---- 1. stock feed ------------------------------------------------- */
  var stockPromise = null;
  function stock() {
    if (EMBEDDED) return Promise.resolve(EMBEDDED);
    if (!stockPromise) {
      stockPromise = fetch(CFG.stockUrl, { cache: "force-cache" })
        .then(function (r) { return r.json(); })
        .catch(function () { return { vehicles: [] }; });
    }
    return stockPromise;
  }
  function jsonResponse(obj) {
    return new Response(JSON.stringify(obj), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (STOCK_RE.test(url)) {
      return stock().then(jsonResponse);
    }
    if (TRU_RE.test(url)) {
      // A lead post, analytics ping, or chat call. Swallow it.
      return Promise.resolve(jsonResponse({ ok: true, demo: true }));
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"));
  };

  /* XHR too — older code paths on these sites still use it. */
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === "string" && (STOCK_RE.test(url) || TRU_RE.test(url))) {
      arguments[1] = STOCK_RE.test(url) ? CFG.stockUrl : "data:application/json,%7B%22ok%22%3Atrue%7D";
    }
    return open.apply(this, arguments);
  };

  /* ---- 2. never contact the real dealer ------------------------------ */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^(tel:|mailto:)/i.test(href) || /wa\.me|api\.whatsapp\.com/i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      toast("Demo site — contact links are disabled so nothing reaches the real dealership.");
    }
  }, true);

  var tid = null;
  function toast(msg) {
    var t = document.getElementById("tdDemoToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "tdDemoToast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "on";
    clearTimeout(tid);
    tid = setTimeout(function () { t.className = ""; }, 4200);
  }

  /* ---- 3. ribbon + styles -------------------------------------------- */
  function chrome() {
    if (document.getElementById("tdDemoBar")) return;

    var css = document.createElement("style");
    css.textContent =
      "#tdDemoBar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;gap:10px 16px;" +
      "align-items:center;justify-content:center;flex-wrap:wrap;padding:9px 16px;" +
      "background:rgba(8,10,14,.93);backdrop-filter:blur(12px);border-top:1px solid rgba(255,255,255,.14);" +
      "font:500 12.5px/1.35 Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:rgba(255,255,255,.66);" +
      "text-align:center;-webkit-font-smoothing:antialiased}" +
      "#tdDemoBar b{color:#fff;font-weight:600}" +
      "#tdDemoBar .dot{width:6px;height:6px;border-radius:50%;background:" + CFG.accent + ";flex:none;" +
      "box-shadow:0 0 10px " + CFG.accent + ";animation:tdPulse 2.4s infinite}" +
      "@keyframes tdPulse{0%,100%{opacity:.35}50%{opacity:1}}" +
      "#tdDemoBar a{color:" + CFG.accent + ";text-decoration:none;border-bottom:1px solid transparent;white-space:nowrap}" +
      "#tdDemoBar a:hover{border-color:" + CFG.accent + "}" +
      "#tdDemoToast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,14px);z-index:2147483001;" +
      "max-width:min(92vw,460px);padding:13px 18px;border-radius:12px;background:rgba(16,19,26,.97);" +
      "border:1px solid rgba(255,255,255,.16);color:#fff;box-shadow:0 18px 48px -20px rgba(0,0,0,.9);" +
      "font:500 13px/1.5 Inter,system-ui,sans-serif;text-align:center;opacity:0;pointer-events:none;" +
      "transition:opacity .22s,transform .22s}" +
      "#tdDemoToast.on{opacity:1;transform:translate(-50%,0)}" +
      "@media print{#tdDemoBar,#tdDemoToast{display:none}}";
    document.head.appendChild(css);

    var bar = document.createElement("div");
    bar.id = "tdDemoBar";
    bar.innerHTML =
      '<span class="dot"></span>' +
      '<span><b>TruDealer demo</b> — ' + CFG.blurb + "</span>" +
      CFG.links;
    document.body.appendChild(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", chrome);
  } else {
    chrome();
  }
})();
