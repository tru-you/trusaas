/**
 * TruBook (Property) — viewing booking widget (TruSaaS)
 *
 * Drop-in for agency websites. Same plumbing as the automotive TruBook:
 * shadow-DOM isolation, accent theming, date/time grid, webhook lead.
 * Content switched to property: in-person viewings, open houses, virtual tours.
 *
 * Drop-in:
 *   <script src="/widgets/tru-book.js"
 *           data-agency="stone-heights"
 *           data-wa="27123456789"
 *           data-accent="#0E9D98"
 *           data-property="prop_abc123"
 *           data-address="12 Oak Avenue, Rosebank"></script>
 */
(function () {
  "use strict";
  if (window.__TruBookLoaded) return;
  window.__TruBookLoaded = true;

  var scr = document.currentScript || document.querySelector("script[src*='tru-book']");
  function attr(name, fallback) {
    return (scr && scr.getAttribute(name)) || fallback;
  }

  var cfg = {
    agency: attr("data-agency", ""),
    wa: attr("data-wa", ""),
    flowUrl: attr("data-flow", ""),
    propertyId: attr("data-property", ""),
    accent: attr("data-accent", "#0E9D98"),
    accent2: attr("data-accent-2", ""),
    address: attr("data-address", ""),
    brand: attr("data-brand", "TruSaaS"),
    z: attr("data-z", "999990"),
    bottom: attr("data-bottom", "88px"),
    position: attr("data-position", "right"),
  };

  var MODES = [
    { key: "viewing", label: "In-person viewing", mins: 45, sub: "We'll meet you at the property and walk you through every room." },
    { key: "openhouse", label: "Open house", mins: 120, sub: "Drop in on show day — no booking pressure, just come look." },
    { key: "virtual", label: "Virtual tour", mins: 30, sub: "Live video walkthrough from your phone. No travel needed." },
  ];

  var ID = "tru-book";
  var state = { open: false, step: 1, mode: "viewing", dateIdx: 0, timeIdx: -1, name: "", phone: "", email: "", sent: false, error: "" };

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

  var accent = parseHex(cfg.accent) || parseHex("#0E9D98");
  var accentBright = lighten(accent, 0.34);
  var accentDeep = darken(accent, 0.34);
  var accent2 = parseHex(cfg.accent2) || accentDeep;

  function dates() {
    var now = new Date();
    var out = [];
    for (var i = 1; i <= 6; i++) {
      var d = new Date(now); d.setDate(d.getDate() + i);
      out.push({ day: d.toLocaleDateString("en-ZA", { weekday: "short" }), date: d.getDate(), month: d.toLocaleDateString("en-ZA", { month: "short" }), iso: d });
    }
    return out;
  }
  function timesForDate(iso) {
    var d = new Date(iso);
    var out = [];
    var start = d.getDay() === 6 ? 8 : 8, end = d.getDay() === 6 ? 12 : 17;
    for (var h = start; h < end; h++) {
      out.push({ label: h + ":00", value: h + ":00" });
      if (h < end - 1) out.push({ label: h + ":30", value: h + ":30" });
    }
    return out;
  }

  var CSS = [
    ":host{all:initial;font-family:Inter,system-ui,sans-serif;box-sizing:border-box;position:fixed;z-index:" + cfg.z + ";bottom:" + cfg.bottom + ";" + (cfg.position === "left" ? "left:16px;right:auto;" : "right:16px;left:auto;") + "display:block;max-width:min(440px,calc(100vw - 24px));pointer-events:none}",
    "#" + ID + "-root{display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none;font-family:Inter,system-ui,sans-serif;box-sizing:border-box}",
    "#" + ID + "-root *{box-sizing:border-box}",
    "#" + ID + "-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}",
    "#" + ID + "-root .tb-launcher{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;border-radius:100px;background:linear-gradient(145deg,rgba(18,18,20,.92),rgba(15,15,19,.96));border:1px solid #2a2a30;color:#fff;box-shadow:0 12px 36px -10px rgba(0,0,0,.55);backdrop-filter:blur(18px) saturate(1.4);transition:transform .35s ease;max-width:260px;text-align:left}",
    "#" + ID + "-root .tb-launcher:hover{transform:translateY(-3px) scale(1.02)}",
    "#" + ID + "-root .tb-ico{width:40px;height:40px;border-radius:50%;flex-shrink:0;background:linear-gradient(115deg," + toHex(accentBright) + "," + toHex(accent) + " 48%," + toHex(accent2) + ");display:grid;place-items:center;box-shadow:0 6px 18px -4px rgba(0,0,0,.55)}",
    "#" + ID + "-root .tb-ico::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid " + toHex(accent) + "44;animation:tbPulse 2.2s ease-out infinite}",
    "@keyframes tbPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}",
    "#" + ID + "-root .tb-ltitle{display:block;font-size:13px;font-weight:700;line-height:1.2}",
    "#" + ID + "-root .tb-lsub{display:block;font-size:10px;color:#94A3B8;line-height:1.35;margin-top:2px;max-width:180px}",
    "#" + ID + "-root.is-open .tb-launcher{display:none}",
    "#" + ID + "-root .tb-panel{pointer-events:auto;display:none;flex-direction:column;width:min(440px,calc(100vw - 24px));max-height:min(78vh,680px);border-radius:20px;overflow:hidden;background:rgba(15,15,19,.85);backdrop-filter:blur(28px) saturate(1.5);border:1px solid #2a2a30;color:#F4F4F1;box-shadow:0 28px 70px -20px rgba(0,0,0,.65);opacity:0;transform:translateY(16px) scale(.96);transition:opacity .35s ease,transform .4s cubic-bezier(.34,1.4,.64,1)}",
    "#" + ID + "-root.is-open .tb-panel{display:flex;opacity:1;transform:none}",
    "#" + ID + "-root .tb-head{padding:14px;display:flex;align-items:center;gap:10px;background:linear-gradient(115deg," + toHex(accentBright) + "," + toHex(accent) + " 48%," + toHex(accent2) + ");border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}",
    "#" + ID + "-root .tb-head b{display:block;font-size:14px;font-weight:800}",
    "#" + ID + "-root .tb-x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.16);color:#fff;font-size:18px;display:grid;place-items:center;transition:background .2s}",
    "#" + ID + "-root .tb-x:hover{background:rgba(255,255,255,.26)}",
    "#" + ID + "-root .tb-body{padding:12px 14px 14px;overflow-y:auto;flex:1;min-height:0}",
    "#" + ID + "-root .tb-modes{display:flex;gap:4px;margin-bottom:14px;padding:4px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}",
    "#" + ID + "-root .tb-mode{padding:9px 10px;border-radius:9px;font-size:12px;font-weight:800;color:#94A3B8;transition:all .25s ease;flex:1;text-align:center}",
    "#" + ID + "-root .tb-mode.on{background:linear-gradient(115deg," + toHex(accentBright) + "," + toHex(accent) + ");color:#fff}",
    "#" + ID + "-root .tb-h{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}",
    "#" + ID + "-root .tb-p{font-size:12.5px;color:#94A3B8;line-height:1.5;margin:0 0 14px}",
    "#" + ID + "-root .tb-dates{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px}",
    "#" + ID + "-root .tb-date{padding:10px 4px;border-radius:10px;border:1px solid rgba(255,255,255,.1);text-align:center;font-size:11px;color:#94A3B8;transition:all .2s}",
    "#" + ID + "-root .tb-date.on{border-color:" + toHex(accent) + ";background:" + toHex(accent) + "22;color:#fff}",
    "#" + ID + "-root .tb-date .d{font-size:18px;font-weight:800;display:block}",
    "#" + ID + "-root .tb-times{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}",
    "#" + ID + "-root .tb-time{padding:7px 12px;border-radius:100px;border:1px solid rgba(255,255,255,.1);font-size:12px;color:#94A3B8;transition:all .2s}",
    "#" + ID + "-root .tb-time.on{border-color:" + toHex(accent) + ";background:" + toHex(accent) + ";color:#fff}",
    "#" + ID + "-root .tb-field{margin-bottom:12px}",
    "#" + ID + "-root .tb-field label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin-bottom:5px}",
    "#" + ID + "-root .tb-input{width:100%;padding:12px 13px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:600 14px Inter,system-ui,sans-serif;outline:none;transition:border-color .2s}",
    "#" + ID + "-root .tb-input:focus{border-color:" + toHex(accent) + "88}",
    "#" + ID + "-root .tb-summary{font-size:12px;color:#94A3B8;margin-bottom:14px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}",
    "#" + ID + "-root .tb-summary b{color:#fff}",
    "#" + ID + "-root .tb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:12px;font-weight:800;font-size:13px;width:100%;transition:transform .3s ease,box-shadow .3s}",
    "#" + ID + "-root .tb-btn:active{transform:scale(.97)}",
    "#" + ID + "-root .tb-btn-primary{background:linear-gradient(115deg," + toHex(accentBright) + "," + toHex(accent) + ");color:#fff;box-shadow:0 10px 26px -10px " + toHex(accent) + "88}",
    "#" + ID + "-root .tb-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px)}",
    "#" + ID + "-root .tb-btn-wa{background:linear-gradient(145deg,#25D366,#059669);color:#fff;box-shadow:0 10px 26px -10px rgba(16,185,129,.45)}",
    "#" + ID + "-root .tb-btn-ghost{background:rgba(255,255,255,.06);color:#94A3B8;border:1px solid rgba(255,255,255,.1)}",
    "#" + ID + "-root .tb-success{text-align:center;padding:10px 0}",
    "#" + ID + "-root .tb-success svg{color:#22C55E;margin-bottom:8px}",
    "#" + ID + "-root .tb-error{font-size:12px;color:#C06666;background:rgba(192,102,102,.1);padding:10px;border-radius:10px;text-align:center}",
    "#" + ID + "-root .tb-foot{padding:10px 14px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;text-align:center;font-size:10px;color:#94A3B8}",
    "@media (max-width:420px){#" + ID + "-root{right:12px;left:12px;align-items:stretch}}"  
  ].join("");

  /* ---------- shadow DOM ---------- */
  var shadow = null;
  function $(sel) { return shadow ? shadow.querySelector(sel) : null; }
  function $$(sel) { return shadow ? Array.prototype.slice.call(shadow.querySelectorAll(sel)) : []; }
  function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  var mode = MODES[0];

  function render() {
    var body = $("#" + ID + "-body");
    if (!body) return;
    mode = MODES.find(function (m) { return m.key === state.mode; }) || MODES[0];
    var ds = dates();
    var ts = timesForDate(ds[state.dateIdx].iso);
    var slot = state.timeIdx >= 0 && ts[state.timeIdx] ? ds[state.dateIdx].day + " " + ds[state.dateIdx].date + " " + ds[state.dateIdx].month + " · " + ts[state.timeIdx].value + " (" + mode.mins + " min)" : null;
    var canBook = !!state.name.trim() && state.phone.length >= 9 && slot;

    var html = "";
    if (state.sent) {
      html = '<div class="tb-success"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M7 12l3 3 7-7"/></svg><div class="tb-h" style="margin-top:8px">Booked!</div><p class="tb-p">We\'ll confirm your viewing shortly. The agent will be in touch.</p></div>';
      if (cfg.wa) html += '<button class="tb-btn tb-btn-wa" id="tb-wa">Chat on WhatsApp</button>';
    } else if (state.error) {
      html = '<div class="tb-error">' + esc(state.error) + '</div><button class="tb-btn tb-btn-primary" id="tb-retry">Try again</button>';
    } else {
      html += '<div class="tb-modes">' + MODES.map(function (m, i) { return '<button class="tb-mode' + (state.mode === m.key ? " on" : "") + '" data-mode="' + m.key + '">' + m.label + '</button>'; }).join("") + '</div>';
      html += '<div class="tb-h">' + mode.label + '</div><p class="tb-p">' + mode.sub + '</p>';
      html += '<div class="tb-dates">' + ds.map(function (d, i) { return '<button class="tb-date' + (state.dateIdx === i ? " on" : "") + '" data-date="' + i + '"><span class="d">' + d.date + '</span>' + d.day + '</button>'; }).join("") + '</div>';
      html += '<div class="tb-times">' + ts.map(function (t, i) { return '<button class="tb-time' + (state.timeIdx === i ? " on" : "") + '" data-time="' + i + '">' + t.value + '</button>'; }).join("") + '</div>';
      if (slot) html += '<div class="tb-summary">You\'re booking: <b>' + mode.label + '</b> — <b>' + slot + '</b></div>';
      html += '<div class="tb-field"><label>Full name *</label><input class="tb-input" id="tb-name" placeholder="Your full name" value="' + esc(state.name) + '"></div>';
      html += '<div class="tb-field"><label>Mobile *</label><input class="tb-input" id="tb-phone" type="tel" placeholder="071 222 3333" value="' + esc(state.phone) + '"></div>';
      html += '<div class="tb-field"><label>Email</label><input class="tb-input" id="tb-email" type="email" placeholder="you@example.com" value="' + esc(state.email) + '"></div>';
      html += '<button class="tb-btn tb-btn-primary" id="tb-submit"' + (canBook ? "" : " disabled style='opacity:.4'") + '>Confirm viewing</button>';
    }

    body.innerHTML = html;
    bind();
  }

  function bind() {
    var modes = $$(".tb-mode");
    for (var i = 0; i < modes.length; i++) (function (el) {
      el.addEventListener("click", function () { state.mode = el.getAttribute("data-mode"); state.timeIdx = -1; render(); });
    })(modes[i]);
    var datesBtn = $$(".tb-date");
    for (var j = 0; j < datesBtn.length; j++) (function (el) {
      el.addEventListener("click", function () { state.dateIdx = +el.getAttribute("data-date"); state.timeIdx = -1; render(); });
    })(datesBtn[j]);
    var timesBtn = $$(".tb-time");
    for (var k = 0; k < timesBtn.length; k++) (function (el) {
      el.addEventListener("click", function () { state.timeIdx = +el.getAttribute("data-time"); render(); });
    })(timesBtn[k]);
    var submit = $("#tb-submit");
    if (submit) submit.addEventListener("click", function () { state.name = ($("#tb-name") || { value: "" }).value; state.phone = ($("#tb-phone") || { value: "" }).value; state.email = ($("#tb-email") || { value: "" }).value; post(); });
    var retry = $("#tb-retry");
    if (retry) retry.addEventListener("click", function () { state.error = ""; render(); });
    var wa = $("#tb-wa");
    if (wa) wa.addEventListener("click", function () {
      if (!cfg.wa) return;
      window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent("Hi — I'd like to book a " + mode.label + ". Name: " + state.name + " Phone: " + state.phone), "_blank", "noopener");
    });
    var name = $("#tb-name"); if (name) name.addEventListener("input", function () { state.name = name.value; });
    var phone = $("#tb-phone"); if (phone) phone.addEventListener("input", function () { state.phone = phone.value; });
    var email = $("#tb-email"); if (email) email.addEventListener("input", function () { state.email = email.value; });
  }

  function post() {
    if (!cfg.agency) { state.error = "No agency configured."; render(); return; }
    state.error = "";
    var flow = (cfg.flowUrl || window.location.origin).replace(/\/$/, "");
    var ds = dates();
    var ts = timesForDate(ds[state.dateIdx].iso);
    var slot = ts[state.timeIdx] ? ds[state.dateIdx].day + " " + ds[state.dateIdx].date + " " + ds[state.dateIdx].month + " " + ts[state.timeIdx].value : "";
    var msg = "Viewing: " + mode.label + "\nWhen: " + slot + "\nName: " + state.name + "\nPhone: " + state.phone + (state.email ? "\nEmail: " + state.email : "");
    try {
      fetch(flow + "/api/prop/webhook/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency: cfg.agency, name: state.name, contact: state.phone, email: state.email, message: msg, propertyId: cfg.propertyId || "", source: "TruBook widget" }),
        mode: "cors", keepalive: true,
      }).then(function (r) {
        if (!r.ok) { state.error = "Couldn't reach the server. Try WhatsApp instead."; render(); }
        else { state.sent = true; render(); }
      }).catch(function () { state.error = "Network error. Try WhatsApp instead."; render(); });
    } catch (e) { state.error = "Something went wrong."; render(); }
  }

  function mount() {
    var host = document.createElement("div");
    host.id = ID + "-host";
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);

    var calIco = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

    var root = el(
      '<div id="' + ID + '-root" data-app="trubook" aria-live="polite">' +
        '<div class="tb-panel" role="dialog" aria-hidden="true">' +
          '<div class="tb-head"><div class="tb-ico">' + calIco + '</div><div><b>Book a Viewing</b><span style="font-size:11px;opacity:.9">' + esc(cfg.agency) + '</span></div><button class="tb-x" id="' + ID + '-close">×</button></div>' +
          '<div class="tb-body" id="' + ID + '-body"></div>' +
          '<div class="tb-foot">Powered by <b style="color:' + toHex(accentBright) + '">' + esc(cfg.brand) + ' TruBook</b></div>' +
        '</div>' +
        '<button class="tb-launcher" id="' + ID + '-open"><span class="tb-ico">' + calIco + '</span><span><span class="tb-ltitle">Book a Viewing</span><span class="tb-lsub">Pick a day and time — we take it from there.</span></span></button>' +
      '</div>'
    );
    shadow.appendChild(root);

    $("#" + ID + "-open").addEventListener("click", function () { state.open = true; (shadow.getElementById(ID + "-root")).classList.add("is-open"); $(".tb-panel").setAttribute("aria-hidden", "false"); render(); });
    $("#" + ID + "-close").addEventListener("click", function () { state.open = false; (shadow.getElementById(ID + "-root")).classList.remove("is-open"); $(".tb-panel").setAttribute("aria-hidden", "true"); });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();