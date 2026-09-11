/**
 * TruRepay — embeddable, dealer-branded finance (repayment) calculator (TruSaaS)
 *
 * CANONICAL SOURCE. Per-dealer copies under case-sites/ are deploy
 * artefacts — fix bugs here, then re-copy.
 *
 * A repayment calculator that also GENERATES A LEAD: the shopper works out an
 * instalment (price / deposit / term / balloon / rate), taps "Get this deal",
 * leaves a name + phone, and the full calculation is filed into TruFlow via
 * /api/integration/webhook-lead — with an optional WhatsApp send. Same family
 * as tru-afford.js / tru-form.js: shadow-root isolation, single-colour
 * theming, honest send confirmation.
 *
 * Drop-in (on-page / inline):
 *   <div id="finance-calc"></div>
 *   <script src="tru-repay.js"
 *           data-dealer="True Cars"
 *           data-slug="true-cars"
 *           data-flow="https://premium.tru-saas.com"
 *           data-wa="27620502091"
 *           data-accent="#1466E0"
 *           data-mode="inline"
 *           data-target="#finance-calc"
 *           data-price="459900"
 *           data-vehicle="2023 Toyota Fortuner 2.8 GD-6"></script>
 *
 * Attributes:
 *   data-dealer      Dealer name (header, WhatsApp, lead)
 *   data-slug        Dealership slug — REQUIRED to file a CRM lead
 *   data-flow        TruFlow origin — REQUIRED to file a CRM lead
 *   data-wa          WhatsApp number, digits only (enables WhatsApp send)
 *   data-accent      Brand colour; everything derives from it
 *   data-accent-2    Far gradient end (default: accent darkened)
 *   data-mode        "inline" (default) renders into data-target | "float" FAB
 *   data-target      CSS selector for inline mount (falls back to a body div)
 *   data-position    "right" (default) | "left"  (float mode)
 *   data-heading     Panel heading (default "Finance Calculator")
 *   data-subheading  Subline (default "Work out your monthly instalment")
 *   data-price       Starting vehicle price (editable)
 *   data-vehicle     Vehicle name — carried into the lead / WhatsApp message
 *   data-rate        Default interest rate % (default 11.75)
 *   data-deposit     Default deposit % (default 10)
 *   data-term        Default term months (default 72)
 *   data-balloon     Default balloon % (default 0)
 *   data-init-fee    Initiation fee shown in the disclaimer (default 1207)
 *   data-admin-fee   Monthly admin fee shown in the disclaimer (default 69)
 *   data-currency    Currency symbol (default "R")
 *   data-market      "za" (default) | "uk" | "us" — sets the number locale;
 *                    uk/us also zero-default the fees unless set explicitly
 *   data-locale      Explicit locale tag overriding the data-market locale
 *   data-brand       Footer credit (default "TruRepay · TruSaaS")
 *   data-z           z-index (default 999975)
 *
 * Programmatic control (last-mounted instance; all in window.TruRepay.instances):
 *   window.TruRepay.open();  window.TruRepay.close();
 *
 * COMPLIANCE — do not weaken. The result is an ESTIMATE. The disclaimer must
 * stay in the output body and keep stating it is indicative only, excludes fees,
 * and is not a quote, credit approval, or an offer of finance. The final rate is
 * risk-based and set by the bank.
 */
(function () {
  "use strict";

  var scr = document.currentScript || document.querySelector("script[src*='tru-repay']");
  function attr(name, fallback) { return (scr && scr.getAttribute(name)) || fallback; }
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
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }

  var MARKET_LOCALE = { za: "en-ZA", uk: "en-GB", us: "en-US" };
  var market = attr("data-market", "za");
  var foreignMarket = market === "uk" || market === "us";

  var cfg = {
    dealer: attr("data-dealer", "this dealership"),
    slug: attr("data-slug", ""),
    flowUrl: attr("data-flow", ""),
    webhook: attr("data-webhook", ""),
    cmbKey: attr("data-callmebot-key", ""),
    cmbPhone: ((attr("data-callmebot-phone", "") || attr("data-wa", "")) || "").replace(/\D/g, ""),
    wa: (attr("data-wa", "") || "").replace(/\D/g, ""),
    accent: attr("data-accent", "#1466E0"),
    accent2: attr("data-accent-2", ""),
    text: attr("data-text", ""),   // override primary text colour
    scale: attr("data-scale", ""), // launcher size multiplier
    mode: attr("data-mode", "inline"),
    target: attr("data-target", "") || attr("data-mount", ""),
    position: attr("data-position", "right"),
    offsetBottom: attr("data-bottom", "24px"),
    vertical: (attr("data-vertical", "") || "").toLowerCase(),
    heading: attr("data-heading", (attr("data-vertical", "") || "").toLowerCase() === "moto" ? "Motorcycle Finance Calculator" : "Finance Calculator"),
    subheading: attr("data-subheading", "Work out your monthly instalment"),
    price: num(attr("data-price", ""), 0),
    vehicle: attr("data-vehicle", ""),
    rate: num(attr("data-rate", ""), 11.75),
    deposit: num(attr("data-deposit", ""), 10),
    term: num(attr("data-term", ""), 72),
    balloon: num(attr("data-balloon", ""), 0),
    initFee: num(attr("data-init-fee", ""), ((scr && scr.hasAttribute("data-init-fee")) || !foreignMarket) ? 1207 : 0),
    adminFee: num(attr("data-admin-fee", ""), ((scr && scr.hasAttribute("data-admin-fee")) || !foreignMarket) ? 69 : 0),
    cur: attr("data-currency", "R"),
    market: market,
    locale: attr("data-locale", "") || MARKET_LOCALE[market] || "en-ZA",
    brand: attr("data-brand", "TruDealer"),
    theme: attr("data-theme", "dark"),
    z: attr("data-z", "2147200000")
  };

  window.__truRepayCount = (window.__truRepayCount || 0) + 1;
  var INSTANCE = window.__truRepayCount;
  var ID = "tru-repay-" + INSTANCE;
  var isInline = cfg.mode !== "float";
  var isCollapsible = isInline && attr("data-collapsible", "") === "1";

  /* ---- colour helpers ---- */
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
  function mix(rgb, t, a) { return rgb.map(function (v, i) { return v + (t[i] - v) * a; }); }
  var WHITE = [255, 255, 255], BLACK = [0, 0, 0];
  function lighten(rgb, a) { return mix(rgb, WHITE, a); }
  function darken(rgb, a) { return mix(rgb, BLACK, a); }
  function chan(rgb) { return rgb.map(Math.round).join(" "); }

  var accent = parseHex(cfg.accent) || parseHex("#1466E0");
  var accentBright = lighten(accent, 0.34);
  var accentDeep = darken(accent, 0.34);
  var accent2 = parseHex(cfg.accent2) || accentDeep;

  var VARS = [
    "--tr-signal:", toHex(accent), ";",
    "--tr-signal-bright:", toHex(accentBright), ";",
    "--tr-signal-deep:", toHex(accentDeep), ";",
    "--tr-signal-rgb:", chan(accent), ";",
    "--tr-blue:", toHex(accent2), ";",
    "--tr-blue-rgb:", chan(accent2), ";",
    "--tr-grad:linear-gradient(135deg,", toHex(accentBright), " 0%,", toHex(accent), " 50%,", toHex(accent2), " 100%);",
    "--tr-wa:#8C3D12;--tr-wa-deep:#B85B24;",
    "--tr-glass:rgba(18,24,36,.92);--tr-border:rgba(184,91,36,.32);",
    "--tr-text:#FAF5EE;--tr-muted:#A8A29E;--tr-faint:rgba(250,245,238,.45);--tr-surface:#0D131C;--tr-err:#f87171;",
    "--tr-ease:cubic-bezier(.16,1,.3,1);--tr-spring:cubic-bezier(.34,1.4,.64,1);",
    "--tr-fill:rgba(255,255,255,.05);--tr-fill-2:rgba(255,255,255,.09);",
    "--tr-hair:rgba(184,91,36,.2);--tr-edge:rgba(184,91,36,.35);--tr-thumb:#FAF5EE;",
    /* light/glass palette fallback */
    cfg.theme === "light" ? [
      "--tr-glass:rgba(255,255,255,.94);--tr-border:rgba(184,91,36,.22);",
      "--tr-text:#1C1917;--tr-muted:#57534E;--tr-faint:rgba(28,25,23,.42);",
      "--tr-surface:#FAF5EE;--tr-err:#B91C1C;",
      "--tr-fill:rgba(184,91,36,.04);--tr-fill-2:rgba(184,91,36,.08);",
      "--tr-hair:rgba(184,91,36,.14);--tr-edge:rgba(184,91,36,.24);",
      "--tr-thumb:var(--tr-signal);",
      "--tr-toggle-bg:linear-gradient(135deg,rgba(255,255,255,.95),rgba(250,245,238,.90));--tr-head-bg:var(--tr-grad);--tr-head-fg:#fff;"
    ].join("") : "--tr-toggle-bg:linear-gradient(135deg,rgba(24,30,44,.92) 0%,rgba(13,19,28,.97) 100%);--tr-head-bg:var(--tr-grad);--tr-head-fg:#fff;"
  ].join("");

  /* ---- CSS ---- */
  var CSS = [
    ":host{all:initial;", VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    isInline ? "display:block;width:100%;" : [
      "position:fixed;z-index:" + cfg.z + ";bottom:" + cfg.offsetBottom + ";",
      cfg.position === "left" ? "left:16px;right:auto;" : "right:16px;left:auto;",
      "display:block;max-width:min(460px,calc(100vw - 24px));pointer-events:none"
    ].join(""), "}",
    "#tr{", VARS, "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    isInline ? "display:block;" : "display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none;", "}",
    "#tr *,#tr *::before,#tr *::after{box-sizing:border-box}",
    "#tr button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}",
    ".tr-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}",

    /* launcher (float) */
    ".tr-launcher{pointer-events:auto;display:flex;align-items:center;gap:12px;padding:10px 18px 10px 12px;",
      "width:250px;min-height:80px;text-align:left;position:relative;overflow:hidden;",
      "border-radius:100px;background:linear-gradient(145deg,rgba(24,30,42,.88),rgba(13,19,28,.94));",
      "border:1px solid rgb(var(--tr-signal-rgb)/.35);color:#fff;",
      "box-shadow:0 14px 36px -10px rgba(0,0,0,.65),0 0 24px -6px rgb(var(--tr-signal-rgb)/.32),inset 0 1px 0 rgba(255,255,255,.14);",
      "backdrop-filter:blur(22px) saturate(1.7);-webkit-backdrop-filter:blur(22px) saturate(1.7);",
      "transition:transform .35s var(--tr-spring),box-shadow .35s var(--tr-ease),border-color .25s}",
    ".tr-launcher::after{content:'';position:absolute;top:0;left:0;width:45%;height:100%;",
      "background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),rgba(255,255,255,.18),rgba(255,255,255,.06),transparent);",
      "transform:translateX(-160%) skewX(-20deg);animation:trFloatShine 5s ease-in-out infinite;pointer-events:none}",
    "@keyframes trFloatShine{0%,35%{transform:translateX(-160%) skewX(-20deg)}65%,100%{transform:translateX(320%) skewX(-20deg)}}",
    ".tr-launcher:hover{transform:translateY(-4px) scale(1.02);border-color:rgb(var(--tr-signal-rgb)/.65);",
      "box-shadow:0 20px 46px -10px rgba(0,0,0,.75),0 0 32px -4px rgb(var(--tr-signal-rgb)/.45),inset 0 1px 0 rgba(255,255,255,.22)}",
    ".tr-launcher:active{transform:scale(.97)}",
    ".tr-ico{width:42px;height:42px;border-radius:50%;flex-shrink:0;background:var(--tr-grad);",
      "display:grid;place-items:center;box-shadow:0 6px 18px -4px rgb(var(--tr-signal-rgb)/.6);position:relative;z-index:1}",
    ".tr-ico::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid rgb(var(--tr-signal-rgb)/.45);animation:trPulse 2.4s ease-out infinite}",
    "@keyframes trPulse{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.45);opacity:0}}",
    ".tr-ico svg{width:20px;height:20px}",
    ".tr-ltitle{display:block;font-size:13px;font-weight:700;color:#fff;line-height:1.2;position:relative;z-index:1}",
    ".tr-lsub{display:block;font-size:10px;color:var(--tr-muted);margin-top:2px;position:relative;z-index:1}",
    "#tr.is-open .tr-launcher{display:none}",

    /* collapsible inline toggle */
    isCollapsible ? [
      ".tr-toggle{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;width:100%;padding:18px 22px;",
      "background:var(--tr-toggle-bg);backdrop-filter:blur(24px) saturate(1.8);-webkit-backdrop-filter:blur(24px) saturate(1.8);",
      "border:1px solid var(--tr-border);border-radius:18px;color:var(--tr-text);cursor:pointer;",
      "box-shadow:0 12px 32px -8px rgba(0,0,0,.55),0 0 20px -6px rgb(var(--tr-signal-rgb)/.25),inset 0 1px 0 rgba(255,255,255,.12);",
      "transition:transform .35s var(--tr-spring),box-shadow .35s var(--tr-ease),border-color .25s,border-radius .25s var(--tr-ease)}",
      ".tr-toggle::after{content:'';position:absolute;top:0;left:0;width:45%;height:100%;",
      "background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),rgba(255,255,255,.16),rgba(255,255,255,.05),transparent);",
      "transform:translateX(-160%) skewX(-20deg);animation:trToggleShine 5.5s ease-in-out infinite;pointer-events:none}",
      "@keyframes trToggleShine{0%,35%{transform:translateX(-160%) skewX(-20deg)}65%,100%{transform:translateX(320%) skewX(-20deg)}}",
      ".tr-toggle:hover{transform:translateY(-3px) scale(1.008);border-color:rgb(var(--tr-signal-rgb)/.6);",
      "box-shadow:0 18px 44px -10px rgba(0,0,0,.68),0 0 30px -4px rgb(var(--tr-signal-rgb)/.4),inset 0 1px 0 rgba(255,255,255,.2)}",
      ".tr-toggle:active{transform:scale(.985)}",
      ".tr-toggle-ico{width:48px;height:48px;border-radius:14px;flex-shrink:0;position:relative;z-index:1;",
      "background:var(--tr-grad);display:grid;place-items:center;box-shadow:0 6px 18px -4px rgb(var(--tr-signal-rgb)/.55)}",
      ".tr-toggle-ico::after{content:'';position:absolute;inset:-3px;border-radius:17px;border:1.5px solid rgb(var(--tr-signal-rgb)/.45);animation:trPulse 2.4s ease-out infinite}",
      ".tr-toggle-ico svg{width:22px;height:22px}",
      ".tr-toggle-title{font-size:15px;font-weight:800;letter-spacing:-.01em;text-align:left;flex:1;color:var(--tr-text);line-height:1.25;position:relative;z-index:1}",
      ".tr-toggle-sub{display:block;font-size:11.5px;font-weight:400;color:var(--tr-muted);margin-top:3px;letter-spacing:0}",
      ".tr-toggle-badge{display:inline-block;padding:2px 8px;border-radius:6px;background:rgb(var(--tr-signal-rgb)/.15);border:1px solid rgb(var(--tr-signal-rgb)/.35);color:var(--tr-signal-bright);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-left:8px;vertical-align:middle}",
      ".tr-toggle-chevron{margin-left:auto;width:34px;height:34px;border-radius:10px;background:var(--tr-fill);border:1px solid var(--tr-hair);display:grid;place-items:center;transition:transform .35s var(--tr-spring),background .2s;position:relative;z-index:1}",
      ".tr-toggle-chevron svg{width:18px;height:18px}",
      "#tr.is-open .tr-toggle{border-radius:18px 18px 0 0;border-bottom-color:transparent;",
      "box-shadow:0 4px 16px -8px rgba(0,0,0,.4)}",
      "#tr.is-open .tr-toggle-chevron{transform:rotate(180deg);background:var(--tr-fill-2)}",
      "#tr.is-open .tr-toggle:hover{transform:none}"
    ].join("") : "",

    /* panel */
    ".tr-panel{pointer-events:auto;background:var(--tr-glass);color:var(--tr-text);",
    "border:1px solid var(--tr-border);", isCollapsible ? "border-top:0;" : "",
    "border-radius:", isCollapsible ? "0 0 20px 20px" : "20px", ";overflow:hidden;",
    "box-shadow:0 28px 70px -20px rgba(0,0,0,.65),0 0 40px -16px rgb(var(--tr-signal-rgb)/.25),inset 0 1px 0 rgba(255,255,255,.1);",
    "backdrop-filter:blur(28px) saturate(1.8);-webkit-backdrop-filter:blur(28px) saturate(1.8);",
    isInline && !isCollapsible ? "display:flex;flex-direction:column;width:100%;" :
    isCollapsible ? "display:none;flex-direction:column;width:100%;" :
    [
      "display:none;flex-direction:column;width:min(440px,calc(100vw - 24px));max-height:min(86vh,760px);",
      "opacity:0;transform:translateY(16px) scale(.96);transition:opacity .35s var(--tr-ease),transform .4s var(--tr-spring)"
    ].join(""), "}",
    (isInline && !isCollapsible)
      ? ""
      : "#tr.is-open .tr-panel{display:flex;" + (isCollapsible ? "" : "opacity:1;transform:none") + "}",
    "@supports (backdrop-filter: blur(1px)) {.tr-panel{backdrop-filter:blur(28px) saturate(1.8);-webkit-backdrop-filter:blur(28px) saturate(1.8)}}",

    /* header */
    ".tr-head{padding:18px 18px 14px;display:flex;align-items:center;gap:12px;background:var(--tr-head-bg);color:var(--tr-head-fg);position:relative;overflow:hidden;flex-shrink:0;border-bottom:1px solid var(--tr-hair)}",
    ".tr-head::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.14) 50%,transparent 70%);transform:translateX(-120%);animation:trHeadShine 4s ease-in-out infinite;pointer-events:none}",
    "@keyframes trHeadShine{0%,100%{transform:translateX(-120%)}50%{transform:translateX(120%)}}",
    ".tr-head-icon{width:42px;height:42px;border-radius:14px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.25);display:grid;place-items:center;flex-shrink:0;position:relative;z-index:1}",
    ".tr-head-icon svg{width:22px;height:22px}",
    ".tr-head b{display:block;font-size:16px;font-weight:800;color:var(--tr-head-fg);position:relative;z-index:1}",
    ".tr-head span{display:block;font-size:11.5px;opacity:.85;margin-top:2px;color:var(--tr-head-fg);position:relative;z-index:1}",
    ".tr-x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);color:var(--tr-head-fg);font-size:18px;display:grid;place-items:center;transition:background .2s,transform .2s;position:relative;z-index:1}",
    ".tr-x:hover{background:rgba(255,255,255,.28);transform:scale(1.05)}",

    ".tr-body{padding:18px;overflow-y:auto;flex:1;min-height:0}",

    /* result card */
    ".tr-result{background:radial-gradient(circle at top right,rgb(var(--tr-signal-rgb)/.16),transparent 65%),rgba(255,255,255,.03);",
    "border:1px solid var(--tr-border);border-radius:16px;padding:18px;margin-bottom:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}",
    ".tr-result-lbl{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--tr-muted)}",
    ".tr-amt{font-size:36px;font-weight:800;line-height:1.05;margin:6px 0 14px;letter-spacing:-.02em;color:var(--tr-text);text-shadow:0 0 24px rgb(var(--tr-signal-rgb)/.3)}",
    ".tr-amt small{font-size:15px;font-weight:600;color:var(--tr-muted);margin-left:2px}",
    ".tr-rb{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-top:1px solid var(--tr-hair)}",
    ".tr-rb span{color:var(--tr-muted)}.tr-rb b{font-weight:700;color:var(--tr-text)}",
    ".tr-note{font-size:10.5px;color:var(--tr-muted);line-height:1.5;margin-top:10px}",

    /* controls */
    ".tr-field{margin-bottom:16px}",
    ".tr-field>label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--tr-muted);margin:0 0 6px}",
    ".tr-price{display:flex;align-items:center;gap:8px;border:1.5px solid var(--tr-edge);background:var(--tr-fill);border-radius:12px;padding:10px 14px;transition:border-color .2s,box-shadow .2s}",
    ".tr-price:focus-within{border-color:rgb(var(--tr-signal-rgb)/.7);box-shadow:0 0 0 3px rgb(var(--tr-signal-rgb)/.2)}",
    ".tr-price span{font-weight:800;color:var(--tr-signal-bright)}",
    ".tr-price input{flex:1;border:none;background:none;color:var(--tr-text);font:800 18px Inter,system-ui,sans-serif;outline:none;width:100%}",
    ".tr-range .top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}",
    ".tr-range .top label{font-size:11.5px;font-weight:700;color:var(--tr-muted);text-transform:none;letter-spacing:0}",
    ".tr-range .top b{font-size:13px;font-weight:800;color:var(--tr-signal-bright);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}",
    "input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:100px;",
    "background:linear-gradient(90deg,var(--tr-signal) var(--fill, 50%),var(--tr-fill-2) var(--fill, 50%));outline:none;margin:8px 0;cursor:pointer}",
    "input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--tr-thumb);",
    "border:3px solid var(--tr-signal);box-shadow:0 2px 10px rgba(0,0,0,.5),0 0 12px rgb(var(--tr-signal-rgb)/.5);cursor:pointer;transition:transform .2s var(--tr-spring),box-shadow .2s}",
    "input[type=range]:hover::-webkit-slider-thumb{transform:scale(1.18);box-shadow:0 2px 14px rgba(0,0,0,.6),0 0 18px rgb(var(--tr-signal-rgb)/.85)}",
    "input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--tr-thumb);border:3px solid var(--tr-signal);cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5),0 0 12px rgb(var(--tr-signal-rgb)/.5);transition:transform .2s var(--tr-spring)}",
    ".tr-ticks{display:flex;justify-content:space-between;font-size:9.5px;color:var(--tr-muted);margin-top:-2px}",

    /* capture (revealed by CTA) */
    ".tr-capture{display:none;margin-top:6px;padding-top:14px;border-top:1px solid var(--tr-hair);animation:trIn .35s var(--tr-ease) both}",
    "#tr.is-capturing .tr-capture{display:block}",
    "#tr.is-capturing .tr-cta-row{display:none}",
    ".tr-cap-title{font-size:12px;font-weight:800;margin-bottom:10px}",
    ".tr-inp{width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid var(--tr-edge);",
    "background:var(--tr-fill);color:var(--tr-text);font:600 14px Inter,system-ui,sans-serif;outline:none;margin-bottom:10px;transition:border-color .2s,box-shadow .2s}",
    ".tr-inp::placeholder{color:var(--tr-faint, rgba(176,184,196,.45))}",
    ".tr-inp:focus{border-color:rgb(var(--tr-signal-rgb)/.7);box-shadow:0 0 0 3px rgb(var(--tr-signal-rgb)/.22)}",
    ".tr-inp.tr-bad{border-color:rgba(239,68,68,.6);box-shadow:0 0 0 3px rgba(239,68,68,.15)}",
    ".tr-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
    "@media(max-width:400px){.tr-row2{grid-template-columns:1fr}}",

    /* buttons */
    ".tr-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}",
    ".tr-btn{flex:1 1 auto;min-width:130px;display:inline-flex;align-items:center;justify-content:center;gap:8px;",
    "padding:14px 18px;border-radius:14px;font-weight:800;font-size:13.5px;transition:transform .3s var(--tr-spring),box-shadow .25s,filter .2s}",
    ".tr-btn:active{transform:scale(.97)}",
    ".tr-btn-primary{background:var(--tr-grad);color:#fff;box-shadow:0 10px 28px -8px rgb(var(--tr-signal-rgb)/.65),inset 0 1px 0 rgba(255,255,255,.25)}",
    ".tr-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 14px 34px -8px rgb(var(--tr-signal-rgb)/.8),inset 0 1px 0 rgba(255,255,255,.35)}",
    ".tr-btn-primary:disabled{opacity:.55;pointer-events:none}",
    ".tr-btn-wa{background:linear-gradient(145deg,var(--tr-wa),var(--tr-wa-deep));color:#fff;box-shadow:0 10px 24px -8px rgba(140,61,18,.5)}",
    ".tr-btn-wa:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 14px 30px -8px rgba(184,91,36,.65)}",
    ".tr-btn-wa:disabled{opacity:.55;pointer-events:none}",
    ".tr-btn-ghost{background:var(--tr-fill);color:var(--tr-text);border:1px solid var(--tr-edge)}",
    ".tr-btn-ghost:hover{background:var(--tr-fill-2);border-color:rgb(var(--tr-signal-rgb)/.45)}",
    ".tr-btn-sm{flex:0 0 auto;min-width:0;padding:10px 14px;font-size:12px}",
    ".tr-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:trSpin .7s linear infinite;display:inline-block}",
    "@keyframes trSpin{to{transform:rotate(360deg)}}",
    "@keyframes trIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",

    /* success / error */
    ".tr-success,.tr-error{display:none;text-align:center;padding:30px 16px}",
    "#tr.is-sent .tr-body{display:none}#tr.is-sent .tr-success{display:block;animation:trIn .5s var(--tr-ease) both}",
    "#tr.is-error .tr-body{display:none}#tr.is-error .tr-error{display:block;animation:trIn .5s var(--tr-ease) both}",
    ".tr-badge{width:60px;height:60px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center}",
    ".tr-badge.ok{background:rgba(52,211,153,.14);border:2px solid rgba(52,211,153,.4)}",
    ".tr-badge.err{background:rgba(248,113,113,.14);border:2px solid rgba(248,113,113,.4)}",
    ".tr-badge svg{width:30px;height:30px;stroke-width:2.5;fill:none}",
    ".tr-badge.ok svg{stroke:#34d399}.tr-badge.err svg{stroke:var(--tr-err)}",
    ".tr-done-title{font-size:18px;font-weight:800;margin-bottom:6px}",
    ".tr-done-sub{font-size:13px;color:var(--tr-muted);margin-bottom:18px;line-height:1.5}",

    ".tr-foot{padding:8px 14px 10px;border-top:1px solid var(--tr-hair);flex-shrink:0;font-size:9.5px;color:var(--tr-muted);text-align:center}",
    ".tr-foot b{color:var(--tr-signal-bright);font-weight:700}",

    isInline ? "" : "@media(max-width:480px){@keyframes trShine{0%{transform:translateX(-160%) skewX(-20deg)}55%,100%{transform:translateX(300%) skewX(-20deg)}}.tr-launcher{width:76px;min-height:76px;height:76px;padding:12px;border-radius:50%;justify-content:center;gap:0;position:relative;overflow:hidden}.tr-launcher>div:last-child{display:none}.tr-launcher::after{content:'';position:absolute;top:0;left:0;width:48%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-160%) skewX(-20deg);animation:trShine 3.6s ease-in-out infinite;pointer-events:none;z-index:2}#tr{align-items:" + (cfg.position === "left" ? "flex-start" : "flex-end") + "}.tr-panel{width:100%}}",
    "@media(prefers-reduced-motion:reduce){#tr *{animation:none!important;transition-duration:.01ms!important}}",
    "#tr button:focus-visible,#tr input:focus-visible{outline:2px solid var(--tr-signal-bright);outline-offset:2px}",
    /* data-text: override primary text colour. */
    cfg.text ? "#tr{--tr-text:" + cfg.text + "}#tr .tr-launcher,#tr .tr-ltitle,#tr .tr-panel{color:" + cfg.text + "}" : "",
    /* data-scale: resize the float launcher, anchored to its corner. */
    (cfg.scale && !isInline) ? "#tr .tr-launcher{transform:scale(" + cfg.scale + ");transform-origin:bottom " + cfg.position + "}" : ""
  ].join("");

  /* ---- icons ---- */
  var calcSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M8 14h2M8 18h2M14 10h2v8h-2z"/></svg>';
  var okSvg = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  var errSvg = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  var waSvg = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.68.15s-.78.97-.96 1.17c-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.44-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.63-.93-2.23-.24-.59-.49-.5-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.06 1.04-1.06 2.53s1.09 2.94 1.24 3.14c.15.2 2.14 3.27 5.18 4.58.72.31 1.29.5 1.73.64.73.23 1.39.2 1.91.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35z"/></svg>';

  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var shadow = null;
  var mountedAt = Date.now();

  /* ---- finance maths (balloon PMT — matches the flagship finance.html) ---- */
  function pmt(principal, annualRate, term, balloonAmt) {
    if (!(principal > 0) || !(term > 0)) return 0;
    var r = annualRate / 100 / 12;
    if (r <= 0) return (principal - balloonAmt) / term;           // 0% guard
    var pv = principal - balloonAmt / Math.pow(1 + r, term);
    return pv * r / (1 - Math.pow(1 + r, -term));
  }

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
    
    var mountSelector = cfg.target || cfg.mount || '';
    if (isInline && mountSelector) {
      waitForTarget(mountSelector, function(target) {
        target.appendChild(hostEl);
      });
    } else {
      document.body.appendChild(hostEl);
    }
    shadow = hostEl.attachShadow({ mode: "open" });
    var style = document.createElement("style"); style.textContent = CSS; shadow.appendChild(style);

    var waActions = cfg.wa
      ? '<button type="button" class="tr-btn tr-btn-wa" id="tr-cap-wa">' + waSvg + ' WhatsApp</button>'
      : '';

    var html = [
      '<div id="tr"', (isInline && !isCollapsible) ? ' class="is-open"' : '', '>',

      isCollapsible ? [
        '<button type="button" class="tr-toggle" aria-expanded="false">',
          '<div class="tr-toggle-ico">', calcSvg, '</div>',
          '<div class="tr-toggle-title">', esc(cfg.heading), '<span class="tr-toggle-badge">Instant Calc</span>',
            '<span class="tr-toggle-sub" id="tr-toggle-est">', esc(cfg.subheading), '</span></div>',
          '<span class="tr-toggle-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg></span>',
        '</button>'
      ].join('') : isInline ? '' : [
        '<button type="button" class="tr-launcher" aria-label="Open finance calculator" aria-expanded="false">',
          '<div class="tr-ico">', calcSvg, '</div>',
          '<div><span class="tr-ltitle">', esc(cfg.heading), '</span><span class="tr-lsub">', esc(cfg.dealer), '</span></div>',
        '</button>'
      ].join(''),

      '<div class="tr-panel" role="dialog" aria-modal="', isInline ? 'false' : 'true', '" aria-label="', esc(cfg.heading), '">',
        /* The collapsible toggle already carries the heading and the live
           estimate, so repeating them here read as a duplicated header. */
        isCollapsible ? '' : [
          '<div class="tr-head">',
            '<div class="tr-head-icon">', calcSvg, '</div>',
            '<div><b>', esc(cfg.heading), '</b><span>', esc(cfg.subheading), '</span></div>',
            isInline ? '' : '<button type="button" class="tr-x" aria-label="Close">✕</button>',
          '</div>'
        ].join(''),

        '<div class="tr-body">',
          '<div class="tr-hp" aria-hidden="true"><label for="tr-company">Company</label><input id="tr-company" type="text" tabindex="-1" autocomplete="off"></div>',

          /* result */
          '<div class="tr-result" aria-live="polite">',
            '<div class="tr-result-lbl">Estimated instalment</div>',
            '<div class="tr-amt" id="tr-monthly">', esc(cfg.cur), '0<small>/mo</small></div>',
            '<div class="tr-rb"><span>Financed amount</span><b id="tr-financed">', esc(cfg.cur), '0</b></div>',
            '<div class="tr-rb"><span>Your deposit</span><b id="tr-depamt">', esc(cfg.cur), '0</b></div>',
            '<div class="tr-rb"><span>Balloon due at end</span><b id="tr-balamt">', esc(cfg.cur), '0</b></div>',
            '<div class="tr-rb"><span>Total cost</span><b id="tr-total">', esc(cfg.cur), '0</b></div>',
            '<div class="tr-note" id="tr-note"></div>',
          '</div>',

          /* controls */
          '<div class="tr-field"><label for="tr-price">Vehicle price</label>',
            '<div class="tr-price"><span>', esc(cfg.cur), '</span>',
            '<input id="tr-price" type="text" inputmode="numeric" value="', esc(String(cfg.price || "")), '" placeholder="e.g. 459900"></div></div>',

          '<div class="tr-field tr-range"><div class="top"><label>Deposit</label><b id="tr-dep-lbl"></b></div>',
            '<input id="tr-dep" type="range" min="0" max="50" step="1" value="', esc(String(cfg.deposit)), '">',
            '<div class="tr-ticks"><span>0%</span><span>50%</span></div></div>',

          '<div class="tr-field tr-range"><div class="top"><label>Term</label><b id="tr-term-lbl"></b></div>',
            '<input id="tr-term" type="range" min="12" max="84" step="6" value="', esc(String(cfg.term)), '">',
            '<div class="tr-ticks"><span>12</span><span>84 months</span></div></div>',

          '<div class="tr-field tr-range"><div class="top"><label>Balloon / residual</label><b id="tr-bal-lbl"></b></div>',
            '<input id="tr-bal" type="range" min="0" max="40" step="5" value="', esc(String(cfg.balloon)), '">',
            '<div class="tr-ticks"><span>0%</span><span>40%</span></div></div>',

          '<div class="tr-field tr-range"><div class="top"><label>Interest rate</label><b id="tr-rate-lbl"></b></div>',
            '<input id="tr-rate" type="range" min="6" max="20" step="0.25" value="', esc(String(cfg.rate)), '">',
            '<div class="tr-ticks"><span>6%</span><span>20%</span></div></div>',

          /* CTA */
          '<div class="tr-actions tr-cta-row">',
            '<button type="button" class="tr-btn tr-btn-primary" id="tr-cta">Get this deal</button>',
          '</div>',

          /* capture */
          '<div class="tr-capture">',
            '<div class="tr-cap-title">Great — where should ', esc(cfg.dealer), ' send it?</div>',
            '<div class="tr-row2">',
              '<input class="tr-inp" id="tr-name" type="text" placeholder="Your name*" autocomplete="name">',
              '<input class="tr-inp" id="tr-phone" type="tel" placeholder="Phone*" autocomplete="tel">',
            '</div>',
            '<input class="tr-inp" id="tr-email" type="email" placeholder="Email (optional)" autocomplete="email">',
            '<div class="tr-actions">',
              '<button type="button" class="tr-btn tr-btn-primary" id="tr-send">Send me this quote</button>',
              waActions,
            '</div>',
            '<div class="tr-actions" style="margin-top:8px">',
              '<button type="button" class="tr-btn tr-btn-ghost tr-btn-sm" id="tr-back">← Back to calculator</button>',
            '</div>',
          '</div>',
        '</div>',

        /* success */
        '<div class="tr-success" role="status" aria-live="polite">',
          '<div class="tr-badge ok">', okSvg, '</div>',
          '<div class="tr-done-title" tabindex="-1">Quote on its way</div>',
          '<div class="tr-done-sub">The <b>', esc(cfg.dealer), '</b> team has your figures and will be in touch shortly.</div>',
          '<div class="tr-actions" style="justify-content:center">',
            cfg.wa ? '<button type="button" class="tr-btn tr-btn-wa" id="tr-ok-wa">' + waSvg + ' WhatsApp Us</button>' : '',
            '<button type="button" class="tr-btn tr-btn-ghost" id="tr-again">Recalculate</button>',
          '</div>',
        '</div>',

        /* error */
        '<div class="tr-error" role="alert" aria-live="assertive">',
          '<div class="tr-badge err">', errSvg, '</div>',
          '<div class="tr-done-title" tabindex="-1">Couldn\'t send that</div>',
          '<div class="tr-done-sub">Something went wrong.', cfg.wa ? ' Reach us on WhatsApp, or try again.' : ' Please try again in a moment.', '</div>',
          '<div class="tr-actions" style="justify-content:center">',
            cfg.wa ? '<button type="button" class="tr-btn tr-btn-wa" id="tr-err-wa">' + waSvg + ' WhatsApp Us</button>' : '',
            '<button type="button" class="tr-btn tr-btn-ghost" id="tr-retry">Try again</button>',
          '</div>',
        '</div>',

        '<div class="tr-foot">Powered by <a href="https://tru-saas.com" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;font-weight:700;">TruDealer™</a></div>',
      '</div>',
      '</div>'
    ].join('');

    shadow.appendChild(el(html));

    var root = shadow.getElementById("tr");
    var panel = shadow.querySelector(".tr-panel");
    var launcher = shadow.querySelector(".tr-launcher");
    var closeBtn = shadow.querySelector(".tr-x");

    function id(i) { return shadow.getElementById(i); }
    function money(n) { var s = Math.max(0, Math.round(n)).toLocaleString(cfg.locale); return cfg.cur + (cfg.cur === "R" ? " " : "") + s; }
    function digits(s) { return String(s || "").replace(/[^\d]/g, ""); }

    /* ---- live calculation ---- */
    var calc = { price: 0, depPct: 0, term: 0, balPct: 0, rate: 0, deposit: 0, balloon: 0, financed: 0, monthly: 0, total: 0 };

    function recalc() {
      var price = num(digits(id("tr-price").value), 0);
      var depPct = num(id("tr-dep").value, 0);
      var term = num(id("tr-term").value, 0);
      var balPct = num(id("tr-bal").value, 0);
      var rate = num(id("tr-rate").value, 0);
      var deposit = price * depPct / 100;
      var balloon = price * balPct / 100;
      var financed = Math.max(0, price - deposit);
      var m = pmt(financed, rate, term, balloon);
      var total = deposit + m * term + balloon;

      calc = { price: price, depPct: depPct, term: term, balPct: balPct, rate: rate,
               deposit: deposit, balloon: balloon, financed: financed, monthly: m, total: total };

      id("tr-dep-lbl").textContent = depPct + "% · " + money(deposit);
      id("tr-term-lbl").textContent = term + " months";
      id("tr-bal-lbl").textContent = balPct + "% · " + money(balloon);
      id("tr-rate-lbl").textContent = rate.toFixed(2) + "%";
      id("tr-monthly").innerHTML = money(m) + "<small>/mo</small>";
      // Update collapsible toggle preview with live estimate
      var toggleEst = shadow.getElementById("tr-toggle-est");
      if (toggleEst) toggleEst.textContent = money(m) + "/mo" + (cfg.vehicle ? " \u00b7 " + cfg.vehicle : "");
      id("tr-financed").textContent = money(financed);
      id("tr-depamt").textContent = money(deposit);
      id("tr-balamt").textContent = money(balloon);
      id("tr-total").textContent = money(total);
      id("tr-note").textContent =
        "Indicative only — not a quote, credit approval, or offer of finance. Excludes initiation (~" +
        money(cfg.initFee) + ") and monthly admin (~" + money(cfg.adminFee) +
        "). The final rate is risk-based and set by the bank.";
        
      ["tr-dep", "tr-term", "tr-bal", "tr-rate"].forEach(function(pid) {
        var input = id(pid);
        if (input) {
          var min = +input.min, max = +input.max, val = +input.value;
          var pct = ((val - min) / (max - min)) * 100;
          input.style.setProperty("--fill", pct + "%");
        }
      });
    }

    ["tr-price", "tr-dep", "tr-term", "tr-bal", "tr-rate"].forEach(function (i) {
      var elm = id(i); if (elm) elm.addEventListener("input", recalc);
    });
    recalc();

    /* ---- open / close ---- */
    function focusFirst() { var p = id("tr-price"); if (p) { try { p.focus(); } catch (e) {} } }
    function open() { root.classList.add("is-open"); if (launcher) launcher.setAttribute("aria-expanded", "true"); if (toggle) toggle.setAttribute("aria-expanded", "true"); if (!isInline) setTimeout(focusFirst, 60); }
    function close() {
      if (isInline && !isCollapsible) return;
      root.classList.remove("is-open", "is-capturing", "is-sent", "is-error");
      if (launcher) { launcher.setAttribute("aria-expanded", "false"); try { launcher.focus(); } catch (e) {} }
      if (toggle) { toggle.setAttribute("aria-expanded", "false"); }
    }
    if (launcher) launcher.addEventListener("click", open);
    var toggle = shadow.querySelector(".tr-toggle");
    if (toggle) { toggle.addEventListener("click", function () { root.classList.contains("is-open") ? close() : open(); }); }
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (!isInline) {
      panel.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); close(); return; }
        if (e.key !== "Tab") return;
        var f = shadow.querySelectorAll(".tr-panel button, .tr-panel input");
        var list = Array.prototype.filter.call(f, function (n) { return !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null; });
        if (!list.length) return;
        var a = list[0], b = list[list.length - 1];
        if (e.shiftKey && shadow.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && shadow.activeElement === b) { e.preventDefault(); a.focus(); }
      });
    }

    /* ---- CTA -> capture ---- */
    id("tr-cta").addEventListener("click", function () {
      if (!(calc.price > 0)) { var p = id("tr-price"); p.classList.add("tr-bad"); p.focus(); return; }
      root.classList.add("is-capturing");
      setTimeout(function () { var n = id("tr-name"); if (n) { try { n.focus(); } catch (e) {} } }, 60);
    });
    id("tr-price").addEventListener("input", function () { id("tr-price").classList.remove("tr-bad"); });
    id("tr-back").addEventListener("click", function () { root.classList.remove("is-capturing"); });

    /* ---- lead ---- */
    function val(i) { var e = id(i); return e ? e.value.trim() : ""; }
    function looksLikeBot() { return !!val("tr-company") || (Date.now() - mountedAt < 1200); }
    function validCapture() {
      var ok = true;
      var name = id("tr-name"), phone = id("tr-phone");
      if (!name.value.trim()) { name.classList.add("tr-bad"); ok = false; } else name.classList.remove("tr-bad");
      if (!/^\+?[\d\s()-]{7,15}$/.test(phone.value.trim())) { phone.classList.add("tr-bad"); ok = false; } else phone.classList.remove("tr-bad");
      return ok;
    }

    function notes() {
      var L = [];
      if (cfg.vehicle) L.push("Vehicle: " + cfg.vehicle);
      L.push("Price: " + money(calc.price));
      L.push("Deposit: " + calc.depPct + "% (" + money(calc.deposit) + ")");
      L.push("Term: " + calc.term + " months");
      L.push("Balloon: " + calc.balPct + "% (" + money(calc.balloon) + ")");
      L.push("Rate: " + calc.rate.toFixed(2) + "%");
      L.push("Est. instalment: " + money(calc.monthly) + "/mo");
      return "Finance calculator enquiry\n" + L.join("\n");
    }
    function payload(source) {
      var parts = val("tr-name").split(/\s+/);
      return {
        dealerSlug: cfg.slug,
        firstName: parts[0] || "Finance",
        lastName: parts.slice(1).join(" ") || "Enquiry",
        phone: val("tr-phone"),
        email: val("tr-email"),
        source: source || "TruRepay Calculator",
        notes: notes()
      };
    }
    function waMessage() {
      var L = ["Hi " + cfg.dealer + ",", "", "I used your finance calculator:"];
      if (cfg.vehicle) L.push("Vehicle: " + cfg.vehicle);
      L.push("Price: " + money(calc.price), "Deposit: " + calc.depPct + "%", "Term: " + calc.term + " months",
             "Balloon: " + calc.balPct + "%", "Est. instalment: " + money(calc.monthly) + "/mo");
      if (val("tr-name")) L.push("", "Name: " + val("tr-name"));
      L.push("", "Please send me a firm quote.");
      return L.join("\n");
    }
    function postLead(source) {
      /* CallMeBot is the yard's auto-notification — prepend who to call back,
         since notes() carries only the finance figures. */
      cmbNotify(cfg, source || "TruRepay",
        "Name: " + (val("tr-name") || "—") +
        "\nPhone: " + (val("tr-phone") || "—") +
        "\n" + notes());
      if (!(cfg.webhook || (cfg.slug && cfg.flowUrl))) return Promise.resolve(!!(cfg.cmbKey && cfg.cmbPhone));
      var leadUrl = cfg.webhook || (cfg.flowUrl.replace(/\/$/, "") + "/api/integration/webhook-lead");
      var ctrl = ("AbortController" in window) ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
      var pl = payload(source);
      return fetch(leadUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pl), mode: "cors", signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (res && res.ok) {
          try { window.dispatchEvent(new CustomEvent('tru:lead', { detail: { product: 'tru-repay', dealer: cfg.slug || '', data: pl } })); } catch(e) {}
          return true;
        }
        return false;
      }).catch(function () { if (timer) clearTimeout(timer); return false; });
    }
    function showState(cls) {
      root.classList.remove("is-sent", "is-error");
      if (cls) root.classList.add(cls);
      var f = shadow.querySelector((cls === "is-error" ? ".tr-error" : ".tr-success") + " .tr-done-title");
      if (f) { try { f.focus(); } catch (e) {} }
    }
    function setBusy(btn, busy, label) {
      if (!btn) return; btn.disabled = busy;
      btn.innerHTML = busy ? '<span class="tr-spin"></span> ' + label : btn.getAttribute("data-idle");
    }

    var sendBtn = id("tr-send");
    sendBtn.setAttribute("data-idle", sendBtn.innerHTML);
    sendBtn.addEventListener("click", function () {
      if (!validCapture()) return;
      if (looksLikeBot()) { showState("is-sent"); return; }
      setBusy(sendBtn, true, "Sending…");
      postLead("TruRepay Calculator").then(function (ok) {
        setBusy(sendBtn, false, "");
        showState(ok ? "is-sent" : "is-error");
      });
    });

    function waSend() {
      if (!validCapture()) return;
      window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(waMessage()), "_blank", "noopener");
      if (!looksLikeBot()) postLead("TruRepay Calculator (WhatsApp)");
      showState("is-sent");
    }
    var capWa = id("tr-cap-wa"); if (capWa) capWa.addEventListener("click", waSend);
    var okWa = id("tr-ok-wa"); if (okWa) okWa.addEventListener("click", function () { window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(waMessage()), "_blank", "noopener"); });
    var errWa = id("tr-err-wa"); if (errWa) errWa.addEventListener("click", function () { window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(waMessage()), "_blank", "noopener"); });

    var retry = id("tr-retry"); if (retry) retry.addEventListener("click", function () { root.classList.remove("is-error"); });
    var again = id("tr-again"); if (again) again.addEventListener("click", function () {
      root.classList.remove("is-sent", "is-capturing");
      ["tr-name", "tr-phone", "tr-email"].forEach(function (i) { var e = id(i); if (e) { e.value = ""; e.classList.remove("tr-bad"); } });
    });

    /* ---- register instance ---- */
    var api = { open: open, close: close, root: root, recalc: recalc, instance: INSTANCE };
    var reg = window.TruRepay || { instances: [] };
    if (!reg.instances) reg.instances = [];
    reg.instances.push(api);
    reg.open = function () { var i = reg.instances[reg.instances.length - 1]; if (i) i.open(); };
    reg.close = function () { var i = reg.instances[reg.instances.length - 1]; if (i) i.close(); };
    window.TruRepay = reg;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
