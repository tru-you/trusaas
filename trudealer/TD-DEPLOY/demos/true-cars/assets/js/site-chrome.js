/* Shared chrome: TruSaaS popup only — no top banners, no floating WA */
(function () {
  window.TCSA = window.TCSA || {};

  const TRUSAAS_URL = "https://www.tru-saas.com";
  TCSA.TRUSAAS_URL = TRUSAAS_URL;

  function openTruSaaSPopup(e) {
    if (e) e.preventDefault();
    const w = Math.min(1080, Math.floor(screen.availWidth * 0.92));
    const h = Math.min(820, Math.floor(screen.availHeight * 0.88));
    const left = Math.max(0, Math.floor((screen.availWidth - w) / 2));
    const top = Math.max(0, Math.floor((screen.availHeight - h) / 2));
    const features =
      "popup=yes,noopener,noreferrer,width=" +
      w +
      ",height=" +
      h +
      ",left=" +
      left +
      ",top=" +
      top +
      ",scrollbars=yes,resizable=yes";
    const win = window.open(TRUSAAS_URL, "truesaas_platform", features);
    if (!win) {
      window.location.href = TRUSAAS_URL;
    } else {
      try {
        win.focus();
      } catch (_) {}
    }
    return false;
  }

  TCSA.openTruSaaS = openTruSaaSPopup;

  function wireTruSaaSPopupLinks() {
    if (/truesaas\.html$/i.test(location.pathname)) return;
    document.querySelectorAll('a[href="truesaas.html"], a[href="./truesaas.html"], a[href="/truesaas.html"]').forEach(function (a) {
      if (a.dataset.tsPopup === "1") return;
      a.dataset.tsPopup = "1";
      a.setAttribute("title", "Open TruSaaS platform");
      a.addEventListener("click", openTruSaaSPopup);
    });
    document.querySelectorAll(".ax b, .ax a b").forEach(function (b) {
      if ((b.textContent || "").trim().toLowerCase() !== "truesaas") return;
      const a = b.closest("a");
      if (a && a.dataset.tsPopup !== "1") {
        a.dataset.tsPopup = "1";
        a.addEventListener("click", openTruSaaSPopup);
      }
    });
  }

  function stripTopBannersAndWaFloats() {
    ["tcsaEcoStrip", "tcsaLiveStrip", "tcsaTopBar", "tcsaStickyWa"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document
      .querySelectorAll(
        ".tcsa-eco-strip, .tcsa-live-strip, .tcsa-top-banner, .tcsa-sticky-wa, .demo-float, .fab-rail, .fab-btn, a.fab-wa, .fab-btn.fab-wa, .fab-luna"
      )
      .forEach(function (el) {
        el.remove();
      });
  }

  TCSA.injectTrustRow = function (parent) {
    if (!parent || parent.querySelector(".tcsa-trust-row")) return;
    const row = document.createElement("div");
    row.className = "tcsa-trust-row";
    row.innerHTML =
      "<span>Tru3D + VIR</span><span>TruPrice</span><span>TruChat</span><span>Nationwide delivery</span>";
    parent.appendChild(row);
  };

  function injectDemoBar() {
    var path = location.pathname.replace(/\/+$/, "");
    var platform = /\/(truesaas|dealers|technology|portal|demos)(\.html)?$/i.test(path);
    if (platform) return;
    if (document.getElementById("tcsaDemoBar")) return;

    var css = document.createElement("style");
    css.id = "tcsaDemoBarCss";
    css.textContent =
      ":root{--demo-bar-h:40px;}" +
      "#tcsaDemoBar{position:fixed;top:0;left:0;right:0;z-index:250;min-height:var(--demo-bar-h);" +
      "display:flex;align-items:center;justify-content:center;gap:14px;padding:7px 16px;" +
      "background:linear-gradient(90deg,#08162d 0%,#0d2647 55%,#0a1f3a 100%);color:#fff;" +
      "border-bottom:1px solid rgba(79,227,220,.22);line-height:1.35;}" +
      "#tcsaDemoBar .db-live{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;" +
      "font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#7FE9E3;" +
      "border:1px solid rgba(79,227,220,.35);border-radius:100px;padding:3px 10px 3px 7px;background:rgba(79,227,220,.08);}" +
      "#tcsaDemoBar .db-live i{width:6px;height:6px;border-radius:50%;background:#4FE3DC;" +
      "box-shadow:0 0 0 0 rgba(79,227,220,.55);animation:dbPing 1.8s ease-out infinite;}" +
      "@keyframes dbPing{70%{box-shadow:0 0 0 7px rgba(79,227,220,0);}100%{box-shadow:0 0 0 0 rgba(79,227,220,0);}}" +
      "#tcsaDemoBar .db-msg{font-size:12.5px;font-weight:600;color:rgba(255,255,255,.88);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "#tcsaDemoBar .db-msg b{color:#7FE9E3;font-weight:700;}" +
      "#tcsaDemoBar .db-short{display:none;}" +
      "#tcsaDemoBar .db-cta{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;" +
      "background:#fff;color:#08162d;font-weight:800;font-size:11.5px;text-decoration:none;white-space:nowrap;" +
      "transition:transform .2s,box-shadow .25s;}" +
      "#tcsaDemoBar .db-cta:hover{transform:translateY(-1px);box-shadow:0 6px 18px -4px rgba(79,227,220,.45);}" +
      "#tcsaDemoBar .db-cta svg{width:12px;height:12px;}" +
      "@media(max-width:760px){#tcsaDemoBar .db-full{display:none;}#tcsaDemoBar .db-short{display:inline;}#tcsaDemoBar{gap:10px;padding:6px 12px;}}" +
      "@media(max-width:420px){#tcsaDemoBar .db-live{display:none;}}" +
      /* push the fixed nav + page content below the bar */
      ".nav{top:var(--demo-bar-h) !important;}" +
      "body{padding-top:var(--demo-bar-h);}";
    document.head.appendChild(css);

    var bar = document.createElement("div");
    bar.id = "tcsaDemoBar";
    bar.innerHTML =
      '<span class="db-live"><i></i>Live demo</span>' +
      '<span class="db-msg db-full">This whole dealership runs on <b>TruSaaS</b> — yours could look like this.</span>' +
      '<span class="db-msg db-short">Built on <b>TruSaaS</b></span>' +
      '<button type="button" class="db-lens" id="tcsaLensToggle" title="Toggle module hotspots" aria-pressed="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>' +
      '<a class="db-cta" href="' + TRUSAAS_URL + '">Book a walkthrough' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>';
    document.body.prepend(bar);

    var sync = function () {
      var h = bar.offsetHeight;
      if (h) document.documentElement.style.setProperty("--demo-bar-h", h + "px");
    };
    sync();
    window.addEventListener("resize", sync);

    /* rotating module messages */
    var MSGS = [
      { f: 'This whole dealership runs on <b>TruSaaS</b> — yours could look like this.', s: 'Built on <b>TruSaaS</b>' },
      { f: 'Those vehicle photos? Captured on the yard with <b>TruLens</b>.', s: 'Photos by <b>TruLens</b>' },
      { f: 'Every price badge is <b>TruPrice</b> — live market-fair benchmarking.', s: 'Pricing by <b>TruPrice</b>' },
      { f: 'The chat bubble bottom-right is <b>TruChat</b> — it books viewings 24/7.', s: 'Chat by <b>TruChat</b>' },
      { f: 'Every condition ring is a <b>TruVIR</b> score — AI graded, evidence backed.', s: 'Scores by <b>TruVIR</b>' }
    ];
    var mi = 0, paused = false;
    var full = bar.querySelector(".db-full"), brief = bar.querySelector(".db-short");
    full.style.transition = brief.style.transition = "opacity .3s ease";
    bar.addEventListener("mouseenter", function () { paused = true; });
    bar.addEventListener("mouseleave", function () { paused = false; });
    setInterval(function () {
      if (paused || document.hidden) return;
      mi = (mi + 1) % MSGS.length;
      full.style.opacity = brief.style.opacity = "0";
      setTimeout(function () {
        full.innerHTML = MSGS[mi].f;
        brief.innerHTML = MSGS[mi].s;
        full.style.opacity = brief.style.opacity = "1";
      }, 300);
    }, 6500);

    /* lens toggle */
    var toggle = document.getElementById("tcsaLensToggle");
    var lensOff = localStorage.getItem("tcsa_lens") === "off";
    if (lensOff) { document.body.classList.add("tcsa-lens-off"); toggle.setAttribute("aria-pressed", "false"); }
    toggle.addEventListener("click", function () {
      var off = document.body.classList.toggle("tcsa-lens-off");
      localStorage.setItem("tcsa_lens", off ? "off" : "on");
      toggle.setAttribute("aria-pressed", off ? "false" : "true");
    });
  }

  /* ---------- Demo lens: module hotspots + shared tooltip ---------- */
  var LENS_SPOTS = [
    { sel: ".qs-card", name: "TruShowroom", desc: "This whole storefront — search, stock, pages — is a TruSaaS website module fed by live DMS data." },
    { sel: ".truecar-tag", name: "TruPrice", desc: "Market-fair price benchmarking on every unit — the badge buyers learn to trust." },
    { sel: ".vcard-media .vir-ring", name: "TruVIR", desc: "AI condition score from TruLens capture — graded, scored, evidence-backed." },
    { sel: "#homeWeb3d", name: "Tru3D", desc: "360° orbit and damage pins built from ordinary yard photos." },
    { sel: "#tc-fab", name: "TruChat", desc: "AI chat that matches stock, answers finance basics and books viewings 24/7." },
    { sel: "#tru-afford-root .ta-launcher", name: "TruAfford", desc: "Soft affordability pre-qual in 60 seconds — no bureau pull." }
  ];

  function lensTip() {
    var tip = document.getElementById("tcsaLensTip");
    if (tip) return tip;
    tip = document.createElement("div");
    tip.id = "tcsaLensTip";
    tip.innerHTML = '<b></b><p></p><a href="' + TRUSAAS_URL + '">Explore the module<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" style="width:11px;height:11px"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>';
    document.body.appendChild(tip);
    return tip;
  }

  function showTip(dot) {
    var tip = lensTip();
    tip.querySelector("b").textContent = dot.dataset.lname;
    tip.querySelector("p").textContent = dot.dataset.ldesc;
    tip.classList.add("on");
    var r = dot.getBoundingClientRect();
    var tw = 250;
    var th = tip.offsetHeight || 110;
    var vw = window.innerWidth, vh = window.innerHeight;
    /* markers on the bottom-right widget stack (chat fab, TruAfford):
       open the tip to the LEFT of the widgets so it never covers them */
    var host = dot.parentElement;
    var hr = host ? host.getBoundingClientRect() : r;
    if (r.top > vh * 0.55 && r.left > vw * 0.55) {
      if (hr.left < tw + 24) {
        /* narrow screen: no room to the left — open above the widget instead */
        tip.style.left = Math.max(8, Math.min(hr.right - tw, vw - tw - 8)) + "px";
        tip.style.top = Math.max(8, hr.top - th - 12) + "px";
        return;
      }
      var x = Math.max(8, hr.left - tw - 16);
      var y = Math.min(Math.max(8, r.top + r.height / 2 - th / 2), vh - th - 8);
      tip.style.left = x + "px";
      tip.style.top = y + "px";
      return;
    }
    var cx = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), vw - tw - 8);
    tip.style.left = cx + "px";
    var above = r.top - th - 12;
    tip.style.top = (above > 8 ? above : r.bottom + 12) + "px";
  }
  function hideTip() {
    var tip = document.getElementById("tcsaLensTip");
    if (tip) tip.classList.remove("on");
  }

  function scanLens() {
    LENS_SPOTS.forEach(function (s) {
      var el = document.querySelector(s.sel);
      if (!el || el.dataset.tsLens) return;
      el.dataset.tsLens = "1";
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "tcsa-lens-dot";
      dot.dataset.lname = s.name;
      dot.dataset.ldesc = s.desc;
      dot.setAttribute("aria-label", s.name + " — TruSaaS module");
      dot.textContent = "i";
      dot.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); showTip(dot); });
      dot.addEventListener("mouseenter", function () { showTip(dot); });
      dot.addEventListener("mouseleave", function () { setTimeout(function () { if (!lensTip().matches(":hover")) hideTip(); }, 250); });
      el.appendChild(dot);
    });
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#tcsaLensTip") && !e.target.closest(".tcsa-lens-dot")) hideTip();
  }, true);
  window.addEventListener("scroll", hideTip, { passive: true });

  function lensCss() {
    if (document.getElementById("tcsaLensCss")) return;
    var c = document.createElement("style");
    c.id = "tcsaLensCss";
    c.textContent =
      ".tcsa-lens-dot{position:absolute;top:-7px;right:-7px;z-index:6;width:19px;height:19px;border-radius:50%;border:none;cursor:pointer;" +
      "background:linear-gradient(135deg,#0EA8A2,#15C7C0);color:#04222a;font:800 11px/19px 'IBM Plex Mono',monospace;text-align:center;padding:0;" +
      "box-shadow:0 2px 8px rgba(8,22,45,.4),0 0 0 2px rgba(255,255,255,.85);}" +
      ".tcsa-lens-dot::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:1.5px solid rgba(21,199,192,.55);animation:lensPing 2.4s ease-out infinite;}" +
      "@keyframes lensPing{0%{transform:scale(1);opacity:.7}75%,100%{transform:scale(1.7);opacity:0}}" +
      "#tc-fab .tcsa-lens-dot,#tru-afford-root .tcsa-lens-dot{top:-5px;left:-5px;right:auto;}" +
      "body.tcsa-lens-off .tcsa-lens-dot{display:none;}" +
      "#tcsaLensTip{position:fixed;z-index:100000;width:250px;padding:13px 14px 12px;border-radius:14px;" +
      "background:rgba(8,16,28,.95);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(79,227,220,.3);" +
      "color:#fff;box-shadow:0 18px 44px -12px rgba(0,0,0,.6);opacity:0;pointer-events:none;transform:translateY(6px);transition:opacity .25s,transform .3s;}" +
      "#tcsaLensTip.on{opacity:1;pointer-events:auto;transform:none;}" +
      "#tcsaLensTip b{display:block;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#7FE9E3;margin-bottom:6px;}" +
      "#tcsaLensTip p{font-size:12px;line-height:1.55;color:rgba(255,255,255,.82);margin:0 0 10px;}" +
      "#tcsaLensTip a{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:#4FE3DC;text-decoration:none;}" +
      "#tcsaDemoBar .db-lens{flex-shrink:0;width:26px;height:26px;border-radius:50%;border:1px solid rgba(79,227,220,.4);cursor:pointer;" +
      "background:rgba(79,227,220,.1);color:#7FE9E3;display:grid;place-items:center;padding:0;transition:background .2s;}" +
      "#tcsaDemoBar .db-lens svg{width:14px;height:14px;}" +
      "#tcsaDemoBar .db-lens:hover{background:rgba(79,227,220,.22);}" +
      "body.tcsa-lens-off #tcsaDemoBar .db-lens{opacity:.45;}" +
      "@media(prefers-reduced-motion:reduce){.tcsa-lens-dot::after{animation:none;}}";
    document.head.appendChild(c);
  }

  /* ---------- Mobile sticky action bar ---------- */
  function injectMobileBar() {
    if (document.getElementById("tcsaMab")) return;
    var c = document.createElement("style");
    c.id = "tcsaMabCss";
    c.textContent =
      "#tcsaMab{display:none;}" +
      "@media(max-width:760px){" +
      "#tcsaMab{position:fixed;left:0;right:0;bottom:0;z-index:240;display:grid;grid-template-columns:1.2fr 1fr auto;gap:8px;" +
      "padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));" +
      "background:rgba(8,16,28,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);" +
      "border-top:1px solid rgba(79,227,220,.22);transform:translateY(110%);transition:transform .4s cubic-bezier(.22,1,.36,1);}" +
      "body.tcsa-mab-on #tcsaMab{transform:none;}" +
      "#tcsaMab a{display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 10px;border-radius:12px;" +
      "font-weight:800;font-size:13px;text-decoration:none;white-space:nowrap;}" +
      "#tcsaMab .mab-buy{background:linear-gradient(120deg,#1466E0,#0EA8A2);color:#fff;}" +
      "#tcsaMab .mab-sell{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.18);}" +
      "#tcsaMab .mab-wa{background:#25D366;color:#fff;width:46px;padding:12px 0;}" +
      "#tcsaMab .mab-wa svg{width:20px;height:20px;}" +
      "body.tcsa-mab-on #tc-fab{bottom:92px !important;}" +
      "body.tcsa-mab-on #tru-afford-root{bottom:204px !important;}" +
      "body.tcsa-mab-on .back-to-top{bottom:172px !important;}" +
      "}";
    document.head.appendChild(c);

    var mab = document.createElement("div");
    mab.id = "tcsaMab";
    mab.innerHTML =
      '<a class="mab-buy" href="certi-used.html">Browse stock</a>' +
      '<a class="mab-sell" href="trade-in.html">Sell my car</a>' +
      '<a class="mab-wa" href="https://wa.me/27620502091" target="_blank" rel="noopener" aria-label="WhatsApp">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-1.5-.8-2.6-1.4-3.6-3.1-.3-.5.3-.5.7-1.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3 1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.2-1.3-.1-.2-.3-.2-.6-.3z"/></svg></a>';
    document.body.appendChild(mab);

    var onScroll = function () {
      document.body.classList.toggle("tcsa-mab-on", window.scrollY > window.innerHeight * 0.6);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- TruVIR ring draw-on-scroll ---------- */
  function watchVirRings() {
    var rings = document.querySelectorAll(".vir-ring:not([data-vio])");
    if (!rings.length) return;
    if (!("IntersectionObserver" in window)) {
      rings.forEach(function (r) { r.dataset.vio = "1"; r.classList.add("go"); });
      return;
    }
    if (!TCSA.__virIO) {
      TCSA.__virIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("go"); TCSA.__virIO.unobserve(e.target); }
        });
      }, { threshold: 0.35 });
    }
    rings.forEach(function (r) { r.dataset.vio = "1"; TCSA.__virIO.observe(r); });
  }

  var IS_PLATFORM = /\/(truesaas|dealers|technology|portal|demos)(\.html)?$/i.test(location.pathname.replace(/\/+$/, ""));

  function boot() {
    stripTopBannersAndWaFloats();
    wireTruSaaSPopupLinks();
    injectDemoBar();
    if (!IS_PLATFORM) {
      lensCss();
      injectMobileBar();
    }
    [0, 400, 1200, 2600, 4500].forEach(function (t) {
      setTimeout(function () {
        stripTopBannersAndWaFloats();
        watchVirRings();
        if (!IS_PLATFORM) scanLens();
      }, t);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
