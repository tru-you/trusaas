/**
 * TruAfford (Property) — soft affordability / pre-qual widget (TruSaaS)
 *
 * Property port of the canonical packages/tru-afford script: rent and
 * purchase affordability bands for agency sites, leads posted to the
 * agency's FlowPMS via /api/prop/webhook/lead.
 *
 * Drop-in:
 *   <script src="/widgets/tru-afford.js"
 *           data-agency="stone-heights"
 *           data-wa="27123456789"
 *           data-accent="#4FE3DC"
 *           data-property="prop_abc123"></script>
 *
 * Soft estimate only — not a hard credit bureau check.
 */
(function () {
  "use strict";
  if (window.__TruAffordLoaded) return;
  window.__TruAffordLoaded = true;

  var scr = document.currentScript || document.querySelector("script[src*='tru-afford']");
  function attr(name, fallback) {
    return (scr && scr.getAttribute(name)) || fallback;
  }

  var cfg = {
    agency: attr("data-agency", ""),
    wa: attr("data-wa", ""),
    flowUrl: attr("data-flow", ""),            // defaults to same origin
    propertyId: attr("data-property", ""),
    rate: parseFloat(attr("data-rate", "0.1175")),
    position: attr("data-position", "right"),
    offsetBottom: attr("data-bottom", "88px"),
    z: attr("data-z", "999990"),
    accent: attr("data-accent", "#4FE3DC"),
    accent2: attr("data-accent-2", ""),
    accent3: attr("data-accent-3", "")
  };

  var ID = "tru-afford";

  /* ---------- colour helpers ---------- */
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
  function mix(rgb, target, amount) {
    return rgb.map(function (v, i) { return v + (target[i] - v) * amount; });
  }
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
    "--ta-signal:", toHex(accent), ";",
    "--ta-signal-bright:", toHex(accentBright), ";",
    "--ta-signal-deep:", toHex(accentDeep), ";",
    "--ta-signal-rgb:", chan(accent), ";",
    "--ta-blue:", toHex(accent2), ";",
    "--ta-blue-rgb:", chan(accent2), ";",
    "--ta-trust:", toHex(accent3), ";",
    "--ta-trust-bright:", toHex(accent3Bright), ";",
    "--ta-trust-rgb:", chan(accent3), ";",
    "--ta-grad:linear-gradient(115deg,", toHex(accentBright), " 0%,", toHex(accent), " 48%,", toHex(accent2), " 100%);",
    "--ta-ink:#06070c;--ta-ok:#22C55E;--ta-warn:#F59E0B;--ta-warn-text:#fcd34d;",
    "--ta-wa:#25D366;--ta-wa-deep:#059669;",
    "--ta-glass:rgba(15,15,19,.85);--ta-border:#2a2a30;",
    "--ta-text:#F4F4F1;--ta-muted:#94A3B8;--ta-faint:rgba(148,163,184,.75);",
    "--ta-surface:#1a1a1f;",
    "--ta-ease:cubic-bezier(.22,1,.36,1);--ta-spring:cubic-bezier(.34,1.4,.64,1);"
  ].join("");

  var state = {
    open: false,
    mode: "rent",            // rent | buy
    step: 1,
    income: 25000,
    expenses: 12000,
    deposit: 10,
    term: 24,                // months (buy steps by 12 -> years)
    employment: "permanent",
    name: "",
    phone: "",
    result: null
  };

  function money(n) {
    return "R " + Math.round(n || 0).toLocaleString("en-ZA");
  }

  function calc() {
    var net = Math.max(0, state.income - state.expenses);
    var empFactor = { permanent: 1, contract: 0.9, self: 0.82, other: 0.75 }[state.employment] || 0.85;

    if (state.mode === "rent") {
      // Rent affordability: 22–32% of disposable income.
      var maxRent = Math.max(0, net * 0.32 * empFactor);
      var minRent = Math.max(0, net * 0.22 * empFactor);
      var ratio = state.income > 0 ? (state.expenses / state.income) : 1;
      var band = "Fair";
      if (net >= 15000 && ratio <= 0.55 && state.employment === "permanent") band = "Strong";
      else if (net >= 8000 && ratio <= 0.7) band = "Good";
      else if (net < 3500) band = "Tight";
      return {
        net: net, band: band,
        rentMin: Math.round(minRent), rentMax: Math.round(maxRent),
        depositAmt: Math.round(maxRent * 2)   // ~first month + deposit
      };
    }

    // Purchase affordability: instalment band on disposable income, 20-yr term.
    var maxInstalment = Math.max(0, net * 0.32 * empFactor);
    var minInstalment = Math.max(0, net * 0.22 * empFactor);
    var r = cfg.rate / 12;
    var n = state.term >= 300 ? state.term : state.term * 12;  // months
    function principal(instalment) {
      if (r <= 0) return instalment * n;
      return instalment * (1 - Math.pow(1 + r, -n)) / r;
    }
    var loanMax = principal(maxInstalment);
    var loanMin = principal(minInstalment);
    var dep = state.deposit / 100;
    var priceMax = dep < 0.95 ? loanMax / (1 - dep) : loanMax;
    var priceMin = dep < 0.95 ? loanMin / (1 - dep) : loanMin;
    var ratio = state.income > 0 ? (state.expenses / state.income) : 1;
    var band = "Fair";
    if (net >= 15000 && ratio <= 0.55 && state.employment === "permanent") band = "Strong";
    else if (net >= 8000 && ratio <= 0.7) band = "Good";
    else if (net < 3500) band = "Tight";
    return {
      net: net, band: band,
      priceMin: Math.max(0, Math.round(priceMin)),
      priceMax: Math.min(Math.round(priceMax), 25000000),
      minInstalment: Math.round(minInstalment),
      maxInstalment: Math.round(maxInstalment),
      depositAmt: Math.round(priceMax * dep)
    };
  }

  var CSS = [
    ":host{all:initial;",
    VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    "position:fixed;z-index:" + cfg.z + ";bottom:" + cfg.offsetBottom + ";",
    cfg.position === "left" ? "left:16px;right:auto;" : "right:16px;left:auto;",
    "display:block;max-width:min(400px,calc(100vw - 24px));pointer-events:none}",
    "#" + ID + "-root{",
    VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    "display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}",
    "#" + ID + "-root *,#" + ID + "-root *::before,#" + ID + "-root *::after{box-sizing:border-box}",
    "#" + ID + "-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}",
    "#" + ID + "-root .ta-launcher{",
    "pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;",
    "border-radius:100px;background:linear-gradient(145deg,rgba(18,18,20,.92),rgba(15,15,19,.96));",
    "border:1px solid rgb(var(--ta-signal-rgb)/.28);color:#fff;",
    "box-shadow:0 12px 36px -10px rgba(0,0,0,.55),0 0 24px -8px rgb(var(--ta-signal-rgb)/.35),inset 0 1px 0 rgba(255,255,255,.1);",
    "backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);",
    "transition:transform .35s var(--ta-spring),box-shadow .35s var(--ta-ease);max-width:240px;text-align:left}",
    "#" + ID + "-root .ta-launcher:hover{transform:translateY(-3px) scale(1.02)}",
    "#" + ID + "-root .ta-launcher:active{transform:scale(.97)}",
    "#" + ID + "-root .ta-ico{",
    "width:40px;height:40px;border-radius:50%;flex-shrink:0;",
    "background:var(--ta-grad);display:grid;place-items:center;",
    "box-shadow:0 6px 18px -4px rgb(var(--ta-signal-rgb)/.55);position:relative}",
    "#" + ID + "-root .ta-ico::after{content:'';position:absolute;inset:-4px;border-radius:50%;",
    "border:2px solid rgb(var(--ta-signal-rgb)/.45);animation:taPulse 2.2s ease-out infinite}",
    "@keyframes taPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}",
    "#" + ID + "-root .ta-ico svg{width:20px;height:20px}",
    "#" + ID + "-root .ta-ltitle{display:block;font-size:13px;font-weight:700;line-height:1.2;letter-spacing:.01em}",
    "#" + ID + "-root .ta-lsub{display:block;font-size:10px;color:var(--ta-muted);line-height:1.35;margin-top:2px;max-width:160px}",
    "#" + ID + "-root .ta-badge{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;",
    "color:var(--ta-signal-bright);margin-top:3px;display:block}",
    "#" + ID + "-root.is-open .ta-launcher{display:none}",
    "#" + ID + "-root .ta-panel{",
    "pointer-events:auto;display:none;flex-direction:column;width:min(390px,calc(100vw - 24px));",
    "max-height:min(78vh,640px);border-radius:20px;overflow:hidden;",
    "background:var(--ta-glass);backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);",
    "border:1px solid var(--ta-border);color:var(--ta-text);",
    "box-shadow:0 28px 70px -20px rgba(0,0,0,.65),0 0 40px -16px rgb(var(--ta-signal-rgb)/.2),inset 0 1px 0 rgba(255,255,255,.1);",
    "opacity:0;transform:translateY(16px) scale(.96);transition:opacity .35s var(--ta-ease),transform .4s var(--ta-spring)}",
    "#" + ID + "-root.is-open .ta-panel{display:flex;opacity:1;transform:none}",
    "#" + ID + "-root .ta-head{",
    "padding:14px 14px 12px;display:flex;align-items:center;gap:10px;",
    "background:var(--ta-grad);border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}",
    "#" + ID + "-root .ta-head b{display:block;font-size:14px;font-weight:800}",
    "#" + ID + "-root .ta-head span{font-size:11px;opacity:.9}",
    "#" + ID + "-root .ta-x{",
    "margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);",
    "color:#fff;font-size:18px;display:grid;place-items:center;transition:background .2s,transform .25s var(--ta-spring)}",
    "#" + ID + "-root .ta-steps{display:flex;gap:4px;padding:10px 14px 0;flex-shrink:0}",
    "#" + ID + "-root .ta-step-dot{flex:1;height:3px;border-radius:4px;background:rgba(255,255,255,.1);transition:background .3s}",
    "#" + ID + "-root .ta-step-dot.on{background:var(--ta-grad)}",
    "#" + ID + "-root .ta-body{padding:12px 14px 14px;overflow-y:auto;flex:1;min-height:0}",
    "#" + ID + "-root .ta-view{display:none;animation:taIn .4s var(--ta-ease) both}",
    "#" + ID + "-root .ta-view.on{display:block}",
    "@keyframes taIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    "#" + ID + "-root .ta-h{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px;line-height:1.25}",
    "#" + ID + "-root .ta-p{font-size:12.5px;color:var(--ta-muted);line-height:1.5;margin:0 0 14px}",
    "#" + ID + "-root .ta-soft{",
    "display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;margin-bottom:14px;",
    "background:rgb(var(--ta-trust-rgb)/.1);border:1px solid rgb(var(--ta-trust-rgb)/.3);",
    "font-size:11.5px;color:var(--ta-trust-bright);line-height:1.45}",
    "#" + ID + "-root .ta-soft svg{width:16px;height:16px;flex-shrink:0;margin-top:1px;stroke:var(--ta-trust-bright)}",
    "#" + ID + "-root label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ta-muted);margin:0 0 6px}",
    "#" + ID + "-root .ta-field{margin-bottom:14px}",
    "#" + ID + "-root .ta-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}",
    "#" + ID + "-root .ta-row output{font-weight:800;font-size:13px;color:#fff}",
    "#" + ID + "-root input[type=range]{width:100%;appearance:none;height:4px;border-radius:4px;outline:none;",
    "background:linear-gradient(90deg,var(--ta-signal) 0%,var(--ta-blue) var(--fill,50%),rgba(255,255,255,.12) var(--fill,50%))}",
    "#" + ID + "-root input[type=range]::-webkit-slider-thumb{appearance:none;width:20px;height:20px;border-radius:50%;",
    "background:#fff;border:4px solid var(--ta-signal);box-shadow:0 2px 10px rgb(var(--ta-signal-rgb)/.45);cursor:grab}",
    "#" + ID + "-root input[type=text],#" + ID + "-root input[type=tel],#" + ID + "-root select{",
    "width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);",
    "background:rgba(255,255,255,.06);color:#fff;font:600 14px Inter,system-ui,sans-serif;outline:none;",
    "transition:border-color .2s,box-shadow .2s}",
    "#" + ID + "-root input:focus,#" + ID + "-root select:focus{",
    "border-color:rgb(var(--ta-signal-rgb)/.55);box-shadow:0 0 0 3px rgb(var(--ta-signal-rgb)/.22)}",
    "#" + ID + "-root button:focus-visible,#" + ID + "-root input:focus-visible,#" + ID + "-root select:focus-visible{",
    "outline:2px solid var(--ta-signal-bright);outline-offset:2px}",
    "#" + ID + "-root select option{background:var(--ta-surface);color:#fff}",
    "#" + ID + "-root .ta-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
    "#" + ID + "-root .ta-pills{display:flex;flex-wrap:wrap;gap:6px}",
    "#" + ID + "-root .ta-pill{",
    "padding:9px 12px;border-radius:100px;font-size:11.5px;font-weight:700;",
    "border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:var(--ta-muted);",
    "transition:all .25s var(--ta-ease)}",
    "#" + ID + "-root .ta-pill.on{background:var(--ta-grad);color:#fff;border-color:transparent;",
    "box-shadow:0 8px 18px -8px rgb(var(--ta-signal-rgb)/.5)}",
    "#" + ID + "-root .ta-mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;padding:4px;",
    "border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}",
    "#" + ID + "-root .ta-mode button{padding:9px 10px;border-radius:9px;font-size:12px;font-weight:800;color:var(--ta-muted);transition:all .25s var(--ta-ease)}",
    "#" + ID + "-root .ta-mode button.on{background:var(--ta-grad);color:#fff;box-shadow:0 6px 16px -8px rgb(var(--ta-signal-rgb)/.5)}",
    "#" + ID + "-root .ta-actions{display:flex;gap:8px;margin-top:6px}",
    "#" + ID + "-root .ta-btn{",
    "flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;",
    "padding:12px 14px;border-radius:12px;font-weight:800;font-size:13px;",
    "transition:transform .3s var(--ta-spring),box-shadow .3s,filter .2s;position:relative;overflow:hidden}",
    "#" + ID + "-root .ta-btn:active{transform:scale(.97)}",
    "#" + ID + "-root .ta-btn-primary{",
    "background:var(--ta-grad);color:#fff;",
    "box-shadow:0 10px 26px -10px rgb(var(--ta-signal-rgb)/.55),inset 0 1px 0 rgba(255,255,255,.2)}",
    "#" + ID + "-root .ta-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px)}",
    "#" + ID + "-root .ta-btn-ghost{",
    "background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.14)}",
    "#" + ID + "-root .ta-btn-ghost:hover{background:rgba(255,255,255,.1)}",
    "#" + ID + "-root .ta-btn-wa{",
    "background:linear-gradient(145deg,var(--ta-wa),var(--ta-wa-deep));color:#fff;",
    "box-shadow:0 10px 26px -10px rgba(16,185,129,.45)}",
    "#" + ID + "-root .ta-result{",
    "border-radius:16px;padding:16px;margin-bottom:12px;",
    "background:linear-gradient(160deg,rgb(var(--ta-signal-rgb)/.2),rgb(var(--ta-blue-rgb)/.12),rgba(255,255,255,.03));",
    "border:1px solid rgb(var(--ta-signal-rgb)/.25)}",
    "#" + ID + "-root .ta-band{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;",
    "letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;margin-bottom:10px;",
    "background:rgb(var(--ta-trust-rgb)/.14);color:var(--ta-trust-bright);border:1px solid rgb(var(--ta-trust-rgb)/.32)}",
    "#" + ID + "-root .ta-band.tight{background:rgba(245,158,11,.12);color:var(--ta-warn-text);border-color:rgba(245,158,11,.3)}",
    "#" + ID + "-root .ta-big{font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.1;margin:4px 0 2px;",
    "background:linear-gradient(120deg,var(--ta-signal-bright),var(--ta-signal) 55%,var(--ta-trust-bright));",
    "-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}",
    "#" + ID + "-root .ta-range{font-size:12px;color:var(--ta-muted);margin-bottom:12px}",
    "#" + ID + "-root .ta-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
    "#" + ID + "-root .ta-metric{padding:10px;border-radius:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06)}",
    "#" + ID + "-root .ta-metric .k{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ta-muted)}",
    "#" + ID + "-root .ta-metric .v{font-size:14px;font-weight:800;margin-top:3px}",
    "#" + ID + "-root .ta-fine{font-size:10px;color:var(--ta-faint);line-height:1.45;margin-top:12px}",
    "#" + ID + "-root .ta-foot{padding:10px 14px 12px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;",
    "font-size:10px;color:var(--ta-muted);text-align:center}",
    "#" + ID + "-root .ta-foot b{color:var(--ta-signal-bright)}",
    "@media (max-width:420px){#" + ID + "-root{right:12px;left:12px;align-items:stretch}",
    "#" + ID + "-root .ta-launcher{max-width:none;width:100%;justify-content:flex-start}",
    "#" + ID + "-root .ta-panel{width:100%;max-height:min(82vh,680px)}}",
    "@media (prefers-reduced-motion:reduce){#" + ID + "-root *{animation:none!important;transition-duration:.01ms!important}}"
  ].join("");

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function fillRange(input) {
    if (!input) return;
    var min = +input.min, max = +input.max, val = +input.value;
    var pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty("--fill", pct + "%");
  }

  var shadow = null;
  function $(sel) { return shadow ? shadow.querySelector(sel) : null; }
  function $$(sel) { return shadow ? Array.prototype.slice.call(shadow.querySelectorAll(sel)) : []; }

  function mount() {
    var hostEl = document.createElement("div");
    hostEl.id = ID + "-host";
    document.body.appendChild(hostEl);
    shadow = hostEl.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.id = ID + "-css";
    style.textContent = CSS;
    shadow.appendChild(style);

    var root = el(
      '<div id="' + ID + '-root" data-app="truafford" aria-live="polite">' +
        '<div class="ta-panel" role="dialog" aria-label="Check affordability" aria-hidden="true">' +
          '<div class="ta-head">' +
            '<div class="ta-ico" style="width:36px;height:36px">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 11l9-7 9 7M5 10v10h14V10M9 20v-6h6v6"/></svg>' +
            "</div>" +
            "<div><b>Check Affordability</b><span>Rent or buy · Soft pre-qual</span></div>" +
            '<button type="button" class="ta-x" id="' + ID + '-close" aria-label="Close">×</button>' +
          "</div>" +
          '<div class="ta-steps" id="' + ID + '-steps" aria-hidden="true">' +
            '<div class="ta-step-dot on"></div><div class="ta-step-dot"></div><div class="ta-step-dot"></div><div class="ta-step-dot"></div>' +
          "</div>" +
          '<div class="ta-body" id="' + ID + '-body"></div>' +
          '<div class="ta-foot">Powered by <b>TruSaaS TruAfford</b> · Soft estimate only · Not a credit bureau check</div>' +
        "</div>" +
        '<button type="button" class="ta-launcher" id="' + ID + '-open" aria-label="Check affordability">' +
          '<span class="ta-ico">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 11l9-7 9 7M5 10v10h14V10M9 20v-6h6v6"/></svg>' +
          "</span>" +
          "<span>" +
            '<span class="ta-ltitle">Check Affordability</span>' +
            '<span class="ta-lsub">Your rent or bond budget in ~60s. No hard credit check.</span>' +
            '<span class="ta-badge">TruAfford · Soft</span>' +
          "</span>" +
        "</button>" +
      "</div>"
    );
    shadow.appendChild(root);

    $("#" + ID + "-open").addEventListener("click", open);
    $("#" + ID + "-close").addEventListener("click", close);
    render();
  }

  function open() {
    state.open = true;
    var root = $("#" + ID + "-root");
    root.classList.add("is-open");
    root.querySelector(".ta-panel").setAttribute("aria-hidden", "false");
    render();
  }
  function close() {
    state.open = false;
    var root = $("#" + ID + "-root");
    root.classList.remove("is-open");
    root.querySelector(".ta-panel").setAttribute("aria-hidden", "true");
  }

  function setStep(n) {
    state.step = n;
    render();
  }

  function renderSteps() {
    $$("#" + ID + "-steps .ta-step-dot").forEach(function (d, i) {
      d.classList.toggle("on", i < state.step);
    });
  }

  function render() {
    renderSteps();
    var body = $("#" + ID + "-body");
    if (!body) return;
    var html = "";
    if (state.step === 1) {
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Know your budget before you fall in love with a home.</div>' +
        '<p class="ta-p">A soft affordability estimate — no hard bureau pull, no score damage claim. Instant range, then chat or WhatsApp the team.</p>' +
        '<div class="ta-mode">' +
        '<button type="button" data-mode="rent"' + (state.mode === "rent" ? " class=\"on\"" : "") + '>Rent</button>' +
        '<button type="button" data-mode="buy"' + (state.mode === "buy" ? " class=\"on\"" : "") + '>Buy</button>' +
        "</div>" +
        '<div class="ta-soft">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        "<div><b>Soft pre-qual only.</b> This is not a credit application and not a formal quote. Banks and landlords make the final call.</div>" +
        "</div>" +
        '<div class="ta-actions"><button type="button" class="ta-btn ta-btn-primary" data-go="2">Start check →</button></div>' +
        "</div>";
    } else if (state.step === 2) {
      var termLabel = state.mode === "rent" ? "Lease term" : "Bond term";
      var termMax = state.mode === "rent" ? 36 : 240;
      var termStep = state.mode === "rent" ? 3 : 12;
      if (state.mode === "rent" && state.term > 36) state.term = 12;
      if (state.mode === "buy" && state.term < 120) state.term = 240;
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Your monthly numbers</div>' +
        '<p class="ta-p">We\u2019ll estimate your ' + (state.mode === "rent" ? "rent" : "bond instalment") + ' band from disposable income.</p>' +
        '<div class="ta-field"><div class="ta-row"><label>Net monthly income</label><output id="o-inc">' + money(state.income) + "</output></div>" +
        '<input type="range" id="r-inc" min="8000" max="120000" step="500" value="' + state.income + '"></div>' +
        '<div class="ta-field"><div class="ta-row"><label>Monthly expenses</label><output id="o-exp">' + money(state.expenses) + "</output></div>" +
        '<input type="range" id="r-exp" min="2000" max="80000" step="500" value="' + state.expenses + '"></div>' +
        '<div class="ta-grid2">' +
        (state.mode === "buy" ?
          '<div class="ta-field"><div class="ta-row"><label>Deposit</label><output id="o-dep">' + state.deposit + "%</output></div>" +
          '<input type="range" id="r-dep" min="0" max="40" step="5" value="' + state.deposit + '"></div>' : "") +
        '<div class="ta-field"><div class="ta-row"><label>' + termLabel + '</label><output id="o-term">' + (state.mode === "rent" ? state.term + " mo" : Math.round(state.term / 12) + " yr") + "</output></div>" +
        '<input type="range" id="r-term" min="' + (state.mode === "rent" ? 6 : 60) + '" max="' + termMax + '" step="' + termStep + '" value="' + state.term + '"></div>' +
        "</div>" +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="1">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-primary" data-go="3">Next →</button>' +
        "</div></div>";
    } else if (state.step === 3) {
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Employment profile</div>' +
        '<p class="ta-p">Helps us adjust the soft band — still not a bureau score.</p>' +
        '<div class="ta-field"><label>Employment type</label><div class="ta-pills" id="emp-pills">' +
        pill("permanent", "Permanent") +
        pill("contract", "Contract") +
        pill("self", "Self-employed") +
        pill("other", "Other") +
        "</div></div>" +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="2">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-primary" data-go="4">See my range →</button>' +
        "</div></div>";
    } else if (state.step === 4) {
      var r = state.result || calc();
      state.result = r;
      var bandClass = r.band === "Tight" ? " tight" : "";
      var rangeLine = state.mode === "rent"
        ? '<div class="ta-big">' + money(r.rentMin) + " – " + money(r.rentMax) + "</div>" +
          '<div class="ta-range">Indicative monthly rent at ~' + Math.round(32) + "% of disposable income · " + state.term + "-month lease</div>" +
          '<div class="ta-metrics">' +
          '<div class="ta-metric"><div class="k">Comfy</div><div class="v">' + money(r.rentMin) + "</div></div>" +
          '<div class="ta-metric"><div class="k">Up to</div><div class="v">' + money(r.rentMax) + "</div></div>" +
          '<div class="ta-metric"><div class="k">Disposable</div><div class="v">' + money(r.net) + "</div></div>" +
          '<div class="ta-metric"><div class="k">Budget ≈</div><div class="v">' + money(r.depositAmt) + " up-front</div></div>" +
          "</div>"
        : '<div class="ta-big">' + money(r.priceMin) + " – " + money(r.priceMax) + "</div>" +
          '<div class="ta-range">Indicative price at ~' + (cfg.rate * 100).toFixed(2) + "% over " + Math.round(state.term / 12) + " years · " + state.deposit + "% deposit</div>" +
          '<div class="ta-metrics">' +
          '<div class="ta-metric"><div class="k">Instalment from</div><div class="v">' + money(r.minInstalment) + "</div></div>" +
          '<div class="ta-metric"><div class="k">Instalment up to</div><div class="v">' + money(r.maxInstalment) + "</div></div>" +
          '<div class="ta-metric"><div class="k">Disposable</div><div class="v">' + money(r.net) + "</div></div>" +
          '<div class="ta-metric"><div class="k">Deposit ≈</div><div class="v">' + money(r.depositAmt) + "</div></div>" +
          "</div>";
      html =
        '<div class="ta-view on">' +
        '<div class="ta-result">' +
        '<div class="ta-band' + bandClass + '">Soft band · ' + r.band + "</div>" +
        '<div style="font-size:11px;color:var(--ta-muted);font-weight:700">' + (state.mode === "rent" ? "Estimated monthly rent" : "Estimated purchase budget") + "</div>" +
        rangeLine +
        "</div>" +
        '<div class="ta-field"><label>Your name</label><input type="text" id="ta-name" placeholder="Full name" value="' + esc(state.name) + '" autocomplete="name"></div>' +
        '<div class="ta-field"><label>Mobile</label><input type="tel" id="ta-phone" placeholder="06…" value="' + esc(state.phone) + '" autocomplete="tel"></div>' +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="3">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-wa" id="ta-wa">WhatsApp result</button>' +
        "</div>" +
        '<p class="ta-fine">Estimate only. Final rate, term and approval subject to bank / FSP credit assessment. TruSaaS is not offering credit by this tool alone. Illustrative rate ' +
        (cfg.rate * 100).toFixed(2) + "% linked, excl. fees & insurance.</p>" +
        "</div>";
    }
    body.innerHTML = html;
    bindStep();
  }

  function pill(val, label) {
    return '<button type="button" class="ta-pill' + (state.employment === val ? " on" : "") + '" data-emp="' + val + '">' + label + "</button>";
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function bindStep() {
    bodyClick();
    $$("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.mode = b.getAttribute("data-mode");
        state.result = null;
        render();
      });
    });
    ["r-inc", "r-exp", "r-dep", "r-term"].forEach(function (id) {
      var input = $("#" + id);
      if (!input) return;
      fillRange(input);
      input.addEventListener("input", function () {
        if (id === "r-inc") {
          state.income = +input.value;
          $("#o-inc").textContent = money(state.income);
        }
        if (id === "r-exp") {
          state.expenses = +input.value;
          $("#o-exp").textContent = money(state.expenses);
        }
        if (id === "r-dep") {
          state.deposit = +input.value;
          $("#o-dep").textContent = state.deposit + "%";
        }
        if (id === "r-term") {
          state.term = +input.value;
          $("#o-term").textContent = state.mode === "rent" ? state.term + " mo" : Math.round(state.term / 12) + " yr";
        }
        fillRange(input);
      });
    });
    $$("[data-emp]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.employment = b.getAttribute("data-emp");
        render();
      });
    });
    var wa = $("#ta-wa");
    if (wa) {
      wa.addEventListener("click", function () {
        state.name = ($("#ta-name") || {}).value || "";
        state.phone = ($("#ta-phone") || {}).value || "";
        state.result = calc();
        var r = state.result;
        var line = state.mode === "rent"
          ? ["Rent budget: " + money(r.rentMin) + " – " + money(r.rentMax) + "/pm"]
          : ["Purchase range: " + money(r.priceMin) + " – " + money(r.priceMax), "Instalment: " + money(r.minInstalment) + " – " + money(r.maxInstalment) + "/pm"];
        var msg = [
          "TruAfford soft estimate (" + state.mode + ")",
          "Name: " + (state.name || "—"),
          "Phone: " + (state.phone || "—"),
          "Net income: " + money(state.income),
          "Expenses: " + money(state.expenses),
          (state.mode === "rent" ? "Lease: " + state.term + " months" : "Deposit: " + state.deposit + "% · Term: " + Math.round(state.term / 12) + " years"),
          "Employment: " + state.employment,
          "Soft band: " + r.band
        ].concat(line, ["(Soft estimate only — not a credit application)"]);
        if (cfg.wa) {
          window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(msg.join("\n")), "_blank", "noopener");
        }
        postLead(msg.join("\n"));
      });
    }
  }

  function postLead(notes) {
    if (!cfg.agency) return;
    var flow = (cfg.flowUrl || window.location.origin).replace(/\/$/, "");
    try {
      fetch(flow + "/api/prop/webhook/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency: cfg.agency,
          name: state.name || "TruAfford lead",
          contact: state.phone || "",
          message: notes,
          propertyId: cfg.propertyId || "",
          source: "TruAfford widget"
        }),
        mode: "cors",
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function bodyClick() {
    $$("#" + ID + "-body [data-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = +btn.getAttribute("data-go");
        if (n === 4) state.result = calc();
        setStep(n);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.TruAfford = { open: open, close: close, config: cfg };
})();