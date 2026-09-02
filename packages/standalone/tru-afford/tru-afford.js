/**
 * TruAfford — soft affordability / pre-qual widget (TruSaaS)
 *
 * CANONICAL SOURCE. The per-dealer copies under case-sites/ and truweb/ are
 * deploy artefacts — fix bugs here, then re-copy. Four copies had already
 * drifted (all four claimed data-dealer="Your Car Guy") before this existed.
 *
 * Drop-in:
 *   <script src="tru-afford.js"
 *           data-dealer="Cars on Caledon"
 *           data-wa="27618759389"
 *           data-accent="#e30613"></script>
 *
 * Theming — the widget takes the dealer's brand colour and derives the rest.
 *   data-accent    base brand colour. Default TruSaaS cyan #4FE3DC.
 *   data-accent-2  far end of the gradient sweep. Default: accent darkened.
 *   data-accent-3  trust/confirm chips. Default: accent.
 * Only data-accent is normally needed. All shades, glows and tints derive
 * from it, so a dealer recolour is an embed-tag edit, never a JS edit.
 *
 * The panel is dark by design — it sits over arbitrary dealer pages and a
 * dark glass surface is predictable against both light and dark hosts.
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

  /* CallMeBot: fire-and-forget WhatsApp ping to the dealer. Opt-in via
     data-callmebot-key. Customer PII rides in the URL to callmebot.com, so
     this is an instant-notification floor, not a system of record — pair it
     with data-webhook for a durable CRM record. */
  function cmbNotify(cfg, source, text) {
    if (!cfg || !cfg.cmbKey || !cfg.cmbPhone) return;
    try {
      new Image().src =
        "https://api.callmebot.com/whatsapp.php?phone=" + cfg.cmbPhone +
        "&apikey=" + encodeURIComponent(cfg.cmbKey) +
        "&text=" + encodeURIComponent("New " + source + " lead — " + (cfg.dealer || "") + "\n" + (text || ""));
    } catch (e) {}
  }

  var MARKETS = {
    za: { cur: "R", locale: "en-ZA", income: 25000, incomeMin: 8000, incomeMax: 120000, incomeStep: 500, expenses: 12000, expensesMin: 2000, expensesMax: 80000, expensesStep: 500, strong: 15000, good: 8000, tight: 3500, priceCap: 2500000 },
    uk: { cur: "£", locale: "en-GB", income: 3200, incomeMin: 1000, incomeMax: 12000, incomeStep: 50, expenses: 1500, expensesMin: 300, expensesMax: 6000, expensesStep: 50, strong: 1800, good: 1000, tight: 400, priceCap: 100000 },
    us: { cur: "$", locale: "en-US", income: 5500, incomeMin: 2000, incomeMax: 20000, incomeStep: 100, expenses: 2500, expensesMin: 500, expensesMax: 12000, expensesStep: 100, strong: 3000, good: 1800, tight: 800, priceCap: 150000 }
  };

  var cfg = {
    dealer: attr("data-dealer", "this dealership"),
    wa: attr("data-wa", ""),
    rate: parseFloat(attr("data-rate", "0.1175")),
    position: attr("data-position", "right"), // right | left
    offsetBottom: attr("data-bottom", "88px"), // clear WhatsApp FAB
    z: attr("data-z", "2147400000"),
    text: attr("data-text", ""),   // override primary text colour
    scale: attr("data-scale", ""), // launcher size multiplier, e.g. 1.1
    accent: attr("data-accent", "#4FE3DC"),
    accent2: attr("data-accent-2", ""),
    accent3: attr("data-accent-3", ""),
    flowUrl: attr("data-flow", ""),
    webhook: attr("data-webhook", ""),
    cmbKey: attr("data-callmebot-key", ""),
    cmbPhone: ((attr("data-callmebot-phone", "") || attr("data-wa", "")) || "").replace(/\D/g, ""),
    slug: attr("data-slug", ""),
    market: attr("data-market", "za"),
    mount: attr("data-mount", "") || attr("data-target", "")
  };

  var preset = MARKETS[cfg.market] || MARKETS.za;

  var ID = "tru-afford";

  /* ---------- colour helpers ----------
     The dealer supplies one hex; every shade, glow and tint is derived from
     it here rather than being hand-picked per client. Mixing toward white or
     black keeps hue and saturation intact, so an accent that reads well on
     the dealer's own site still reads well inside the widget. */
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

  /* ---------- palette ----------
     Channel forms (--ta-*-rgb) exist because glows and tints need alphas the
     flat hex cannot express. Everything downstream consumes these vars, so
     there is no literal brand colour anywhere below this block. */
  var VARS = [
    "--ta-signal:", toHex(accent), ";",
    "--ta-signal-bright:", toHex(accentBright), ";",
    "--ta-signal-deep:", toHex(accentDeep), ";",
    "--ta-signal-rgb:", chan(accent), ";",
    "--ta-signal-bright-rgb:", chan(accentBright), ";",
    "--ta-blue:", toHex(accent2), ";",
    "--ta-blue-rgb:", chan(accent2), ";",
    "--ta-trust:", toHex(accent3), ";",
    "--ta-trust-bright:", toHex(accent3Bright), ";",
    "--ta-trust-rgb:", chan(accent3), ";",
    "--ta-grad:linear-gradient(115deg,", toHex(accentBright), " 0%,", toHex(accent), " 48%,", toHex(accent2), " 100%);",
    "--ta-ink:#06070c;--ta-ok:#22C55E;--ta-warn:#F59E0B;--ta-warn-text:#fcd34d;",
    "--ta-wa:#25D366;--ta-wa-deep:#059669;",
    "--ta-glass:rgba(10,11,18,.82);--ta-border:rgba(255,255,255,.12);",
    "--ta-text:#F4F4F1;--ta-muted:#94A3B8;--ta-faint:rgba(148,163,184,.75);",
    "--ta-surface:#11121a;",
    "--ta-ease:cubic-bezier(.22,1,.36,1);--ta-spring:cubic-bezier(.34,1.4,.64,1);"
  ].join("");

  var state = {
    open: false,
    step: 1,
    income: preset.income,
    expenses: preset.expenses,
    deposit: 10,
    term: 72,
    employment: "permanent",
    name: "",
    phone: "",
    result: null
  };

  function money(n) {
    var s = Math.round(n || 0).toLocaleString(preset.locale);
    return preset.cur + (preset.cur === "R" ? " " : "") + s;
  }

  function calc() {
    var net = Math.max(0, state.income - state.expenses);
    // Conservative vehicle affordability band on disposable income
    var empFactor = { permanent: 1, contract: 0.9, self: 0.82, other: 0.75 }[state.employment] || 0.85;
    var maxInstalment = Math.max(0, net * 0.32 * empFactor);
    var minInstalment = Math.max(0, net * 0.22 * empFactor);
    var r = cfg.rate / 12;
    var n = state.term;
    function principal(instalment) {
      if (r <= 0) return instalment * n;
      return instalment * (1 - Math.pow(1 + r, -n)) / r;
    }
    var loanMax = principal(maxInstalment);
    var loanMin = principal(minInstalment);
    var dep = state.deposit / 100;
    // Vehicle price ≈ loan / (1 - deposit)
    var priceMax = dep < 0.95 ? loanMax / (1 - dep) : loanMax;
    var priceMin = dep < 0.95 ? loanMin / (1 - dep) : loanMin;
    // Soft score band (not a bureau score)
    var ratio = state.income > 0 ? (state.expenses / state.income) : 1;
    var band = "Fair";
    if (net >= preset.strong && ratio <= 0.55 && state.employment === "permanent") band = "Strong";
    else if (net >= preset.good && ratio <= 0.7) band = "Good";
    else if (net < preset.tight) band = "Tight";
    return {
      net: net,
      maxInstalment: maxInstalment,
      minInstalment: minInstalment,
      priceMax: Math.min(priceMax, preset.priceCap),
      priceMin: Math.max(0, priceMin),
      loanMax: loanMax,
      band: band,
      depositAmt: priceMax * dep
    };
  }

  var CSS = [
    /* Isolation boundary. The widget renders inside a shadow root, so host
       page rules cannot reach it at all — not even `button{...!important}`,
       which a plain `all:initial` on a light-DOM container does NOT stop
       (that only resets the container, never its descendants).
       `all:initial` on :host additionally blocks *inherited* properties —
       font, colour, letter-spacing — which do still cross the boundary. */
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
    "border-radius:100px;background:linear-gradient(145deg,rgba(17,18,26,.92),rgba(10,11,18,.96));",
    "border:1px solid rgb(var(--ta-signal-rgb)/.28);color:#fff;",
    "box-shadow:0 12px 36px -10px rgba(0,0,0,.55),0 0 24px -8px rgb(var(--ta-signal-rgb)/.35),inset 0 1px 0 rgba(255,255,255,.1);",
    "backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);",
    "transition:transform .35s var(--ta-spring),box-shadow .35s var(--ta-ease);width:250px;min-height:80px;text-align:left}",
    "#" + ID + "-root .ta-launcher:hover{transform:translateY(-3px) scale(1.02);",
    "box-shadow:0 18px 40px -10px rgb(var(--ta-signal-rgb)/.4),0 0 32px -6px rgb(var(--ta-blue-rgb)/.3),inset 0 1px 0 rgba(255,255,255,.14)}",
    "#" + ID + "-root .ta-launcher:active{transform:scale(.97)}",
    "#" + ID + "-root .ta-ico{",
    "width:40px;height:40px;border-radius:50%;flex-shrink:0;",
    "background:var(--ta-grad);",
    "display:grid;place-items:center;box-shadow:0 6px 18px -4px rgb(var(--ta-signal-rgb)/.55);position:relative}",
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
    "background:var(--ta-grad);",
    "border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}",
    "#" + ID + "-root .ta-head b{display:block;font-size:14px;font-weight:800}",
    "#" + ID + "-root .ta-head span{font-size:11px;opacity:.9}",
    "#" + ID + "-root .ta-x{",
    "margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);",
    "color:#fff;font-size:18px;display:grid;place-items:center;transition:background .2s,transform .25s var(--ta-spring)}",
    "#" + ID + "-root .ta-x:hover{background:rgba(255,255,255,.26);transform:scale(1.05)}",
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
    /* Keyboard focus must stay visible even where the accent is dim against
       the panel — the ring is on top of, not instead of, the border tint. */
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
    "#" + ID + "-root .ta-actions{display:flex;gap:8px;margin-top:6px}",
    "#" + ID + "-root .ta-btn{",
    "flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;",
    "padding:12px 14px;border-radius:12px;font-weight:800;font-size:13px;",
    "transition:transform .3s var(--ta-spring),box-shadow .3s,filter .2s;position:relative;overflow:hidden}",
    "#" + ID + "-root .ta-btn:active{transform:scale(.97)}",
    "#" + ID + "-root .ta-btn-primary{",
    "background:var(--ta-grad);color:#fff;",
    "box-shadow:0 10px 26px -10px rgb(var(--ta-signal-rgb)/.55),inset 0 1px 0 rgba(255,255,255,.2)}",
    "#" + ID + "-root .ta-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px);",
    "box-shadow:0 14px 32px -10px rgb(var(--ta-signal-rgb)/.55),0 0 24px -8px rgb(var(--ta-blue-rgb)/.35)}",
    "#" + ID + "-root .ta-btn-ghost{",
    "background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.14)}",
    "#" + ID + "-root .ta-btn-ghost:hover{background:rgba(255,255,255,.1)}",
    /* WhatsApp green is WhatsApp's, not the dealer's — it stays put so the
       button reads as "this opens WhatsApp" on every site. */
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
    /* Amber is a state, not a brand colour — a tight band reads the same
       whatever the dealer's accent is. */
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
    /* Mobile: collapse the launcher to an icon-only round FAB so several
       widgets can stack on the same side without colliding. The panel goes
       full-bleed (bottom sheet) when opened. */
    "@media (max-width:480px){",
    "@keyframes taShine{0%{transform:translateX(-160%) skewX(-20deg)}55%,100%{transform:translateX(300%) skewX(-20deg)}}",
    "#" + ID + "-root{align-items:" + (cfg.position === "left" ? "flex-start" : "flex-end") + "}",
    "#" + ID + "-root .ta-launcher{width:76px;min-height:76px;height:76px;padding:12px;border-radius:50%;justify-content:center;gap:0;position:relative;overflow:hidden}",
    "#" + ID + "-root .ta-launcher>span:last-child{display:none}",
    "#" + ID + "-root .ta-launcher::after{content:'';position:absolute;top:0;left:0;width:48%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-160%) skewX(-20deg);animation:taShine 3.6s ease-in-out infinite;pointer-events:none;z-index:2}",
    "#" + ID + "-root .ta-panel{width:calc(100vw - 24px);max-width:400px;max-height:min(82vh,680px)}}",
    "@media (prefers-reduced-motion:reduce){#" + ID + "-root *{animation:none!important;transition-duration:.01ms!important}}",
    /* data-text: override primary text colour (launcher + panel). */
    cfg.text ? "#" + ID + "-root{--ta-text:" + cfg.text + "}#" + ID + "-root .ta-launcher,#" + ID + "-root .ta-ltitle,#" + ID + "-root .ta-panel{color:" + cfg.text + "}" : "",
    /* data-scale: resize the launcher, anchored to its corner. */
    cfg.scale ? "#" + ID + "-root .ta-launcher{transform:scale(" + cfg.scale + ");transform-origin:bottom " + cfg.position + "}" : "",
    ":host(.ta-inline){position:static!important;inset:auto!important;bottom:auto!important;left:auto!important;right:auto!important;max-width:100%!important;width:100%!important;pointer-events:auto!important;display:block!important}",
    "#" + ID + "-root.ta-inline{align-items:stretch!important;pointer-events:auto!important;width:100%}",
    "#" + ID + "-root.ta-inline .ta-launcher{display:none!important}",
    "#" + ID + "-root.ta-inline .ta-x{display:none!important}",
    "#" + ID + "-root.ta-inline .ta-panel{position:static!important;display:flex!important;opacity:1!important;transform:none!important;width:100%!important;max-width:100%!important;max-height:none!important;box-shadow:0 20px 50px -30px rgba(0,0,0,.45)!important}"
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

  /* Every lookup below goes through these, never through `document`. A stray
     document.getElementById would silently return null once the widget moved
     into the shadow root. */
  var shadow = null;
  function $(sel) { return shadow ? shadow.querySelector(sel) : null; }
  function $$(sel) { return shadow ? Array.prototype.slice.call(shadow.querySelectorAll(sel)) : []; }

  function mount() {
    var hostEl = document.createElement("div");
    hostEl.id = ID + "-host";
    
    function waitForTarget(selector, cb, timeout) {
      timeout = timeout || 5000;
      var el = document.querySelector(selector);
      if (el) { cb(el); return; }
      var obs = new MutationObserver(function() {
        el = document.querySelector(selector);
        if (el) { obs.disconnect(); cb(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function() { obs.disconnect(); }, timeout);
    }
    
    var mountSelector = cfg.mount || cfg.target || '';
    if (mountSelector) {
      hostEl.className = "ta-inline";
      waitForTarget(mountSelector, function(target) {
        target.appendChild(hostEl);
        root.classList.add("ta-inline", "is-open");
        state.open = true;
      });
    } else {
      document.body.appendChild(hostEl);
    }
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
              '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3.5"/></svg>' +
            "</div>" +
            "<div><b>Check Affordability</b><span>" + esc(cfg.dealer) + " · Soft pre-qual</span></div>" +
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
            '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>' +
          "</span>" +
          "<span>" +
            '<span class="ta-ltitle">Check Affordability</span>' +
            '<span class="ta-lsub">What you qualify for in ~60s. No hard credit check.</span>' +
            '<span class="ta-badge">TruAfford · Soft</span>' +
          "</span>" +
        "</button>" +
      "</div>"
    );
    shadow.appendChild(root);

    if (inline) { root.classList.add("ta-inline", "is-open"); state.open = true; }

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
        '<div class="ta-h">Know your budget before you fall in love with a car.</div>' +
        '<p class="ta-p">A soft affordability estimate for ' + esc(cfg.dealer) + " — no hard bureau pull, no score damage claim. Instant range, then WhatsApp the team.</p>" +
        '<div class="ta-soft">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        "<div><b>Soft pre-qual only.</b> This is not a credit application and not a formal quote. Banks make the final call.</div>" +
        "</div>" +
        '<div class="ta-actions"><button type="button" class="ta-btn ta-btn-primary" data-go="2">Start check →</button></div>' +
        "</div>";
    } else if (state.step === 2) {
      html =
        '<div class="ta-view on">' +
        '<div class="ta-h">Your monthly numbers</div>' +
        '<p class="ta-p">We’ll estimate instalment and vehicle price bands from disposable income.</p>' +
        '<div class="ta-field"><div class="ta-row"><label>Net monthly income</label><output id="o-inc">' + money(state.income) + "</output></div>" +
        '<input type="range" id="r-inc" min="' + preset.incomeMin + '" max="' + preset.incomeMax + '" step="' + preset.incomeStep + '" value="' + state.income + '"></div>' +
        '<div class="ta-field"><div class="ta-row"><label>Monthly expenses</label><output id="o-exp">' + money(state.expenses) + "</output></div>" +
        '<input type="range" id="r-exp" min="' + preset.expensesMin + '" max="' + preset.expensesMax + '" step="' + preset.expensesStep + '" value="' + state.expenses + '"></div>' +
        '<div class="ta-grid2">' +
        '<div class="ta-field"><div class="ta-row"><label>Deposit</label><output id="o-dep">' + state.deposit + "%</output></div>" +
        '<input type="range" id="r-dep" min="0" max="40" step="5" value="' + state.deposit + '"></div>' +
        '<div class="ta-field"><div class="ta-row"><label>Term</label><output id="o-term">' + state.term + " mo</output></div>" +
        '<input type="range" id="r-term" min="12" max="96" step="12" value="' + state.term + '"></div>' +
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
      html =
        '<div class="ta-view on">' +
        '<div class="ta-result">' +
        '<div class="ta-band' + bandClass + '">Soft band · ' + r.band + "</div>" +
        '<div style="font-size:11px;color:var(--ta-muted);font-weight:700">Estimated vehicle budget</div>' +
        '<div class="ta-big">' + money(r.priceMin) + " – " + money(r.priceMax) + "</div>" +
        '<div class="ta-range">Indicative range at ~' + (cfg.rate * 100).toFixed(2) + "% over " + state.term + " months · " + state.deposit + "% deposit</div>" +
        '<div class="ta-metrics">' +
        '<div class="ta-metric"><div class="k">Monthly from</div><div class="v">' + money(r.minInstalment) + "</div></div>" +
        '<div class="ta-metric"><div class="k">Monthly up to</div><div class="v">' + money(r.maxInstalment) + "</div></div>" +
        '<div class="ta-metric"><div class="k">Disposable</div><div class="v">' + money(r.net) + "</div></div>" +
        '<div class="ta-metric"><div class="k">Deposit ≈</div><div class="v">' + money(r.depositAmt) + "</div></div>" +
        "</div></div>" +
        '<div class="ta-field"><label>Your name</label><input type="text" id="ta-name" placeholder="Full name" value="' + esc(state.name) + '" autocomplete="name"></div>' +
        '<div class="ta-field"><label>Mobile</label><input type="tel" id="ta-phone" placeholder="Phone number" value="' + esc(state.phone) + '" autocomplete="tel"></div>' +
        '<div class="ta-actions">' +
        '<button type="button" class="ta-btn ta-btn-ghost" data-go="3">Back</button>' +
        '<button type="button" class="ta-btn ta-btn-wa" id="ta-wa">WhatsApp result</button>' +
        "</div>" +
        '<p class="ta-fine">Estimate only. Final rate, term and approval subject to bank / lender credit assessment. ' +
        esc(cfg.dealer) + " and TruSaaS are not offering credit by this tool alone. Illustrative rate " +
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
          $("#o-term").textContent = state.term + " mo";
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
        var msg = [
          "Hi " + cfg.dealer + " — TruAfford soft estimate",
          "Name: " + (state.name || "—"),
          "Phone: " + (state.phone || "—"),
          "Net income: " + money(state.income),
          "Expenses: " + money(state.expenses),
          "Deposit: " + state.deposit + "% · Term: " + state.term + " months",
          "Employment: " + state.employment,
          "Soft band: " + r.band,
          "Budget range: " + money(r.priceMin) + " – " + money(r.priceMax),
          "Instalment band: " + money(r.minInstalment) + " – " + money(r.maxInstalment) + "/pm",
          "(Soft estimate only — not a credit application)"
        ].join("\n");
        /* CallMeBot rides a plaintext GET through a third-party relay, so send
           only the OUTCOME the dealer needs to follow up (name, phone, band,
           budget range) — never the raw income/expenses inputs. The webhook
           below still gets the full breakdown; that's the dealer's own endpoint. */
        cmbNotify(cfg, "TruAfford", [
          "Name: " + (state.name || "—"),
          "Phone: " + (state.phone || "—"),
          "Soft band: " + r.band,
          "Budget range: " + money(r.priceMin) + " – " + money(r.priceMax)
        ].join("\n"));
        /* Capture the lead FIRST — the WhatsApp redirect below is a bonus, not
           a gate. A webhook-only dealer (data-webhook, no data-wa) must still
           land the lead, so this block stays above the `!cfg.wa` return. */
        if (cfg.webhook || (cfg.slug && cfg.flowUrl)) {
          var names = (state.name || "").trim().split(/\s+/);
          var leadUrl = cfg.webhook || (cfg.flowUrl.replace(/\/$/, "") + "/api/integration/webhook-lead");
          var payload = {
            dealerSlug: cfg.slug,
            firstName: names[0] || "TruAfford",
            lastName: names.slice(1).join(" ") || "Lead",
            phone: state.phone || "",
            email: "",
            source: "TruAfford Widget",
            notes: msg
          };
          try {
            fetch(leadUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              mode: "cors",
              keepalive: true
            }).catch(function () {});
          } catch (e) {}
          try { window.dispatchEvent(new CustomEvent('tru:lead', { detail: { product: 'tru-afford', dealer: cfg.slug || '', data: payload } })); } catch(e) {}
        }
        if (!cfg.wa) return;
        window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
      });
    }
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
