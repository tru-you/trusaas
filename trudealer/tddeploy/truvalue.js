/**
 * TruValue — instant trade-in / market-value widget (TruSaaS)
 *
 * CANONICAL SOURCE. Per-dealer copies under case-sites/ and truweb/ are deploy
 * artefacts — fix bugs here, then re-copy. Standalone script AND WordPress (the
 * WP rig loads this same file — one core, two wrappers, no fork).
 *
 * Drop-in:
 *   <script src="tru-value.js"
 *           data-dealer="Cars on Caledon"
 *           data-wa="27618759389"
 *           data-slug="cars-on-caledon"
 *           data-flow="https://premium.tru-saas.com"
 *           data-accent="#e30613"></script>
 *
 *   data-flow   TruFlow base URL — powers the live estimate + lead capture.
 *   data-slug   dealer slug for the lead funnel (webhook-lead).
 *   data-wa     dealer WhatsApp number (handoff to book the assessment).
 *   data-accent brand colour; every shade derives from it. Default cyan.
 *
 * The number shown is an INDICATIVE market estimate, always captioned
 * "subject to full assessment" — the firm offer follows the dealer's physical
 * check. Lead is captured BEFORE the WhatsApp handoff, never gated behind it.
 */
(function () {
  "use strict";
  if (window.__TruValueLoaded) return;
  window.__TruValueLoaded = true;

  var scr = document.currentScript || document.querySelector("script[src*='tru-value']");
  function attr(name, fallback) {
    return (scr && scr.getAttribute(name)) || fallback;
  }

  function cmbNotify(cfg, source, text) {
    if (!cfg || !cfg.cmbKey || !cfg.cmbPhone) return;
    try {
      new Image().src =
        "https://api.callmebot.com/whatsapp.php?phone=" + cfg.cmbPhone +
        "&apikey=" + encodeURIComponent(cfg.cmbKey) +
        "&text=" + encodeURIComponent("New " + source + " lead — " + (cfg.dealer || "") + "\n" + (text || ""));
    } catch (e) {}
  }

  var cfg = {
    dealer: attr("data-dealer", "this dealership"),
    wa: attr("data-wa", ""),
    position: attr("data-position", "right"),
    offsetBottom: attr("data-bottom", "88px"),
    z: attr("data-z", "2147400000"),
    text: attr("data-text", ""),
    scale: attr("data-scale", ""),
    accent: attr("data-accent", "#4FE3DC"),
    accent2: attr("data-accent-2", ""),
    accent3: attr("data-accent-3", ""),
    flowUrl: (attr("data-flow", "https://premium.tru-saas.com") || "").replace(/\/$/, ""),
    webhook: attr("data-webhook", ""),
    cmbKey: attr("data-callmebot-key", ""),
    cmbPhone: ((attr("data-callmebot-phone", "") || attr("data-wa", "")) || "").replace(/\D/g, ""),
    slug: attr("data-slug", ""),
    mount: attr("data-mount", ""),   // CSS selector → render inline in-page instead of a floating launcher
    theme: attr("data-theme", ""),   // "light" → light surface to match a light host page
    font: attr("data-font", ""),     // override font-family to match the host page
    margin: attr("data-margin", "15") // dealer trade margin % — retail less this = shown trade estimate
  };

  var ID = "tru-value";

  /* ---------- colour helpers (one hex in, whole palette out) ---------- */
  function parseHex(h) {
    var s = String(h || "").trim().replace(/^#/, "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function toHex(rgb) {
    return "#" + rgb.map(function (v) {
      var c = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return c.length === 1 ? "0" + c : c;
    }).join("");
  }
  function mix(rgb, target, amount) { return rgb.map(function (v, i) { return v + (target[i] - v) * amount; }); }
  var WHITE = [255, 255, 255], BLACK = [0, 0, 0];
  function lighten(rgb, a) { return mix(rgb, WHITE, a); }
  function darken(rgb, a) { return mix(rgb, BLACK, a); }
  function chan(rgb) { return rgb.map(Math.round).join(" "); }

  var accent = parseHex(cfg.accent) || parseHex("#4FE3DC");
  var accentBright = lighten(accent, 0.34);
  var accentDeep = darken(accent, 0.34);
  var accent2 = parseHex(cfg.accent2) || accentDeep;
  var accent3 = parseHex(cfg.accent3) || accent;
  var accent3Bright = lighten(accent3, 0.42);

  var VARS = [
    "--tv-signal:", toHex(accent), ";",
    "--tv-signal-bright:", toHex(accentBright), ";",
    "--tv-signal-deep:", toHex(accentDeep), ";",
    "--tv-signal-rgb:", chan(accent), ";",
    "--tv-signal-bright-rgb:", chan(accentBright), ";",
    "--tv-blue:", toHex(accent2), ";",
    "--tv-blue-rgb:", chan(accent2), ";",
    "--tv-trust:", toHex(accent3), ";",
    "--tv-trust-bright:", toHex(accent3Bright), ";",
    "--tv-trust-rgb:", chan(accent3), ";",
    "--tv-grad:linear-gradient(115deg,", toHex(accentBright), " 0%,", toHex(accent), " 48%,", toHex(accent2), " 100%);",
    "--tv-ink:#06070c;--tv-ok:#22C55E;--tv-warn:#F59E0B;--tv-warn-text:#fcd34d;",
    "--tv-wa:#25D366;--tv-wa-deep:#059669;",
    "--tv-glass:rgba(10,11,18,.82);--tv-border:rgba(255,255,255,.12);",
    "--tv-text:#F4F4F1;--tv-muted:#94A3B8;--tv-faint:rgba(148,163,184,.75);",
    "--tv-surface:#11121a;",
    "--tv-ease:cubic-bezier(.22,1,.36,1);--tv-spring:cubic-bezier(.34,1.4,.64,1);"
  ].join("");

  var thisYear = (new Date()).getFullYear();
  var state = {
    open: false, step: 1,
    make: "", model: "", year: thisYear - 5, mileage: "",
    reg: "", vin: "", condition: 3, damage: "",
    name: "", phone: "", result: null, loading: false
  };

  function money(n) { return "R " + Math.round(n || 0).toLocaleString("en-ZA"); }

  var CSS = [
    ":host{all:initial;", VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    "position:fixed;z-index:" + cfg.z + ";bottom:" + cfg.offsetBottom + ";",
    cfg.position === "left" ? "left:16px;right:auto;" : "right:16px;left:auto;",
    "display:block;max-width:min(400px,calc(100vw - 24px));pointer-events:none}",
    "#" + ID + "-root{", VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    "display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}",
    "#" + ID + "-root *,#" + ID + "-root *::before,#" + ID + "-root *::after{box-sizing:border-box}",
    "#" + ID + "-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}",
    "#" + ID + "-root .tv-launcher{",
    "pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;",
    "border-radius:100px;background:linear-gradient(145deg,rgba(17,18,26,.92),rgba(10,11,18,.96));",
    "border:1px solid rgb(var(--tv-signal-rgb)/.28);color:#fff;",
    "box-shadow:0 12px 36px -10px rgba(0,0,0,.55),0 0 24px -8px rgb(var(--tv-signal-rgb)/.35),inset 0 1px 0 rgba(255,255,255,.1);",
    "backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);",
    "transition:transform .35s var(--tv-spring),box-shadow .35s var(--tv-ease);width:250px;min-height:80px;text-align:left}",
    "#" + ID + "-root .tv-launcher:hover{transform:translateY(-3px) scale(1.02)}",
    "#" + ID + "-root .tv-launcher:active{transform:scale(.97)}",
    "#" + ID + "-root .tv-ico{width:40px;height:40px;border-radius:50%;flex-shrink:0;background:var(--tv-grad);",
    "display:grid;place-items:center;box-shadow:0 6px 18px -4px rgb(var(--tv-signal-rgb)/.55);position:relative}",
    "#" + ID + "-root .tv-ico::after{content:'';position:absolute;inset:-4px;border-radius:50%;",
    "border:2px solid rgb(var(--tv-signal-rgb)/.45);animation:tvPulse 2.2s ease-out infinite}",
    "@keyframes tvPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}",
    "#" + ID + "-root .tv-ico svg{width:20px;height:20px}",
    "#" + ID + "-root .tv-ltitle{display:block;font-size:13px;font-weight:700;line-height:1.2;letter-spacing:.01em}",
    "#" + ID + "-root .tv-lsub{display:block;font-size:10px;color:var(--tv-muted);line-height:1.35;margin-top:2px;max-width:160px}",
    "#" + ID + "-root .tv-badge{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--tv-signal-bright);margin-top:3px;display:block}",
    "#" + ID + "-root.is-open .tv-launcher{display:none}",
    "#" + ID + "-root .tv-panel{pointer-events:auto;display:none;flex-direction:column;width:min(390px,calc(100vw - 24px));",
    "max-height:min(78vh,640px);border-radius:20px;overflow:hidden;background:var(--tv-glass);",
    "backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);",
    "border:1px solid var(--tv-border);color:var(--tv-text);",
    "box-shadow:0 28px 70px -20px rgba(0,0,0,.65),0 0 40px -16px rgb(var(--tv-signal-rgb)/.2),inset 0 1px 0 rgba(255,255,255,.1);",
    "opacity:0;transform:translateY(16px) scale(.96);transition:opacity .35s var(--tv-ease),transform .4s var(--tv-spring)}",
    "#" + ID + "-root.is-open .tv-panel{display:flex;opacity:1;transform:none}",
    "#" + ID + "-root .tv-head{padding:16px 16px 13px;display:flex;align-items:center;gap:12px;background:var(--tv-grad);border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;position:relative;overflow:hidden}",
    "#" + ID + "-root .tv-head::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.12) 50%,transparent 70%);transform:translateX(-120%);animation:tvShine 3s ease-in-out infinite;pointer-events:none}",
    "@keyframes tvShine{0%,100%{transform:translateX(-120%)}50%{transform:translateX(120%)}}",
    "#" + ID + "-root .tv-head>*{position:relative;z-index:1}",
    "#" + ID + "-root .tv-head .tv-ico{width:42px;height:42px;border-radius:14px;background:rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}",
    "#" + ID + "-root .tv-head .tv-ico::after{display:none}",
    "#" + ID + "-root .tv-head b{display:block;font-size:16px;font-weight:800;letter-spacing:-.01em}",
    "#" + ID + "-root .tv-head span{display:block;font-size:11.5px;opacity:.85;margin-top:1px}",
    "#" + ID + "-root .tv-x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);color:#fff;font-size:18px;display:grid;place-items:center;transition:background .2s,transform .25s var(--tv-spring)}",
    "#" + ID + "-root .tv-x:hover{background:rgba(255,255,255,.26);transform:scale(1.05)}",
    "#" + ID + "-root .tv-steps{display:flex;gap:4px;padding:10px 14px 0;flex-shrink:0}",
    "#" + ID + "-root .tv-step-dot{flex:1;height:3px;border-radius:4px;background:rgba(255,255,255,.1);transition:background .3s}",
    "#" + ID + "-root .tv-step-dot.on{background:var(--tv-grad)}",
    "#" + ID + "-root .tv-body{padding:12px 14px 14px;overflow-y:auto;flex:1;min-height:0}",
    "#" + ID + "-root .tv-view{display:block;animation:tvIn .4s var(--tv-ease) both}",
    "@keyframes tvIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    "#" + ID + "-root .tv-h{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px;line-height:1.25}",
    "#" + ID + "-root .tv-p{font-size:12.5px;color:var(--tv-muted);line-height:1.5;margin:0 0 14px}",
    "#" + ID + "-root .tv-soft{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;margin-bottom:14px;",
    "background:rgb(var(--tv-trust-rgb)/.1);border:1px solid rgb(var(--tv-trust-rgb)/.3);font-size:11.5px;color:var(--tv-trust-bright);line-height:1.45}",
    "#" + ID + "-root .tv-soft svg{width:16px;height:16px;flex-shrink:0;margin-top:1px;stroke:var(--tv-trust-bright)}",
    "#" + ID + "-root label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--tv-muted);margin:0 0 6px}",
    "#" + ID + "-root .tv-field{margin-bottom:14px}",
    "#" + ID + "-root input,#" + ID + "-root select{width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);",
    "background:rgba(255,255,255,.06);color:#fff;font:600 14px Inter,system-ui,sans-serif;outline:none;transition:border-color .2s,box-shadow .2s}",
    "#" + ID + "-root input:focus,#" + ID + "-root select:focus{border-color:rgb(var(--tv-signal-rgb)/.55);box-shadow:0 0 0 3px rgb(var(--tv-signal-rgb)/.22)}",
    "#" + ID + "-root button:focus-visible,#" + ID + "-root input:focus-visible,#" + ID + "-root select:focus-visible{outline:2px solid var(--tv-signal-bright);outline-offset:2px}",
    "#" + ID + "-root select option{background:var(--tv-surface);color:#fff}",
    "#" + ID + "-root .tv-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
    "#" + ID + "-root .tv-pills{display:flex;gap:6px}",
    "#" + ID + "-root .tv-pill{flex:1;padding:10px 0;text-align:center;border-radius:10px;font-size:13px;font-weight:800;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--tv-muted);transition:all .2s var(--tv-ease)}",
    "#" + ID + "-root .tv-pill.on{background:var(--tv-grad);color:#fff;border-color:transparent;box-shadow:0 8px 18px -8px rgb(var(--tv-signal-rgb)/.5)}",
    "#" + ID + "-root .tv-hint{font-size:10px;color:var(--tv-faint);margin:6px 0 0}",
    "#" + ID + "-root .tv-actions{display:flex;gap:8px;margin-top:6px}",
    "#" + ID + "-root .tv-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:12px;font-weight:800;font-size:13px;transition:transform .3s var(--tv-spring),box-shadow .3s,filter .2s;position:relative;overflow:hidden}",
    "#" + ID + "-root .tv-btn:active{transform:scale(.97)}",
    "#" + ID + "-root .tv-btn[disabled]{opacity:.6;cursor:progress}",
    "#" + ID + "-root .tv-btn-primary{background:var(--tv-grad);color:#fff;box-shadow:0 10px 26px -10px rgb(var(--tv-signal-rgb)/.55),inset 0 1px 0 rgba(255,255,255,.2)}",
    "#" + ID + "-root .tv-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px)}",
    "#" + ID + "-root .tv-btn-ghost{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.14)}",
    "#" + ID + "-root .tv-btn-ghost:hover{background:rgba(255,255,255,.1)}",
    "#" + ID + "-root .tv-btn-wa{background:linear-gradient(145deg,var(--tv-wa),var(--tv-wa-deep));color:#fff;box-shadow:0 10px 26px -10px rgba(16,185,129,.45)}",
    "#" + ID + "-root .tv-result{border-radius:16px;padding:16px;margin-bottom:12px;",
    "background:linear-gradient(160deg,rgb(var(--tv-signal-rgb)/.2),rgb(var(--tv-blue-rgb)/.12),rgba(255,255,255,.03));border:1px solid rgb(var(--tv-signal-rgb)/.25)}",
    "#" + ID + "-root .tv-band{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;margin-bottom:10px;",
    "background:rgb(var(--tv-trust-rgb)/.14);color:var(--tv-trust-bright);border:1px solid rgb(var(--tv-trust-rgb)/.32)}",
    "#" + ID + "-root .tv-big{font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.1;margin:4px 0 2px;",
    "background:linear-gradient(120deg,var(--tv-signal-bright),var(--tv-signal) 55%,var(--tv-trust-bright));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
    "#" + ID + "-root .tv-range{font-size:12px;color:var(--tv-muted);margin-bottom:4px}",
    "#" + ID + "-root .tv-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}",
    "#" + ID + "-root .tv-metric{padding:10px;border-radius:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06)}",
    "#" + ID + "-root .tv-metric .k{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--tv-muted)}",
    "#" + ID + "-root .tv-metric .v{font-size:14px;font-weight:800;margin-top:3px}",
    "#" + ID + "-root .tv-fine{font-size:10px;color:var(--tv-faint);line-height:1.45;margin-top:12px}",
    "#" + ID + "-root .tv-spin{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:34px 0;color:var(--tv-muted);font-size:12.5px}",
    "#" + ID + "-root .tv-spin i{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.12);border-top-color:var(--tv-signal);animation:tvSpin .8s linear infinite}",
    "@keyframes tvSpin{to{transform:rotate(360deg)}}",
    "#" + ID + "-root .tv-foot{padding:10px 14px 12px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;font-size:10px;color:var(--tv-muted);text-align:center}",
    "#" + ID + "-root .tv-foot b{color:var(--tv-signal-bright)}",
    "@media (max-width:480px){",
    "#" + ID + "-root{align-items:" + (cfg.position === "left" ? "flex-start" : "flex-end") + "}",
    "#" + ID + "-root .tv-launcher{width:76px;min-height:76px;height:76px;padding:12px;border-radius:50%;justify-content:center;gap:0}",
    "#" + ID + "-root .tv-launcher>span:last-child{display:none}",
    "#" + ID + "-root .tv-panel{width:calc(100vw - 24px);max-width:400px;max-height:min(82vh,680px)}}",
    "@media (prefers-reduced-motion:reduce){#" + ID + "-root *{animation:none!important;transition-duration:.01ms!important}}",
    /* Light theme — cream/white surface to match a light host page. Overrides
       only the dark-assuming surfaces; the accent gradient (header, CTA) stays. */
    "#" + ID + "-root.is-light{--tv-text:#14141F;--tv-muted:rgba(84,98,120,.95);--tv-faint:rgba(84,98,120,.65);--tv-surface:#fff}",
    "#" + ID + "-root.is-light .tv-panel{background:#FBF9F3;border-color:rgba(20,20,31,.10);color:#14141F;box-shadow:0 24px 60px -26px rgba(20,20,31,.28),0 2px 10px rgba(20,20,31,.06)}",
    "#" + ID + "-root.is-light label{color:rgba(84,98,120,.9)}",
    "#" + ID + "-root.is-light input,#" + ID + "-root.is-light select{background:rgba(20,20,31,.035);border-color:rgba(20,20,31,.14);color:#14141F}",
    "#" + ID + "-root.is-light input::placeholder{color:rgba(84,98,120,.55)}",
    "#" + ID + "-root.is-light .tv-btn-ghost{background:rgba(20,20,31,.04);color:#14141F;border-color:rgba(20,20,31,.12)}",
    "#" + ID + "-root.is-light .tv-btn-ghost:hover{background:rgba(20,20,31,.07)}",
    "#" + ID + "-root.is-light .tv-pill{background:rgba(20,20,31,.04);color:rgba(84,98,120,.9);border-color:rgba(20,20,31,.12)}",
    "#" + ID + "-root.is-light .tv-metric{background:rgba(20,20,31,.03);border-color:rgba(20,20,31,.07)}",
    "#" + ID + "-root.is-light .tv-metric .v{color:#14141F}",
    "#" + ID + "-root.is-light .tv-h{color:#14141F}",
    "#" + ID + "-root.is-light .tv-hint{color:rgba(84,98,120,.7)}",
    "#" + ID + "-root.is-light .tv-fine{color:rgba(84,98,120,.6)}",
    "#" + ID + "-root.is-light .tv-foot{color:rgba(84,98,120,.7);border-top-color:rgba(20,20,31,.08)}",
    "#" + ID + "-root.is-light .tv-step-dot{background:rgba(20,20,31,.1)}",
    "#" + ID + "-root.is-light .tv-result{background:linear-gradient(160deg,rgb(var(--tv-signal-rgb)/.12),rgba(20,20,31,.015));border-color:rgb(var(--tv-signal-rgb)/.28)}",
    "#" + ID + "-root.is-light .tv-big{-webkit-text-fill-color:initial;background:none;color:var(--tv-signal-deep)}",
    cfg.font ? "#" + ID + "-root,#" + ID + "-root .tv-panel{font-family:" + cfg.font + "}" : "",
    /* Inline (in-page) mode — no floating launcher, panel sits in the flow. */
    ":host(.is-inline){position:static!important;inset:auto!important;max-width:none!important;width:100%!important;display:block!important;pointer-events:auto!important}",
    "#" + ID + "-root.is-inline{align-items:stretch!important;pointer-events:auto!important}",
    "#" + ID + "-root.is-inline .tv-launcher{display:none!important}",
    "#" + ID + "-root.is-inline .tv-panel{display:flex!important;opacity:1!important;transform:none!important;width:100%!important;max-width:none!important;max-height:none!important}",
    "#" + ID + "-root.is-inline .tv-x{display:none!important}",
    cfg.text ? "#" + ID + "-root{--tv-text:" + cfg.text + "}#" + ID + "-root .tv-launcher,#" + ID + "-root .tv-ltitle,#" + ID + "-root .tv-panel{color:" + cfg.text + "}" : "",
    cfg.scale ? "#" + ID + "-root .tv-launcher{transform:scale(" + cfg.scale + ");transform-origin:bottom " + cfg.position + "}" : ""
  ].join("");

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  var shadow = null;
  function $(sel) { return shadow ? shadow.querySelector(sel) : null; }
  function $$(sel) { return shadow ? Array.prototype.slice.call(shadow.querySelectorAll(sel)) : []; }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function mount() {
    var target = cfg.mount ? document.querySelector(cfg.mount) : null;
    var isInline = !!target;
    var hostEl = document.createElement("div");
    hostEl.id = ID + "-host";
    if (isInline) hostEl.className = "is-inline";
    (target || document.body).appendChild(hostEl);
    shadow = hostEl.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    var carIco = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5"/><path d="M5 17h14"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M3 13h18v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>';

    var root = el(
      '<div id="' + ID + '-root" data-app="truvalue" aria-live="polite">' +
        '<div class="tv-panel" role="dialog" aria-label="What\'s my car worth" aria-hidden="true">' +
          '<div class="tv-head">' +
            '<div class="tv-ico">' + carIco + "</div>" +
            "<div><b>What’s my car worth?</b><span>" + esc(cfg.dealer) + " · Instant estimate</span></div>" +
            '<button type="button" class="tv-x" id="' + ID + '-close" aria-label="Close">×</button>' +
          "</div>" +
          '<div class="tv-steps" id="' + ID + '-steps" aria-hidden="true">' +
            '<div class="tv-step-dot on"></div><div class="tv-step-dot"></div><div class="tv-step-dot"></div>' +
          "</div>" +
          '<div class="tv-body" id="' + ID + '-body"></div>' +
          '<div class="tv-foot">Powered by <b>TruSaaS TruValue</b> · Indicative estimate · Subject to full assessment</div>' +
        "</div>" +
        '<button type="button" class="tv-launcher" id="' + ID + '-open" aria-label="What\'s my car worth">' +
          '<span class="tv-ico">' + carIco + "</span>" +
          "<span>" +
            '<span class="tv-ltitle">What’s my car worth?</span>' +
            '<span class="tv-lsub">Instant trade-in estimate in ~30s.</span>' +
            '<span class="tv-badge">TruValue · Est.</span>' +
          "</span>" +
        "</button>" +
      "</div>"
    );
    shadow.appendChild(root);

    $("#" + ID + "-open").addEventListener("click", open);
    $("#" + ID + "-close").addEventListener("click", close);
    var rt = $("#" + ID + "-root");
    if (cfg.theme === "light") rt.classList.add("is-light");
    if (isInline) {
      state.open = true;
      rt.classList.add("is-inline");
      rt.querySelector(".tv-panel").setAttribute("aria-hidden", "false");
    }
    render();
  }

  function open() {
    state.open = true;
    var root = $("#" + ID + "-root");
    root.classList.add("is-open");
    root.querySelector(".tv-panel").setAttribute("aria-hidden", "false");
    render();
  }
  function close() {
    state.open = false;
    var root = $("#" + ID + "-root");
    root.classList.remove("is-open");
    root.querySelector(".tv-panel").setAttribute("aria-hidden", "true");
  }

  function renderSteps() {
    $$("#" + ID + "-steps .tv-step-dot").forEach(function (d, i) { d.classList.toggle("on", i < state.step); });
  }

  function yearOptions() {
    var out = "";
    for (var y = thisYear + 1; y >= 1995; y--) {
      out += '<option value="' + y + '"' + (y === state.year ? " selected" : "") + ">" + y + "</option>";
    }
    return out;
  }

  function render() {
    renderSteps();
    var body = $("#" + ID + "-body");
    if (!body) return;
    var html = "";

    if (state.loading) {
      html = '<div class="tv-view"><div class="tv-spin"><i></i><span>Checking the market…</span></div></div>';
    } else if (state.step === 1) {
      html =
        '<div class="tv-view">' +
        '<div class="tv-h">Instant trade-in estimate</div>' +
        '<p class="tv-p">Verified against the <b>live market value</b> of your car. Get your figure and a full trade-in report — then WhatsApp ' + esc(cfg.dealer) + " to book your assessment.</p>" +
        '<div class="tv-soft">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        "<div>Your <b>report is sent to you</b> after you submit. The figure is an estimate, <b>subject to a full assessment</b> of the vehicle.</div>" +
        "</div>" +
        '<div class="tv-actions"><button type="button" class="tv-btn tv-btn-primary" data-go="2">Start →</button></div>' +
        "</div>";
    } else if (state.step === 2) {
      html =
        '<div class="tv-view">' +
        '<div class="tv-h">Your vehicle</div>' +
        '<p class="tv-p">Priced against the live market. Reg, VIN &amp; condition help us prepare your report.</p>' +
        '<div class="tv-field"><label>Make</label><input type="text" id="tv-make" placeholder="e.g. Toyota" value="' + esc(state.make) + '" autocomplete="off"></div>' +
        '<div class="tv-field"><label>Model</label><input type="text" id="tv-model" placeholder="e.g. Corolla" value="' + esc(state.model) + '" autocomplete="off"></div>' +
        '<div class="tv-grid2">' +
        '<div class="tv-field"><label>Year</label><select id="tv-year">' + yearOptions() + "</select></div>" +
        '<div class="tv-field"><label>Mileage (km)</label><input type="tel" id="tv-km" inputmode="numeric" placeholder="e.g. 78000" value="' + esc(state.mileage) + '"></div>' +
        "</div>" +
        '<div class="tv-grid2">' +
        '<div class="tv-field"><label>Reg number</label><input type="text" id="tv-reg" placeholder="e.g. CA 123-456" value="' + esc(state.reg) + '" autocomplete="off"></div>' +
        '<div class="tv-field"><label>VIN</label><input type="text" id="tv-vin" placeholder="17 characters" value="' + esc(state.vin) + '" autocomplete="off"></div>' +
        "</div>" +
        '<div class="tv-field"><label>Condition (1 poor – 5 excellent)</label><div class="tv-pills" id="tv-cond">' +
        [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" class="tv-pill' + (state.condition === n ? " on" : "") + '" data-cond="' + n + '">' + n + "</button>";
        }).join("") +
        "</div></div>" +
        '<div class="tv-field"><label>Any damage / notes</label><input type="text" id="tv-damage" placeholder="e.g. small dent left door, none" value="' + esc(state.damage) + '"></div>' +
        '<div class="tv-actions">' +
        '<button type="button" class="tv-btn tv-btn-ghost" data-go="1">Back</button>' +
        '<button type="button" class="tv-btn tv-btn-primary" id="tv-estimate">Get my estimate →</button>' +
        "</div></div>";
    } else if (state.step === 3) {
      var r = state.result || {};
      var vehLine = [state.year, state.make, state.model].filter(Boolean).join(" ");
      var resultBlock;
      if (r.ok) {
        resultBlock =
          '<div class="tv-result">' +
          '<div class="tv-band">Trade estimate · subject to full assessment</div>' +
          '<div style="font-size:11px;color:var(--tv-muted);font-weight:700">Estimated trade-in · ' + esc(vehLine) + "</div>" +
          '<div class="tv-big">' + money(r.low) + " – " + money(r.high) + "</div>" +
          '<div class="tv-range">Verified against ' + (r.listingsFound || 0) + " live market listing" + ((r.listingsFound === 1) ? "" : "s") +
            (r.mileageAdjusted ? " · mileage-adjusted" : "") + "</div>" +
          '<p class="tv-hint">Your trade-in report is ready — we’ll send it to you on WhatsApp.</p>' +
          "</div>";
      } else {
        resultBlock =
          '<div class="tv-result">' +
          '<div class="tv-band">Let’s value it in person</div>' +
          '<div class="tv-big" style="font-size:18px">' + esc(vehLine || "Your vehicle") + "</div>" +
          '<div class="tv-range">We couldn’t pull enough live comps for an instant figure — send it through on WhatsApp and the team will value it with a full assessment.</div>' +
          "</div>";
      }
      html =
        '<div class="tv-view">' + resultBlock +
        '<div class="tv-field"><label>Your name</label><input type="text" id="tv-name" placeholder="Full name" value="' + esc(state.name) + '" autocomplete="name"></div>' +
        '<div class="tv-field"><label>Mobile</label><input type="tel" id="tv-phone" placeholder="06…" value="' + esc(state.phone) + '" autocomplete="tel"></div>' +
        '<div class="tv-actions">' +
        '<button type="button" class="tv-btn tv-btn-ghost" data-go="2">Back</button>' +
        '<button type="button" class="tv-btn tv-btn-wa" id="tv-wa">WhatsApp ' + esc(cfg.dealer.length > 12 ? "the team" : cfg.dealer) + "</button>" +
        "</div>" +
        '<p class="tv-fine">Indicative market estimate only — not a firm offer. The final trade-in value is subject to a full physical assessment by ' +
        esc(cfg.dealer) + ". Figures derive from live market listings and may vary with condition, service history and demand.</p>" +
        "</div>";
    }
    body.innerHTML = html;
    bindStep();
  }

  function readVehicle() {
    state.make = (($("#tv-make") || {}).value || "").trim();
    state.model = (($("#tv-model") || {}).value || "").trim();
    state.year = +(($("#tv-year") || {}).value || state.year);
    state.mileage = (($("#tv-km") || {}).value || "").replace(/[^\d]/g, "");
    state.reg = (($("#tv-reg") || {}).value || "").trim();
    state.vin = (($("#tv-vin") || {}).value || "").trim().toUpperCase();
    state.damage = (($("#tv-damage") || {}).value || "").trim();
  }

  function estimate() {
    readVehicle();
    if (!state.make || !state.model) {
      var first = !state.make ? $("#tv-make") : $("#tv-model");
      if (first) first.focus();
      return;
    }
    state.loading = true;
    render();
    var url = cfg.flowUrl + "/api/public/trade-estimate";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      mode: "cors",
      body: JSON.stringify({
        make: state.make, model: state.model, year: state.year, mileage: state.mileage,
        reg: state.reg, vin: state.vin, condition: state.condition, damage: state.damage,
        dealer: cfg.dealer, slug: cfg.slug, accent: cfg.accent, margin: Number(cfg.margin)
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { state.result = data && data.ok ? data : { ok: false }; })
      .catch(function () { state.result = { ok: false }; })
      .then(function () { state.loading = false; state.step = 3; render(); });
  }

  function sendLead() {
    state.name = (($("#tv-name") || {}).value || "").trim();
    state.phone = (($("#tv-phone") || {}).value || "").trim();
    var r = state.result || {};
    var vehLine = [state.year, state.make, state.model].filter(Boolean).join(" ");
    var estLine = r.ok ? (money(r.low) + " – " + money(r.high) + " (subject to full assessment)") : "Pending full assessment";
    var msg = [
      "Hi " + cfg.dealer + " — TruValue trade-in enquiry",
      "Name: " + (state.name || "—"),
      "Phone: " + (state.phone || "—"),
      "Vehicle: " + (vehLine || "—"),
      "Mileage: " + (state.mileage ? (Number(state.mileage).toLocaleString("en-ZA") + " km") : "—"),
      "Reg: " + (state.reg || "—"),
      "VIN: " + (state.vin || "—"),
      "Condition: " + state.condition + "/5",
      "Damage/notes: " + (state.damage || "—"),
      "Est. trade-in value: " + estLine,
      (r.reportUrl ? "My trade-in report: " + r.reportUrl : "Please send my trade-in report."),
      "(Indicative estimate — subject to full assessment)"
    ].join("\n");

    cmbNotify(cfg, "TruValue", [
      "Name: " + (state.name || "—"),
      "Phone: " + (state.phone || "—"),
      "Vehicle: " + (vehLine || "—"),
      "Est: " + estLine
    ].join("\n"));

    // Capture the lead FIRST — the WhatsApp redirect is a bonus, not a gate.
    if (cfg.webhook || (cfg.slug && cfg.flowUrl)) {
      var names = (state.name || "").trim().split(/\s+/);
      var leadUrl = cfg.webhook || (cfg.flowUrl + "/api/integration/webhook-lead");
      try {
        fetch(leadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealerSlug: cfg.slug,
            firstName: names[0] || "TruValue",
            lastName: names.slice(1).join(" ") || "Lead",
            phone: state.phone || "",
            email: "",
            source: "TruValue Widget",
            notes: msg
          }),
          mode: "cors",
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }
    if (!cfg.wa) return;
    window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
  }

  function bindStep() {
    $$("#" + ID + "-body [data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.step === 2) readVehicle(); // preserve typed values on Back
        state.step = +btn.getAttribute("data-go");
        render();
      });
    });
    $$("[data-cond]").forEach(function (b) {
      b.addEventListener("click", function () {
        readVehicle();
        state.condition = +b.getAttribute("data-cond");
        render();
      });
    });
    var est = $("#tv-estimate");
    if (est) est.addEventListener("click", estimate);
    var wa = $("#tv-wa");
    if (wa) wa.addEventListener("click", sendLead);
  }

  // When data-mount is set but the container isn't in the DOM yet (SPA /
  // design-tool hosts build the page after this script runs), wait for it to
  // appear before mounting inline; fall back to the floating launcher after a
  // few seconds so it never fails to render.
  function boot() {
    if (!cfg.mount || document.querySelector(cfg.mount)) return mount();
    var done = false;
    var obs = new MutationObserver(function () {
      if (!done && document.querySelector(cfg.mount)) { done = true; obs.disconnect(); mount(); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { if (!done) { done = true; obs.disconnect(); mount(); } }, 5000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.TruValue = { open: open, close: close, config: cfg };
})();
