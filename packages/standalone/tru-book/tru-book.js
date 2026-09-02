/**
 * TruBook — Canonical Booking & Appointment Widget (TruDealer / TruSaaS)
 *
 * CANONICAL SOURCE.
 * Drop-in appointment booking widget for showroom visits, test drives, and workshop trade-ins.
 * Supports configurable dealer branding, CRM lead webhook delivery via dealer slug,
 * automatic calendar (.ics) generation, and WhatsApp confirmation.
 *
 * Attributes:
 *   data-dealer   Dealer name
 *   data-slug     Dealership slug — REQUIRED to file a CRM lead
 *   data-flow     TruFlow origin — REQUIRED to file a CRM lead
 *   data-wa       WhatsApp number (digits only)
 *   data-accent   Brand primary color (replaces hardcoded red/brand colors)
 *   data-address  Dealer physical address
 *   data-brand    Footer credit (default "Powered by TruDealer")
 */
(function (root) {
  "use strict";

  if (root.TruBookLoaded) return;
  root.TruBookLoaded = true;

  var script =
    document.currentScript ||
    (function () {
      var list = document.getElementsByTagName("script");
      return list[list.length - 1];
    })();

  function attr(name, fallback) {
    return (script && script.getAttribute(name)) || fallback;
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
    accent: attr("data-accent", "#1466E0"),
    address: attr("data-address", "Showroom Branch"),
    brand: attr("data-brand", "Powered by TruDealer"),
    theme: attr("data-theme", "dark")
  };

  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var MODES = {
    showroom: {
      label: "Showroom visit",
      title: "Book a showroom visit",
      sub: "Come see it in person at " + cfg.address + ". Coffee's on us — no pressure, no hard sell.",
      dur: 60,
      ev: "Showroom visit — " + cfg.dealer,
      loc: cfg.address
    },
    live: {
      label: "Test drive",
      title: "Book a test drive",
      sub: "Reserve the car and a driver — we'll have it fuelled, out front and ready when you arrive.",
      dur: 45,
      ev: "Test drive — " + cfg.dealer,
      loc: cfg.address
    },
    tradein: {
      label: "Workshop trade-in",
      title: "TruInspect Workshop Trade-In",
      sub: "Drive your car in for a 20-minute TruInspect grading. Our buyer walks it with you and hands over a firm offer.",
      dur: 30,
      ev: "TruInspect workshop trade-in — " + cfg.dealer,
      loc: cfg.address
    }
  };

  function buildSlots() {
    var out = [], now = new Date(), i = 1;
    while (out.length < 6 && i < 14) {
      var d = new Date(now);
      d.setDate(d.getDate() + i);
      i++;
      if (d.getDay() === 0) continue; // Closed Sundays
      out.push({
        date: d,
        dow: DAYS[d.getDay()],
        dm: d.getDate() + " " + MONTHS[d.getMonth()],
        times: d.getDay() === 6
          ? ["08:30", "09:30", "10:30", "11:30"]
          : ["08:30", "09:30", "10:30", "11:30", "14:00", "15:00", "16:00", "17:00"]
      });
    }
    return out;
  }

  var bg = null, slots = [], selDay = 0, selTime = "", mode = "showroom", car = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function injectStyle() {
    if (document.getElementById("trubook-style")) return;
    var s = document.createElement("style");
    s.id = "trubook-style";
    /* Themed via CSS custom properties on .tb-modal so a cream site and a dark
       site share one stylesheet. NOTE: TruBook renders in the LIGHT DOM, so the
       host page's own `h3 { color: ... }` cascades in — every text colour here
       must be stated explicitly or the heading inherits the page's ink and
       disappears against the modal. */
    var isLight = cfg.theme === "light";
    var T = isLight ? {
      scrim:  "rgba(14,26,38,0.42)",
      panel:  "linear-gradient(165deg, rgba(251,248,243,0.92) 0%, rgba(244,240,232,0.96) 100%)",
      edge:   "rgba(14,26,38,0.12)",
      ink:    "#0E1A26",
      quiet:  "rgba(14,26,38,0.70)",
      mute:   "rgba(14,26,38,0.52)",
      fill:   "rgba(14,26,38,0.07)",
      fill2:  "rgba(14,26,38,0.14)",
      onAcc:  "#FBF8F3",
      shadow: "0 32px 80px -16px rgba(14,26,38,0.35)"
    } : {
      scrim:  "rgba(6,8,13,0.78)",
      panel:  "linear-gradient(165deg, rgba(20,24,35,0.96) 0%, rgba(12,14,22,0.98) 100%)",
      edge:   "rgba(255,255,255,0.12)",
      ink:    "#f8fafc",
      quiet:  "#cbd5e1",
      mute:   "#94a3b8",
      fill:   "rgba(255,255,255,0.05)",
      fill2:  "rgba(255,255,255,0.12)",
      onAcc:  "#fff",
      shadow: "0 32px 80px -16px rgba(0,0,0,0.8)"
    };

    s.textContent = [
      ".tb-bg{position:fixed;inset:0;background:", T.scrim, ";backdrop-filter:blur(10px) saturate(1.4);-webkit-backdrop-filter:blur(10px) saturate(1.4);z-index:999985;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity 0.25s ease}",
      ".tb-bg.open{opacity:1;pointer-events:auto}",
      ".tb-modal{background:", T.panel, ";backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);border:1px solid ", T.edge, ";border-radius:24px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:28px;color:", T.ink, ";box-shadow:", T.shadow, ";font-family:Inter,system-ui,sans-serif}",
      ".tb-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}",
      ".tb-head h3{margin:0;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:", T.ink, ";font-family:inherit}",
      ".tb-close{background:", T.fill, ";border:1px solid ", T.edge, ";color:", T.mute, ";border-radius:12px;width:36px;height:36px;font-size:20px;cursor:pointer;display:grid;place-items:center;transition:all 0.2s}",
      ".tb-close:hover{color:", T.ink, ";background:", T.fill2, "}",
      ".tb-sub{font-size:14px;color:", T.quiet, ";line-height:1.5;margin-bottom:20px}",
      ".tb-modes{display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px}",
      ".tb-mode{padding:10px 16px;border-radius:12px;background:", T.fill, ";border:1px solid ", T.edge, ";font-size:13px;font-weight:600;color:", T.quiet, ";cursor:pointer;white-space:nowrap;transition:all 0.2s}",
      ".tb-mode.on{background:", cfg.accent, ";color:", T.onAcc, ";border-color:transparent;box-shadow:0 6px 20px -4px ", cfg.accent, "80}",
      ".tb-label{font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:", T.mute, ";margin:16px 0 10px}",
      ".tb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}",
      ".tb-slot{padding:12px;border-radius:14px;background:", T.fill, ";border:1px solid ", T.edge, ";text-align:center;cursor:pointer;font-size:13px;font-weight:600;color:", T.ink, ";transition:all 0.2s}",
      ".tb-slot .day{font-size:11px;color:", T.mute, ";margin-bottom:4px;text-transform:uppercase}",
      ".tb-slot.on{background:", cfg.accent, ";color:", T.onAcc, ";border-color:transparent;box-shadow:0 4px 16px -2px ", cfg.accent, "60}",
      ".tb-slot.on .day{color:", T.onAcc, ";opacity:.8}",
      ".tb-fields{display:flex;flex-direction:column;gap:12px;margin-top:12px}",
      ".tb-fields input{width:100%;padding:14px 16px;border-radius:14px;background:", T.fill, ";border:1px solid ", T.edge, ";color:", T.ink, ";font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s}",
      ".tb-fields input::placeholder{color:", T.mute, "}",
      ".tb-fields input:focus{border-color:", cfg.accent, "}",
      ".tb-fields input.err{border-color:#B91C1C}",
      ".tb-when{margin-top:18px;padding:14px 16px;border-radius:14px;background:", T.fill, ";border:1px solid ", T.edge, ";font-size:13px;color:", T.quiet, ";display:flex;align-items:center;gap:10px}",
      ".tb-btn{width:100%;margin-top:20px;padding:16px;border-radius:16px;background:", cfg.accent, ";color:", T.onAcc, ";border:none;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 8px 24px -4px ", cfg.accent, "80;transition:all 0.2s}",
      ".tb-btn:hover{transform:translateY(-2px)}",
      ".tb-foot{text-align:center;font-size:12px;color:", T.mute, ";margin-top:16px}"
    ].join("");
    document.head.appendChild(s);
  }

  function ensureBg() {
    if (bg) return bg;
    injectStyle();
    bg = document.createElement("div");
    bg.className = "tb-bg";
    bg.id = "truBookBg";
    document.body.appendChild(bg);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    return bg;
  }

  function close() {
    if (!bg) return;
    bg.classList.remove("open");
  }

  function timeGridHtml(day) {
    return slots[day].times.map(function (t, i) {
      return '<div class="tb-slot' + (i === 0 ? " on" : "") + '" data-time="' + t + '" role="button">' + t + "</div>";
    }).join("");
  }

  function paint() {
    var m = MODES[mode];
    selTime = slots[selDay].times[0];

    bg.innerHTML = '<div class="tb-modal">'
      + '<div class="tb-head"><h3>' + esc(m.title) + '</h3><button class="tb-close" id="tbClose">&times;</button></div>'
      + '<div class="tb-sub">' + esc(m.sub) + '</div>'
      + '<div class="tb-modes" id="tbModes">'
      + Object.keys(MODES).map(function (k) {
        return '<div class="tb-mode' + (k === mode ? " on" : "") + '" data-mode="' + k + '">' + MODES[k].label + '</div>';
      }).join("")
      + '</div>'
      + '<div class="tb-label">Select Date</div>'
      + '<div class="tb-grid" id="tbDays">'
      + slots.map(function (s, i) {
        return '<div class="tb-slot' + (i === selDay ? " on" : "") + '" data-day="' + i + '">'
          + '<div class="day">' + s.dow + '</div>' + s.dm + '</div>';
      }).join("")
      + '</div>'
      + '<div class="tb-label">Select Time</div>'
      + '<div class="tb-grid" id="tbTimes">' + timeGridHtml(selDay) + '</div>'
      + '<div class="tb-label">Your Details</div>'
      + '<div class="tb-fields">'
      + '<input id="tbName" placeholder="Full Name" required>'
      + '<input id="tbPhone" placeholder="Mobile Number" inputmode="tel" required>'
      + '</div>'
      + '<div class="tb-when" id="tbWhen"></div>'
      + '<button class="tb-btn" id="tbConfirm">Confirm Appointment</button>'
      + '<div class="tb-foot">' + esc(cfg.brand) + '</div>'
      + '</div>';

    bind();
    paintWhen();
  }

  function paintWhen() {
    var el = document.getElementById("tbWhen");
    if (!el) return;
    var s = slots[selDay];
    el.innerHTML = '<span><b>' + s.dow + ' ' + s.dm + ' &middot; ' + selTime + '</b> (' + MODES[mode].dur + ' min)</span>';
  }

  function bind() {
    document.getElementById("tbClose").addEventListener("click", close);

    document.getElementById("tbModes").addEventListener("click", function (e) {
      var el = e.target.closest(".tb-mode");
      if (el) { mode = el.getAttribute("data-mode"); paint(); }
    });

    var days = document.getElementById("tbDays");
    var times = document.getElementById("tbTimes");

    days.addEventListener("click", function (e) {
      var el = e.target.closest(".tb-slot");
      if (el) {
        selDay = +el.getAttribute("data-day");
        Array.prototype.forEach.call(days.querySelectorAll(".tb-slot"), function (x) { x.classList.remove("on"); });
        el.classList.add("on");
        times.innerHTML = timeGridHtml(selDay);
        selTime = slots[selDay].times[0];
        paintWhen();
      }
    });

    times.addEventListener("click", function (e) {
      var el = e.target.closest(".tb-slot");
      if (el) {
        selTime = el.getAttribute("data-time");
        Array.prototype.forEach.call(times.querySelectorAll(".tb-slot"), function (x) { x.classList.remove("on"); });
        el.classList.add("on");
        paintWhen();
      }
    });

    document.getElementById("tbConfirm").addEventListener("click", confirm);
  }

  function confirm() {
    var nameEl = document.getElementById("tbName");
    var phoneEl = document.getElementById("tbPhone");
    var name = nameEl.value.trim(), phone = phoneEl.value.trim();

    nameEl.classList.toggle("err", !name);
    phoneEl.classList.toggle("err", phone.length < 9);
    if (!name || phone.length < 9) return;

    var s = slots[selDay], m = MODES[mode];
    var when = s.dow + " " + s.dm + " at " + selTime;
    var notes = "Booking: " + m.label + "\nWhen: " + when + "\nName: " + name + "\nPhone: " + phone;
    cmbNotify(cfg, "TruBook", notes);

    // Send CRM Webhook — data-webhook (standalone) or data-flow (TruFlow)
    if (cfg.webhook || (cfg.slug && cfg.flowUrl)) {
      var names = name.split(/\s+/);
      var leadUrl = cfg.webhook || (cfg.flowUrl.replace(/\/$/, "") + "/api/integration/webhook-lead");
      try {
        fetch(leadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealerSlug: cfg.slug,
            firstName: names[0] || "TruBook",
            lastName: names.slice(1).join(" ") || "Lead",
            phone: phone,
            source: "TruBook Widget",
            notes: notes
          }),
          mode: "cors",
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }

    if (cfg.wa) {
      var text = "Hi " + cfg.dealer + " — I'd like to book a " + m.label + ".\nWhen: " + when + "\nName: " + name + "\nPhone: " + phone;
      window.open("https://wa.me/" + cfg.wa + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    }

    close();
  }

  function open(opts) {
    opts = opts || {};
    ensureBg();
    slots = buildSlots();
    selDay = 0;
    mode = MODES[opts.mode] ? opts.mode : "showroom";
    car = opts.car || null;
    paint();
    bg.classList.add("open");
  }

  root.TruBook = { open: open, close: close };
})(window);
