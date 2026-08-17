/**
 * TruForm — embeddable contact / enquiry form (TruSaaS)
 *
 * CANONICAL SOURCE. Per-dealer copies under case-sites/ are deploy
 * artefacts — fix bugs here, then re-copy.
 *
 * Drop-in:
 *   <script src="tru-form.js"
 *           data-dealer="True Cars"
 *           data-slug="true-cars"
 *           data-flow="https://premium.tru-saas.com"
 *           data-wa="27620502091"
 *           data-accent="#1466E0"
 *           data-fields="vehicle,tradein,finance,location"></script>
 *
 * Optional attributes:
 *   data-heading     Panel heading (default "Get in Touch")
 *   data-subheading  Subline text (default "We'll get back to you shortly")
 *   data-position    "right" (default) | "left"
 *   data-mode        "inline" (renders in-page) | "float" (default, fixed FAB)
 *   data-target      CSS selector — in inline mode, render inside this element
 *   data-accent      brand colour, everything derives from it
 *   data-accent-2    far gradient end (default: accent darkened)
 *   data-vehicle     pre-fill vehicle interest (e.g. from a vehicle detail page)
 *   data-brand       footer credit text (default "TruForm · TruSaaS")
 *   data-z           z-index (default 999980)
 *   data-fields      comma-separated optional blocks to show:
 *                       vehicle  — "Which vehicle?" text input
 *                       tradein  — trade-in toggle + year/make/model/km
 *                       finance  — "Need finance?" toggle + employment
 *                       location — area / city field
 *                     Omit to show only the base fields (name, phone, email,
 *                     interest dropdown, message).
 *
 * Programmatic control (per the LAST-mounted instance; all instances in
 * window.TruForm.instances):
 *   window.TruForm.open();  window.TruForm.close();
 *
 *   open() also accepts an optional payload to pre-fill and label the enquiry
 *   — this is what TruDealer.open("form", payload) forwards:
 *     window.TruForm.open({
 *       vehicle:  "2023 Toyota Hilux GD6 · R329 990",
 *       interest: "Finance enquiry",     // matched against the dropdown
 *       message:  "Deposit 10% over 72 months",
 *       finance:  true,                  // opens the finance block
 *       tradein:  false,
 *       source:   "COC · VD Finance"     // lead source recorded on submit
 *     });
 *   Keys whose field is not mounted (see data-fields) are skipped silently.
 *   Name / phone / email are deliberately NOT accepted — see applyPayload().
 *
 * Lead delivery: the enquiry is POSTed to <data-flow>/api/integration/webhook-lead
 * (needs data-slug + data-flow). The UI only shows "sent" when the post really
 * succeeds; on failure it shows an error with a WhatsApp fallback. The WhatsApp
 * path also files the lead, so a WA-first visitor is still captured.
 */
(function () {
  "use strict";

  var scr = document.currentScript || document.querySelector("script[src*='tru-form']");
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

  var cfg = {
    dealer: attr("data-dealer", "this dealership"),
    slug: attr("data-slug", ""),
    flowUrl: attr("data-flow", ""),
    webhook: attr("data-webhook", ""),
    cmbKey: attr("data-callmebot-key", ""),
    cmbPhone: ((attr("data-callmebot-phone", "") || attr("data-wa", "")) || "").replace(/\D/g, ""),
    wa: (attr("data-wa", "") || "").replace(/\D/g, ""),
    text: attr("data-text", ""),   // override primary text colour
    scale: attr("data-scale", ""), // launcher size multiplier
    heading: attr("data-heading", "Get in Touch"),
    subheading: attr("data-subheading", "We'll get back to you shortly."),
    position: attr("data-position", "right"),
    offsetBottom: attr("data-bottom", "24px"),
    mode: attr("data-mode", "float"),
    target: attr("data-target", ""),
    vehicle: attr("data-vehicle", ""),
    accent: attr("data-accent", "#1466E0"),
    accent2: attr("data-accent-2", ""),
    /* Just the name — the markup already prints the "Powered by " prefix, so
       a default of "Powered by TruDealer" rendered "Powered by Powered by
       TruDealer" on every site using the default. */
    brand: attr("data-brand", "TruDealer"),
    theme: attr("data-theme", "dark"),
    z: attr("data-z", "2147300000"),
    fields: (attr("data-fields", "") || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean)
  };

  var has = {
    vehicle: cfg.fields.indexOf("vehicle") !== -1,
    tradein: cfg.fields.indexOf("tradein") !== -1,
    finance: cfg.fields.indexOf("finance") !== -1,
    location: cfg.fields.indexOf("location") !== -1
  };

  /* Per-instance host id — multiple TruForm tags can coexist (e.g. an inline
     form plus the float launcher). Each script execution has its own closure,
     so cfg/shadow are already independent; we only need unique host ids and a
     shared window.TruForm registry. */
  window.__truFormCount = (window.__truFormCount || 0) + 1;
  var INSTANCE = window.__truFormCount;
  var ID = "tru-form-" + INSTANCE;

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
  function mix(rgb, target, amount) {
    return rgb.map(function (v, i) { return v + (target[i] - v) * amount; });
  }
  var WHITE = [255, 255, 255], BLACK = [0, 0, 0];
  function lighten(rgb, a) { return mix(rgb, WHITE, a); }
  function darken(rgb, a) { return mix(rgb, BLACK, a); }
  function chan(rgb) { return rgb.map(Math.round).join(" "); }

  var accent = parseHex(cfg.accent) || parseHex("#1466E0");
  var accentBright = lighten(accent, 0.34);
  var accentDeep = darken(accent, 0.34);
  var accent2 = parseHex(cfg.accent2) || accentDeep;

  var VARS = [
    "--tf-signal:", toHex(accent), ";",
    "--tf-signal-bright:", toHex(accentBright), ";",
    "--tf-signal-deep:", toHex(accentDeep), ";",
    "--tf-signal-rgb:", chan(accent), ";",
    "--tf-signal-bright-rgb:", chan(accentBright), ";",
    "--tf-blue:", toHex(accent2), ";",
    "--tf-blue-rgb:", chan(accent2), ";",
    "--tf-grad:linear-gradient(115deg,", toHex(accentBright), " 0%,", toHex(accent), " 48%,", toHex(accent2), " 100%);",
    "--tf-ink:#06070c;--tf-wa:#25D366;--tf-wa-deep:#059669;",
    "--tf-glass:rgba(14,16,22,.48);--tf-border:rgba(255,255,255,.06);",
    "--tf-text:#fff;--tf-muted:#B0B8C4;--tf-faint:rgba(176,184,196,.55);",
    "--tf-surface:#11121a;--tf-err:#f87171;",
    "--tf-ease:cubic-bezier(.22,1,.36,1);--tf-spring:cubic-bezier(.34,1.4,.64,1);",
    /* light/glass palette — cream editorial sites. Declared last so it wins;
       :host{all:initial} blocks any custom property set from the page. */
    "--tf-fill:rgba(255,255,255,.06);--tf-fill-2:rgba(255,255,255,.12);",
    "--tf-hair:rgba(255,255,255,.10);--tf-edge:rgba(255,255,255,.14);",
    cfg.theme === "light" ? [
      "--tf-glass:rgba(251,248,243,.78);--tf-border:rgba(14,26,38,.12);",
      "--tf-text:#0E1A26;--tf-muted:rgba(14,26,38,.58);--tf-faint:rgba(14,26,38,.42);",
      "--tf-surface:#FBF8F3;--tf-err:#B91C1C;",
      "--tf-fill:rgba(14,26,38,.04);--tf-fill-2:rgba(14,26,38,.08);",
      "--tf-hair:rgba(14,26,38,.10);--tf-edge:rgba(14,26,38,.14);"
    ].join("") : ""
  ].join("");

  var isInline = cfg.mode === "inline";

  /* ---- CSS ---- */
  var CSS = [
    ":host{all:initial;",
    VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    isInline ? "display:block;width:100%;" : [
      "position:fixed;z-index:" + cfg.z + ";bottom:" + cfg.offsetBottom + ";",
      cfg.position === "left" ? "left:16px;right:auto;" : "right:16px;left:auto;",
      "display:block;max-width:min(440px,calc(100vw - 24px));pointer-events:none"
    ].join(""),
    "}",
    "#tf{",
    VARS,
    "font-family:Inter,system-ui,-apple-system,sans-serif;box-sizing:border-box;",
    isInline
      ? "display:flex;flex-direction:column;"
      : "display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none;",
    "}",
    "#tf *,#tf *::before,#tf *::after{box-sizing:border-box}",
    "#tf button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}",

    /* honeypot — hidden from humans, tempting to bots */
    ".tf-hp{position:absolute!important;left:-9999px!important;top:auto;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}",

    /* launcher */
    ".tf-launcher{",
    "pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 16px 10px 12px;",
      "border-radius:100px;background:linear-gradient(145deg,rgba(20,22,30,.78),rgba(14,16,22,.82));",
    "border:1px solid rgb(var(--tf-signal-rgb)/.28);color:#fff;",
    "box-shadow:0 12px 36px -10px rgba(0,0,0,.55),0 0 24px -8px rgb(var(--tf-signal-rgb)/.35),inset 0 1px 0 var(--tf-hair);",
    "backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);",
    "transition:transform .35s var(--tf-spring),box-shadow .35s var(--tf-ease);text-align:left}",
    ".tf-launcher:hover{transform:translateY(-3px) scale(1.02);",
    "box-shadow:0 18px 40px -10px rgb(var(--tf-signal-rgb)/.4),0 0 32px -6px rgb(var(--tf-blue-rgb)/.3),inset 0 1px 0 var(--tf-edge)}",
    ".tf-launcher:active{transform:scale(.97)}",
    ".tf-ico{",
    "width:40px;height:40px;border-radius:50%;flex-shrink:0;",
    "background:var(--tf-grad);",
    "display:grid;place-items:center;box-shadow:0 6px 18px -4px rgb(var(--tf-signal-rgb)/.55);position:relative}",
    ".tf-ico::after{content:'';position:absolute;inset:-4px;border-radius:50%;",
    "border:2px solid rgb(var(--tf-signal-rgb)/.45);animation:tfPulse 2.2s ease-out infinite}",
    "@keyframes tfPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}",
    ".tf-ico svg{width:20px;height:20px}",
    ".tf-ltitle{display:block;font-size:13px;font-weight:700;line-height:1.2;letter-spacing:.01em;color:#fff}",
    ".tf-lsub{display:block;font-size:10px;color:var(--tf-muted);line-height:1.35;margin-top:2px}",
    "#tf.is-open .tf-launcher{display:none}",

    /* panel */
    ".tf-panel{",
    "pointer-events:auto;",
    isInline
      ? "display:flex;flex-direction:column;width:100%;border-radius:20px;overflow:hidden;"
      : [
          "display:none;flex-direction:column;width:min(420px,calc(100vw - 24px));",
          "max-height:min(78vh,640px);border-radius:20px;overflow:hidden;",
          "opacity:0;transform:translateY(16px) scale(.96);",
          "transition:opacity .35s var(--tf-ease),transform .4s var(--tf-spring);"
        ].join(""),
    "background:var(--tf-glass);backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);",
    "border:1px solid var(--tf-border);color:var(--tf-text);",
    "box-shadow:0 28px 70px -20px rgba(0,0,0,.65),0 0 40px -16px rgb(var(--tf-signal-rgb)/.2),inset 0 1px 0 var(--tf-hair)}",
    isInline ? "" : "#tf.is-open .tf-panel{display:flex;opacity:1;transform:none}",

    /* header */
    ".tf-head{",
    "padding:18px 16px 14px;display:flex;align-items:center;gap:12px;",
    "background:var(--tf-grad);position:relative;overflow:hidden;flex-shrink:0}",
    ".tf-head::after{content:'';position:absolute;inset:0;",
    "background:linear-gradient(120deg,transparent 30%,var(--tf-edge) 50%,transparent 70%);",
    "animation:tfShine 3s ease-in-out infinite}",
    "@keyframes tfShine{0%,100%{transform:translateX(-120%)}50%{transform:translateX(120%)}}",
    ".tf-head-icon{width:42px;height:42px;border-radius:14px;",
    "background:rgba(255,255,255,.18);display:grid;place-items:center;flex-shrink:0;",
    "box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}",
    ".tf-head-icon svg{width:22px;height:22px}",
    ".tf-head b{display:block;font-size:16px;font-weight:800;letter-spacing:-.01em}",
    ".tf-head span{display:block;font-size:11.5px;opacity:.85;margin-top:2px}",
    ".tf-x{",
    "margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);",
    "color:#fff;font-size:18px;display:grid;place-items:center;",
    "transition:background .2s,transform .25s var(--tf-spring);position:relative;z-index:2}",
    ".tf-x:hover{background:rgba(255,255,255,.26);transform:scale(1.05)}",

    /* body */
    ".tf-body{padding:16px;overflow-y:auto;flex:1;min-height:0}",

    /* section dividers */
    ".tf-section{margin:18px 0 12px;padding-top:14px;border-top:1px solid var(--tf-hair)}",
    ".tf-section-title{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;",
    "color:var(--tf-signal-bright);margin:0 0 12px;display:flex;align-items:center;gap:8px}",
    ".tf-section-title svg{width:14px;height:14px;flex-shrink:0}",

    /* fields */
    ".tf-field{margin-bottom:14px}",
    ".tf-field label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;",
    "color:var(--tf-muted);margin:0 0 6px}",
    ".tf-field input,.tf-field textarea,.tf-field select{",
    "width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid var(--tf-edge);",
    "background:var(--tf-fill);color:var(--tf-text);font:600 14px Inter,system-ui,sans-serif;outline:none;",
    "transition:border-color .2s,box-shadow .2s;resize:none}",
      ".tf-field input::placeholder,.tf-field textarea::placeholder{color:var(--tf-faint);font-weight:500}",
    ".tf-field input:focus,.tf-field textarea:focus,.tf-field select:focus{",
    "border-color:rgb(var(--tf-signal-rgb)/.55);box-shadow:0 0 0 3px rgb(var(--tf-signal-rgb)/.22)}",
    ".tf-field textarea{min-height:88px;line-height:1.5}",
    ".tf-field select option{background:var(--tf-surface);color:#fff}",
    ".tf-field.tf-err input,.tf-field.tf-err textarea,.tf-field.tf-err select{border-color:rgba(239,68,68,.6);box-shadow:0 0 0 3px rgba(239,68,68,.15)}",
    ".tf-field .tf-hint{font-size:10px;color:var(--tf-err);margin-top:4px;display:none}",
    ".tf-field.tf-err .tf-hint{display:block}",

    /* toggle chip */
    ".tf-toggle{display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:10px 14px;",
    "border-radius:100px;font-size:12px;font-weight:700;margin-bottom:12px;",
    "border:1px solid var(--tf-edge);background:var(--tf-fill);color:var(--tf-muted);",
    "transition:all .25s var(--tf-ease);user-select:none}",
    ".tf-toggle:hover{border-color:rgba(255,255,255,.2);color:#fff}",
    ".tf-toggle.on{background:var(--tf-grad);color:#fff;border-color:transparent;",
    "box-shadow:0 8px 18px -8px rgb(var(--tf-signal-rgb)/.5)}",
    ".tf-toggle-dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.3);",
    "display:grid;place-items:center;transition:all .2s var(--tf-spring);flex-shrink:0}",
    ".tf-toggle.on .tf-toggle-dot{border-color:#fff;background:rgba(255,255,255,.2)}",
    ".tf-toggle.on .tf-toggle-dot::after{content:'';width:8px;height:8px;border-radius:50%;background:#fff}",
    ".tf-expand{display:none;animation:tfIn .35s var(--tf-ease) both}",
    ".tf-expand.on{display:block}",

    /* required star */
    ".tf-req{color:rgb(var(--tf-signal-rgb));margin-left:2px}",

    /* row layout */
    ".tf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    "@media(max-width:380px){.tf-row{grid-template-columns:1fr}}",

    /* buttons */
    ".tf-actions{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}",
    ".tf-btn{",
    "flex:1 1 auto;min-width:130px;display:inline-flex;align-items:center;justify-content:center;gap:8px;",
    "padding:14px 16px;border-radius:14px;font-weight:800;font-size:13.5px;letter-spacing:.01em;",
    "transition:transform .3s var(--tf-spring),box-shadow .3s,filter .2s;position:relative;overflow:hidden}",
    ".tf-btn:active{transform:scale(.97)}",
    ".tf-btn-primary{",
    "background:var(--tf-grad);color:#fff;",
    "box-shadow:0 10px 26px -10px rgb(var(--tf-signal-rgb)/.55),inset 0 1px 0 rgba(255,255,255,.2)}",
    ".tf-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px);",
    "box-shadow:0 14px 32px -10px rgb(var(--tf-signal-rgb)/.55),0 0 24px -8px rgb(var(--tf-blue-rgb)/.35)}",
    ".tf-btn-primary:disabled{opacity:.55;pointer-events:none}",
    ".tf-btn-wa{",
    "background:linear-gradient(145deg,var(--tf-wa),var(--tf-wa-deep));color:#fff;",
    "box-shadow:0 10px 26px -10px rgba(16,185,129,.45)}",
    ".tf-btn-wa:hover{filter:brightness(1.08);transform:translateY(-2px)}",
    ".tf-btn-wa:disabled{opacity:.55;pointer-events:none}",
    ".tf-btn-ghost{",
    "background:var(--tf-fill);color:#fff;border:1px solid var(--tf-edge)}",
    ".tf-btn-ghost:hover{background:var(--tf-hair)}",

    /* spinner */
    ".tf-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.35);",
    "border-top-color:#fff;animation:tfSpin .7s linear infinite;display:inline-block}",
    "@keyframes tfSpin{to{transform:rotate(360deg)}}",

    /* success + error panels */
    ".tf-success,.tf-error{display:none;text-align:center;padding:32px 16px}",
    "#tf.is-sent .tf-body{display:none}",
    "#tf.is-sent .tf-success{display:block;animation:tfIn .5s var(--tf-ease) both}",
    "#tf.is-error .tf-body{display:none}",
    "#tf.is-error .tf-error{display:block;animation:tfIn .5s var(--tf-ease) both}",
    "@keyframes tfIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
    ".tf-check{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;",
    "background:linear-gradient(145deg,rgba(52,211,153,.18),rgba(16,185,129,.08));",
    "border:2px solid rgba(52,211,153,.4);display:grid;place-items:center}",
    ".tf-check svg{width:32px;height:32px;stroke:#34d399;stroke-width:2.5}",
    ".tf-warn{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;",
    "background:linear-gradient(145deg,rgba(248,113,113,.18),rgba(239,68,68,.08));",
    "border:2px solid rgba(248,113,113,.4);display:grid;place-items:center}",
    ".tf-warn svg{width:32px;height:32px;stroke:var(--tf-err);stroke-width:2.5}",
    ".tf-done-title{font-size:18px;font-weight:800;margin-bottom:6px}",
    ".tf-done-sub{font-size:13px;color:var(--tf-muted);margin-bottom:20px;line-height:1.5}",

    /* footer */
    ".tf-foot{padding:8px 14px 10px;border-top:1px solid var(--tf-hair);flex-shrink:0;",
    "font-size:9.5px;color:var(--tf-muted);text-align:center;letter-spacing:.03em}",
    ".tf-foot b{color:var(--tf-signal-bright);font-weight:700}",

    /* mobile */
    isInline ? "" : [
      "@media(max-width:480px){",
      "@keyframes tfShine{0%{transform:translateX(-160%) skewX(-20deg)}55%,100%{transform:translateX(300%) skewX(-20deg)}}",
      "#tf{align-items:" + (cfg.position === "left" ? "flex-start" : "flex-end") + "}",
      ".tf-launcher{width:66px;min-height:66px;height:66px;padding:9px;border-radius:50%;justify-content:center;gap:0;position:relative;overflow:hidden}",
      ".tf-launcher>div:last-child{display:none}",
      ".tf-launcher::after{content:'';position:absolute;top:0;left:0;width:48%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-160%) skewX(-20deg);animation:tfShine 3.6s ease-in-out infinite;pointer-events:none;z-index:2}",
      ".tf-panel{width:100%}}"
    ].join(""),

    "@media(prefers-reduced-motion:reduce){#tf *{animation:none!important;transition-duration:.01ms!important}}",
    "#tf button:focus-visible,#tf input:focus-visible,#tf textarea:focus-visible,#tf select:focus-visible{",
    "outline:2px solid var(--tf-signal-bright);outline-offset:2px}",
    /* data-text: override primary text colour. */
    cfg.text ? "#tf{--tf-text:" + cfg.text + "}#tf .tf-launcher,#tf .tf-ltitle,#tf .tf-panel{color:" + cfg.text + "}" : "",
    /* data-scale: resize the float launcher, anchored to its corner. */
    (cfg.scale && !isInline) ? "#tf .tf-launcher{transform:scale(" + cfg.scale + ");transform-origin:bottom " + cfg.position + "}" : ""
  ].join("");

  /* ---- icons ---- */
  var mailSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M22 7l-10 7L2 7"/></svg>';
  var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  var warnSvg = '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  var waSvg = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.68.15s-.78.97-.96 1.17c-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.44-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.63-.93-2.23-.24-.59-.49-.5-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.06 1.04-1.06 2.53s1.09 2.94 1.24 3.14c.15.2 2.14 3.27 5.18 4.58.72.31 1.29.5 1.73.64.73.23 1.39.2 1.91.12.58-.09 1.76-.72 2.01-1.41.25-.7.25-1.3.18-1.42-.08-.12-.28-.2-.58-.35zM12.05 21.5c-1.77 0-3.5-.48-5.02-1.38l-.36-.21-3.73.98.99-3.63-.24-.38A9.44 9.44 0 012.5 12.05C2.5 6.8 6.8 2.5 12.05 2.5S21.6 6.8 21.6 12.05 17.3 21.5 12.05 21.5zM12.05.5C5.7.5.5 5.7.5 12.05c0 2.04.54 4.03 1.56 5.79L.5 23.5l5.8-1.52A11.47 11.47 0 0012.05 23.5c6.35 0 11.55-5.2 11.55-11.55S18.4.5 12.05.5z"/></svg>';
  var carSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>';
  var swapSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l4 4-4 4"/><path d="M20 7H4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/></svg>';
  var walletSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>';
  var pinSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var shadow = null;
  var mountedAt = Date.now();

  function mount() {
    var hostEl;
    if (isInline && cfg.target) {
      hostEl = document.querySelector(cfg.target);
      if (!hostEl) {
        hostEl = document.createElement("div");
        hostEl.id = ID + "-host";
        document.body.appendChild(hostEl);
      }
    } else {
      hostEl = document.createElement("div");
      hostEl.id = ID + "-host";
      document.body.appendChild(hostEl);
    }
    shadow = hostEl.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    /* ---- build optional field blocks ---- */

    var vehicleBlock = '';
    if (has.vehicle || cfg.vehicle) {
      vehicleBlock = [
        '<div class="tf-section">',
          '<div class="tf-section-title">', carSvg, ' Vehicle Interest</div>',
          '<div class="tf-field"><label for="tf-veh">Which vehicle are you interested in?</label>',
            '<input type="text" id="tf-veh" placeholder="e.g. 2023 Toyota Fortuner" value="', esc(cfg.vehicle), '" /></div>',
        '</div>'
      ].join('');
    }

    var tradeinBlock = '';
    if (has.tradein) {
      tradeinBlock = [
        '<div class="tf-section">',
          '<div class="tf-section-title">', swapSvg, ' Trade-in</div>',
          '<button type="button" class="tf-toggle" id="tf-tradein-toggle" aria-pressed="false" aria-controls="tf-tradein-fields">',
            '<span class="tf-toggle-dot"></span> I have a vehicle to trade in</button>',
          '<div class="tf-expand" id="tf-tradein-fields">',
            '<div class="tf-row">',
              '<div class="tf-field"><label for="tf-ti-year">Year</label>',
                '<input type="text" id="tf-ti-year" inputmode="numeric" placeholder="e.g. 2019" /></div>',
              '<div class="tf-field"><label for="tf-ti-make">Make</label>',
                '<input type="text" id="tf-ti-make" placeholder="e.g. Toyota" /></div>',
            '</div>',
            '<div class="tf-row">',
              '<div class="tf-field"><label for="tf-ti-model">Model</label>',
                '<input type="text" id="tf-ti-model" placeholder="e.g. Hilux 2.8 GD-6" /></div>',
              '<div class="tf-field"><label for="tf-ti-km">Mileage (km)</label>',
                '<input type="text" id="tf-ti-km" inputmode="numeric" placeholder="e.g. 85,000" /></div>',
            '</div>',
          '</div>',
        '</div>'
      ].join('');
    }

    var financeBlock = '';
    if (has.finance) {
      financeBlock = [
        '<div class="tf-section">',
          '<div class="tf-section-title">', walletSvg, ' Finance</div>',
          '<button type="button" class="tf-toggle" id="tf-finance-toggle" aria-pressed="false" aria-controls="tf-finance-fields">',
            '<span class="tf-toggle-dot"></span> I need vehicle finance</button>',
          '<div class="tf-expand" id="tf-finance-fields">',
            '<div class="tf-field"><label for="tf-fi-employment">Employment status</label>',
              '<select id="tf-fi-employment">',
                '<option value="">Select...</option>',
                '<option value="Permanently employed">Permanently employed</option>',
                '<option value="Contract / temporary">Contract / temporary</option>',
                '<option value="Self-employed">Self-employed</option>',
                '<option value="Other">Other</option>',
              '</select></div>',
            '<div class="tf-field"><label for="tf-fi-deposit">Deposit available?</label>',
              '<select id="tf-fi-deposit">',
                '<option value="">Select...</option>',
                '<option value="None">None</option>',
                '<option value="Under 10%">Under 10%</option>',
                '<option value="10% – 20%">10% – 20%</option>',
                '<option value="Over 20%">Over 20%</option>',
              '</select></div>',
          '</div>',
        '</div>'
      ].join('');
    }

    var locationBlock = '';
    if (has.location) {
      locationBlock = [
        '<div class="tf-section">',
          '<div class="tf-section-title">', pinSvg, ' Your Location</div>',
          '<div class="tf-field"><label for="tf-loc">City / Area</label>',
            '<input type="text" id="tf-loc" placeholder="e.g. Cape Town, Sandton, Durban" autocomplete="address-level2" /></div>',
        '</div>'
      ].join('');
    }

    var waActionBtn = cfg.wa
      ? '<button type="button" class="tf-btn tf-btn-wa" id="tf-wa-send">' + waSvg + ' WhatsApp</button>'
      : '';

    var formHtml = [
      '<div id="tf"', isInline ? ' class="is-open"' : '', '>',

      /* launcher */
      isInline ? '' : [
        '<button type="button" class="tf-launcher" aria-label="Open contact form" aria-expanded="false">',
          '<div class="tf-ico">', mailSvg, '</div>',
          '<div><span class="tf-ltitle">', esc(cfg.heading), '</span>',
          '<span class="tf-lsub">', esc(cfg.dealer), '</span></div>',
        '</button>'
      ].join(''),

      /* panel */
      '<div class="tf-panel" role="dialog" aria-modal="', isInline ? 'false' : 'true', '" aria-label="', esc(cfg.heading), '">',

        /* header */
        '<div class="tf-head">',
          '<div class="tf-head-icon">', mailSvg, '</div>',
          '<div><b>', esc(cfg.heading), '</b><span>', esc(cfg.subheading), '</span></div>',
          isInline ? '' : '<button type="button" class="tf-x" aria-label="Close">✕</button>',
        '</div>',

        /* form body */
        '<div class="tf-body">',

          /* honeypot */
          '<div class="tf-hp" aria-hidden="true">',
            '<label for="tf-company">Company (leave blank)</label>',
            '<input type="text" id="tf-company" name="company" tabindex="-1" autocomplete="off" /></div>',

          /* --- core fields --- */
          '<div class="tf-row">',
            '<div class="tf-field"><label for="tf-fn">First name<span class="tf-req">*</span></label>',
              '<input type="text" id="tf-fn" placeholder="First name" autocomplete="given-name" required />',
              '<div class="tf-hint">Please enter your first name</div></div>',
            '<div class="tf-field"><label for="tf-ln">Last name</label>',
              '<input type="text" id="tf-ln" placeholder="Last name" autocomplete="family-name" /></div>',
          '</div>',

          '<div class="tf-row">',
            '<div class="tf-field"><label for="tf-ph">Phone<span class="tf-req">*</span></label>',
              '<input type="tel" id="tf-ph" placeholder="e.g. 082 123 4567" autocomplete="tel" required />',
              '<div class="tf-hint">Enter a valid phone number</div></div>',
            '<div class="tf-field"><label for="tf-em">Email</label>',
              '<input type="email" id="tf-em" placeholder="you@example.com" autocomplete="email" />',
              '<div class="tf-hint">Enter a valid email address</div></div>',
          '</div>',

          '<div class="tf-field"><label for="tf-interest">Interested in</label>',
            '<select id="tf-interest">',
              '<option value="">Select an option...</option>',
              '<option value="Buying a vehicle">Buying a vehicle</option>',
              '<option value="Selling / trade-in">Selling / trade-in</option>',
              '<option value="Finance enquiry">Finance enquiry</option>',
              '<option value="Test drive">Test drive</option>',
              '<option value="General enquiry">General enquiry</option>',
            '</select></div>',

          /* --- optional blocks --- */
          vehicleBlock,
          tradeinBlock,
          financeBlock,
          locationBlock,

          /* --- message (always last) --- */
          '<div class="tf-field"><label for="tf-msg">Message</label>',
            '<textarea id="tf-msg" placeholder="How can we help?" rows="3"></textarea></div>',

          '<div class="tf-actions">',
            '<button type="button" class="tf-btn tf-btn-primary" id="tf-submit">',
              '<span class="tf-submit-ico">', mailSvg.replace('stroke="#fff"', 'stroke="#fff" style="width:16px;height:16px"'), '</span>',
              '<span class="tf-submit-label">Send Enquiry</span></button>',
            waActionBtn,
          '</div>',
        '</div>',

        /* success */
        '<div class="tf-success" role="status" aria-live="polite">',
          '<div class="tf-check">', checkSvg, '</div>',
          '<div class="tf-done-title" tabindex="-1">Enquiry sent!</div>',
          '<div class="tf-done-sub">A member of the <b>', esc(cfg.dealer), '</b> team will be in touch shortly.</div>',
          '<div class="tf-actions" style="justify-content:center">',
            cfg.wa ? '<button type="button" class="tf-btn tf-btn-wa" id="tf-wa">' + waSvg + ' WhatsApp Us</button>' : '',
            '<button type="button" class="tf-btn tf-btn-ghost" id="tf-reset">Send another</button>',
          '</div>',
        '</div>',

        /* error */
        '<div class="tf-error" role="alert" aria-live="assertive">',
          '<div class="tf-warn">', warnSvg, '</div>',
          '<div class="tf-done-title" tabindex="-1">Couldn\'t send that</div>',
          '<div class="tf-done-sub">Something went wrong sending your enquiry.', cfg.wa ? ' Reach us on WhatsApp, or try again.' : ' Please try again in a moment.', '</div>',
          '<div class="tf-actions" style="justify-content:center">',
            cfg.wa ? '<button type="button" class="tf-btn tf-btn-wa" id="tf-wa-err">' + waSvg + ' WhatsApp Us</button>' : '',
            '<button type="button" class="tf-btn tf-btn-ghost" id="tf-retry">Try again</button>',
          '</div>',
        '</div>',

        '<div class="tf-foot">Powered by <b>', esc(cfg.brand), '</b></div>',
      '</div>',
      '</div>'
    ].join('');

    shadow.appendChild(el(formHtml));

    var root = shadow.getElementById("tf");
    var panel = shadow.querySelector(".tf-panel");
    var launcher = shadow.querySelector(".tf-launcher");
    var closeBtn = shadow.querySelector(".tf-x");
    var submitBtn = shadow.getElementById("tf-submit");
    var resetBtn = shadow.getElementById("tf-reset");
    var retryBtn = shadow.getElementById("tf-retry");
    var waSuccessBtn = shadow.getElementById("tf-wa");
    var waErrBtn = shadow.getElementById("tf-wa-err");
    var waSendBtn = shadow.getElementById("tf-wa-send");

    /* ---- helpers ---- */
    function val(id) {
      var input = shadow.getElementById(id);
      return input ? input.value.trim() : "";
    }
    function setErr(id, show) {
      var f = shadow.getElementById(id);
      if (!f) return;
      var wrap = f.closest(".tf-field");
      if (wrap) wrap.classList.toggle("tf-err", show);
    }
    function isToggleOn(id) {
      var t = shadow.getElementById(id);
      return t && t.classList.contains("on");
    }
    function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

    /* ---- open / close + focus management ---- */
    function focusFirstField() {
      var first = shadow.getElementById("tf-fn");
      if (first) { try { first.focus(); } catch (e) {} }
    }
    /* Per-open lead source, so each surface that opens this form is
       distinguishable in Flow ("COC · VD Finance" vs the generic launcher).
       Reset on close so the next opener can't inherit the last one's label. */
    var openSource = "";

    /* ---- prefill ----------------------------------------------------
       TruDealer.open("form", payload) has always PASSED a payload
       (tru-loader.js) and open() has always IGNORED it, so every
       programmatic open produced a blank form — worse than the WhatsApp
       link it was meant to replace, because at least that named the car.
       This is that missing half.

       Accepted keys, all optional; anything whose field is not mounted
       (the vehicle/tradein/finance/location blocks are opt-in via
       data-fields) is skipped silently rather than throwing:

         vehicle   string  → "Which vehicle are you interested in?"
         interest  string  → the Interested-in dropdown, matched loosely
         message   string  → the message textarea
         finance   truthy  → opens the "Need finance?" block
         tradein   truthy  → opens the trade-in block
         source    string  → lead source recorded on submit

       Deliberately NOT accepting name / phone / email. A form that arrives
       with someone's personal details already in it is a form nobody
       checks before sending, and we would be guessing at values the
       caller cannot actually know. */
    function setField(id, value) {
      if (value == null || value === "") return;
      var el = shadow.getElementById(id);
      if (el) el.value = String(value);
    }
    function setSelect(id, value) {
      if (!value) return;
      var sel = shadow.getElementById(id);
      if (!sel) return;
      var want = String(value).toLowerCase();
      for (var i = 0; i < sel.options.length; i++) {
        var o = sel.options[i];
        if (o.value.toLowerCase() === want || o.text.toLowerCase() === want) { sel.selectedIndex = i; return; }
      }
      /* no exact hit — fall back to a contains match so a caller passing
         "finance" still lands on "Finance enquiry" */
      for (var j = 0; j < sel.options.length; j++) {
        if (sel.options[j].value && sel.options[j].value.toLowerCase().indexOf(want) !== -1) { sel.selectedIndex = j; return; }
      }
    }
    function setToggle(toggleId, expandId, on) {
      if (!on) return;
      var tog = shadow.getElementById(toggleId), exp = shadow.getElementById(expandId);
      if (!tog || !exp) return;
      tog.classList.add("on");
      exp.classList.add("on");
      tog.setAttribute("aria-pressed", "true");
    }
    function applyPayload(p) {
      setField("tf-veh", p.vehicle);
      setField("tf-msg", p.message);
      setSelect("tf-interest", p.interest);
      setToggle("tf-finance-toggle", "tf-finance-fields", p.finance);
      setToggle("tf-tradein-toggle", "tf-tradein-fields", p.tradein);
      if (p.source) openSource = String(p.source);
    }

    function open(payload) {
      /* The launcher binds this as a click handler, so `payload` is a
         MouseEvent on every manual open — typeof "object" is not enough of a
         test. Anything DOM-ish is an event, not a payload. */
      if (payload && typeof payload === "object" && !(payload instanceof Event)) applyPayload(payload);
      if (root.classList.contains("is-open") && !isInline) return;
      root.classList.add("is-open");
      /* Signal "a TruForm is open" on <body> so the host page can stand its
         other floating furniture down. Nothing outside can see `is-open` —
         it lives in the shadow tree — so without this the page has no hook.
         Measured on Cars on Caledon: the TruAfford pill (z 999990) sat on top
         of this panel (z 999980) covering the vehicle field. A distinct class
         rather than the conventional `modal-open`, because host pages already
         use that for their own modals and hiding this host on it would hide
         the form the instant it opened. */
      if (!isInline) document.body.classList.add("tf-open");
      if (launcher) launcher.setAttribute("aria-expanded", "true");
      if (!isInline) setTimeout(focusFirstField, 60);
    }
    function close() {
      if (isInline) return;
      openSource = "";   // next opener must not inherit this one's lead source
      document.body.classList.remove("tf-open");
      root.classList.remove("is-open", "is-sent", "is-error");
      if (launcher) {
        launcher.setAttribute("aria-expanded", "false");
        try { launcher.focus(); } catch (e) {}
      }
    }
    if (launcher) launcher.addEventListener("click", function () { open(); });
    if (closeBtn) closeBtn.addEventListener("click", close);

    /* Esc to close + basic focus trap (float only) */
    if (!isInline) {
      panel.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); close(); return; }
        if (e.key !== "Tab") return;
        var f = shadow.querySelectorAll(
          '.tf-panel button, .tf-panel input, .tf-panel textarea, .tf-panel select'
        );
        var list = Array.prototype.filter.call(f, function (n) {
          return !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null;
        });
        if (!list.length) return;
        var firstEl = list[0], lastEl = list[list.length - 1];
        if (e.shiftKey && shadow.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && shadow.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      });
    }

    /* ---- toggle wiring ---- */
    function wireToggle(toggleId, expandId) {
      var tog = shadow.getElementById(toggleId);
      var exp = shadow.getElementById(expandId);
      if (!tog || !exp) return;
      tog.addEventListener("click", function () {
        var on = !tog.classList.contains("on");
        tog.classList.toggle("on", on);
        exp.classList.toggle("on", on);
        tog.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    wireToggle("tf-tradein-toggle", "tf-tradein-fields");
    wireToggle("tf-finance-toggle", "tf-finance-fields");

    /* ---- validation ---- */
    function validate() {
      var ok = true;
      if (!val("tf-fn")) { setErr("tf-fn", true); ok = false; } else { setErr("tf-fn", false); }
      var ph = val("tf-ph").replace(/[\s()-]/g, "");
      if (!/^\+?\d{7,15}$/.test(ph)) { setErr("tf-ph", true); ok = false; } else { setErr("tf-ph", false); }
      var em = val("tf-em");
      if (em && !isEmail(em)) { setErr("tf-em", true); ok = false; } else { setErr("tf-em", false); }
      if (!ok) {
        var firstBad = shadow.querySelector(".tf-field.tf-err input, .tf-field.tf-err textarea, .tf-field.tf-err select");
        if (firstBad) { try { firstBad.focus(); } catch (e) {} }
      }
      return ok;
    }

    function looksLikeBot() {
      /* Honeypot filled, or submitted implausibly fast after page load. */
      return !!val("tf-company") || (Date.now() - mountedAt < 1200);
    }

    /* ---- payload ---- */
    function buildNotes() {
      var parts = [];
      if (val("tf-interest")) parts.push("Interest: " + val("tf-interest"));
      if (val("tf-veh")) parts.push("Vehicle: " + val("tf-veh"));
      if (isToggleOn("tf-tradein-toggle")) {
        var ti = [val("tf-ti-year"), val("tf-ti-make"), val("tf-ti-model")].filter(Boolean).join(" ");
        if (ti) parts.push("Trade-in: " + ti + (val("tf-ti-km") ? " (" + val("tf-ti-km") + " km)" : ""));
      }
      if (isToggleOn("tf-finance-toggle")) {
        var fi = [];
        if (val("tf-fi-employment")) fi.push(val("tf-fi-employment"));
        if (val("tf-fi-deposit")) fi.push("Deposit: " + val("tf-fi-deposit"));
        if (fi.length) parts.push("Finance: " + fi.join(", "));
      }
      if (val("tf-loc")) parts.push("Location: " + val("tf-loc"));
      if (val("tf-msg")) parts.push(val("tf-msg"));
      return parts.join("\n") || "Contact form enquiry";
    }

    function buildPayload(source) {
      return {
        dealerSlug: cfg.slug,
        firstName: val("tf-fn") || "Website",
        lastName: val("tf-ln") || "Lead",
        phone: val("tf-ph"),
        email: val("tf-em"),
        /* openSource is set by open({source}) — it names the surface that
           opened the form, so "COC · VD Finance" is distinguishable from the
           generic launcher in Flow. An explicit argument still wins. */
        source: source || openSource || "TruForm Contact",
        notes: buildNotes()
      };
    }

    function buildWhatsAppMsg() {
      var lines = ["Hi " + cfg.dealer + ",", "", "I just submitted an enquiry on your site."];
      if (val("tf-fn")) lines.push("Name: " + (val("tf-fn") + " " + val("tf-ln")).trim());
      if (val("tf-ph")) lines.push("Phone: " + val("tf-ph"));
      if (val("tf-interest")) lines.push("Interest: " + val("tf-interest"));
      if (val("tf-veh")) lines.push("Vehicle: " + val("tf-veh"));
      if (isToggleOn("tf-tradein-toggle")) {
        var ti = [val("tf-ti-year"), val("tf-ti-make"), val("tf-ti-model")].filter(Boolean).join(" ");
        if (ti) lines.push("Trade-in: " + ti);
      }
      if (isToggleOn("tf-finance-toggle")) lines.push("Finance: needed");
      if (val("tf-loc")) lines.push("Location: " + val("tf-loc"));
      if (val("tf-msg")) lines.push("Message: " + val("tf-msg"));
      lines.push("", "Looking forward to hearing from you.");
      return lines.join("\n");
    }

    /* ---- network: returns a promise<boolean> for a real delivery ---- */
    function postLead(source) {
      cmbNotify(cfg, source || "TruForm", buildNotes());
      if (!(cfg.webhook || (cfg.slug && cfg.flowUrl))) return Promise.resolve(false);
      var leadUrl = cfg.webhook || (cfg.flowUrl.replace(/\/$/, "") + "/api/integration/webhook-lead");
      var ctrl = ("AbortController" in window) ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 10000) : null;
      return fetch(leadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(source)),
        mode: "cors",
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        return !!(res && res.ok);
      }).catch(function () {
        if (timer) clearTimeout(timer);
        return false;
      });
    }

    function showState(cls) {
      root.classList.remove("is-sent", "is-error");
      if (cls) root.classList.add(cls);
      var focusEl = shadow.querySelector((cls === "is-error" ? ".tf-error" : ".tf-success") + " .tf-done-title");
      if (focusEl) { try { focusEl.focus(); } catch (e) {} }
    }

    function setBusy(btn, busy, busyLabel, idleHtml) {
      if (!btn) return;
      btn.disabled = busy;
      if (busy) btn.innerHTML = '<span class="tf-spin"></span> ' + busyLabel;
      else btn.innerHTML = idleHtml;
    }

    var submitIdle = '<span class="tf-submit-ico">' + mailSvg.replace('stroke="#fff"', 'stroke="#fff" style="width:16px;height:16px"') + '</span><span class="tf-submit-label">Send Enquiry</span>';

    /* ---- submit (Send Enquiry) ---- */
    submitBtn.addEventListener("click", function () {
      if (!validate()) return;

      /* Bots: silently accept in the UI, never reach the CRM. */
      if (looksLikeBot()) { showState("is-sent"); return; }

      setBusy(submitBtn, true, "Sending…", submitIdle);
      postLead("TruForm Contact").then(function (ok) {
        setBusy(submitBtn, false, "", submitIdle);
        showState(ok ? "is-sent" : "is-error");
      });
    });

    /* ---- WhatsApp send (also files the lead, like TruAfford) ---- */
    function waSend() {
      if (!validate()) return;
      var url = "https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(buildWhatsAppMsg());
      /* Open synchronously so the tap isn't blocked as a popup. */
      window.open(url, "_blank", "noopener");
      if (!looksLikeBot()) postLead("TruForm Contact (WhatsApp)");
      showState("is-sent");
    }
    if (waSendBtn) waSendBtn.addEventListener("click", waSend);
    if (waSuccessBtn) waSuccessBtn.addEventListener("click", function () {
      window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(buildWhatsAppMsg()), "_blank", "noopener");
    });
    if (waErrBtn) waErrBtn.addEventListener("click", function () {
      window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(buildWhatsAppMsg()), "_blank", "noopener");
    });

    /* ---- retry (from error) ---- */
    if (retryBtn) retryBtn.addEventListener("click", function () {
      root.classList.remove("is-error");
      setTimeout(focusFirstField, 60);
    });

    /* ---- reset (Send another) ---- */
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        root.classList.remove("is-sent", "is-error");
        var ids = ["tf-fn", "tf-ln", "tf-ph", "tf-em", "tf-msg", "tf-veh", "tf-loc",
                   "tf-ti-year", "tf-ti-make", "tf-ti-model", "tf-ti-km", "tf-company"];
        ids.forEach(function (id) {
          var inp = shadow.getElementById(id);
          if (inp) inp.value = "";
          setErr(id, false);
        });
        ["tf-interest", "tf-fi-employment", "tf-fi-deposit"].forEach(function (id) {
          var sel = shadow.getElementById(id);
          if (sel) sel.selectedIndex = 0;
        });
        ["tf-tradein-toggle", "tf-finance-toggle"].forEach(function (id) {
          var tog = shadow.getElementById(id);
          if (tog) { tog.classList.remove("on"); tog.setAttribute("aria-pressed", "false"); }
        });
        ["tf-tradein-fields", "tf-finance-fields"].forEach(function (id) {
          var exp = shadow.getElementById(id);
          if (exp) exp.classList.remove("on");
        });
        setTimeout(focusFirstField, 60);
      });
    }

    /* ---- register instance for programmatic control ---- */
    var api = { open: open, close: close, root: root, instance: INSTANCE };
    var reg = window.TruForm || { instances: [] };
    if (!reg.instances) reg.instances = [];
    reg.instances.push(api);
    reg.open = function (payload) { var i = reg.instances[reg.instances.length - 1]; if (i) i.open(payload); };
    reg.close = function () { var i = reg.instances[reg.instances.length - 1]; if (i) i.close(); };
    window.TruForm = reg;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
