/**
 * TruConcierge — mobile-only booking bottom-sheet for the VDP.
 *
 * Design source: `1d` in `Premium Concepts.dc.html` (TruCars handoff).
 * Not a replacement for TruBook — it's a lighter, personal entry point
 * (agent card, three quick slots, WhatsApp/Call fallbacks) that hands the
 * confirmed slot off to TruBook so bookings still land in one backend.
 *
 * Light DOM by design: it inherits site tokens (--ink, --accent, etc.) so
 * the sheet always matches the theme. TruBook is shadow-DOM; that isolation
 * is a fit for a full form, but a bottom-sheet is chrome and should follow
 * the page.
 *
 * Public API:  window.TruConcierge.open(vehicle, payload); .close();
 */
(function (root) {
  "use strict";
  if (root.__TruConciergeLoaded) return;
  root.__TruConciergeLoaded = true;

  var DEALER_NAME  = "Thandi";       // matches the design copy
  var DEALER_TITLE = "Truecars floor · online now";
  var WA_NUMBER    = "27620502091";
  var TEL_NUMBER   = "+27620502091";

  var bg = null, sheet = null, styleTag = null;
  var current = null;       // { v, payload }
  var slots = [], selIdx = 0;
  var callHintTimer = 0;

  /* ---- slot generator: same three visible slots as the design mock, but
     dates are dynamic so they never read as stale. Weekend priority per the
     "Drive it Saturday?" copy. */
  function buildSlots() {
    var now = new Date();
    var out = [];
    /* Next Friday 15:00 */
    var fri = new Date(now); fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7 || 7));
    fri.setHours(15, 0, 0, 0);
    /* Next Saturday 09:30 and 11:00 */
    var sat = new Date(fri); sat.setDate(fri.getDate() + 1);
    var sat1 = new Date(sat); sat1.setHours(9, 30, 0, 0);
    var sat2 = new Date(sat); sat2.setHours(11, 0, 0, 0);
    [fri, sat1, sat2].forEach(function (d) {
      out.push({
        day:  d.toLocaleDateString("en-ZA", { weekday: "short" }).toUpperCase(),
        time: d.toTimeString().slice(0, 5),
        iso:  d.toISOString(),
      });
    });
    return out;
  }

  /* Style is emitted once, appended to <head>. Uses site tokens throughout. */
  function ensureStyle() {
    if (styleTag) return;
    styleTag = document.createElement("style");
    styleTag.id = "truconcierge-style";
    styleTag.textContent = [
      ".tc-cnc-bg{position:fixed;inset:0;background:rgba(14,26,38,0.35);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:999990;opacity:0;pointer-events:none;transition:opacity 0.3s cubic-bezier(0.22,1,0.36,1)}",
      ".tc-cnc-bg.open{opacity:1;pointer-events:auto}",
      ".tc-cnc-sheet{position:fixed;left:0;right:0;bottom:0;z-index:999991;background:var(--paper,#FBF8F3);border-radius:22px 22px 0 0;box-shadow:0 -18px 50px rgba(14,26,38,0.3);padding:10px 22px 22px;transform:translateY(110%);transition:transform 0.4s cubic-bezier(0.22,1,0.36,1);max-height:88vh;overflow-y:auto}",
      ".tc-cnc-bg.open .tc-cnc-sheet{transform:translateY(0)}",
      ".tc-cnc-grip{width:40px;height:4px;border-radius:2px;background:rgba(14,26,38,0.15);margin:0 auto 16px}",
      /* agent row */
      ".tc-cnc-agent{display:flex;align-items:center;gap:12px}",
      ".tc-cnc-avatar{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#274156,#12202E);display:grid;place-items:center;font-family:'Fraunces',Georgia,serif;font-size:18px;color:#5DE9D4;flex:none}",
      ".tc-cnc-agent-txt{flex:1;min-width:0}",
      ".tc-cnc-agent-txt h3{margin:0;font-size:15px;font-weight:600;color:var(--ink,#0E1A26);font-family:inherit;letter-spacing:0}",
      ".tc-cnc-agent-txt p{margin:2px 0 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-mute,rgba(14,26,38,0.5))}",
      ".tc-cnc-live{width:9px;height:9px;border-radius:50%;background:var(--accent,#07879A);flex:none;animation:tccncPing 2.6s infinite}",
      "@keyframes tccncPing{0%{box-shadow:0 0 0 0 rgba(7,135,154,0.55)}70%{box-shadow:0 0 0 8px rgba(7,135,154,0)}100%{box-shadow:0 0 0 0 rgba(7,135,154,0)}}",
      /* slot pills */
      ".tc-cnc-slots{display:flex;gap:8px;margin-top:16px}",
      ".tc-cnc-slot{flex:1;text-align:center;padding:12px 6px;border-radius:12px;border:1.5px solid rgba(14,26,38,0.12);background:transparent;cursor:pointer;color:var(--ink,#0E1A26);font-family:inherit;transition:border-color .2s,background .2s}",
      ".tc-cnc-slot .day{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink-mute,rgba(14,26,38,0.5))}",
      ".tc-cnc-slot .time{font-size:16px;font-weight:600;margin-top:3px}",
      ".tc-cnc-slot.on{border-color:var(--accent,#07879A);background:rgba(7,135,154,0.06)}",
      ".tc-cnc-slot.on .day{color:var(--accent,#07879A)}",
      /* note */
      ".tc-cnc-note{margin-top:14px;background:rgba(7,135,154,0.06);border:1px solid rgba(7,135,154,0.18);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;color:var(--ink-quiet,rgba(14,26,38,0.75))}",
      /* CTA stack */
      ".tc-cnc-cta{display:flex;flex-direction:column;gap:9px;margin-top:16px}",
      ".tc-cnc-primary{display:flex;align-items:center;justify-content:center;gap:10px;min-height:50px;border-radius:100px;background:var(--accent,#07879A);color:var(--cream,#F4F0E8);font-size:15px;font-weight:600;border:0;cursor:pointer;font-family:inherit}",
      ".tc-cnc-primary .arrow{font-family:'Fraunces',Georgia,serif}",
      ".tc-cnc-primary:active{filter:brightness(.95)}",
      ".tc-cnc-row{display:flex;gap:8px}",
      ".tc-cnc-wa,.tc-cnc-call{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:100px;border:1px solid rgba(14,26,38,0.14);background:transparent;color:var(--ink-quiet,rgba(14,26,38,0.75));font-size:14px;font-family:inherit;text-decoration:none;cursor:pointer}",
      ".tc-cnc-wa{flex:1;gap:8px;font-weight:500}",
      ".tc-cnc-call{flex:none;width:48px;color:var(--ink,#0E1A26);font-weight:600;font-size:13px}",
      ".tc-cnc-hint{text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-mute,rgba(14,26,38,0.5));opacity:0;transition:opacity .2s}",
      ".tc-cnc-hint.on{opacity:1}",
      /* Never appear on desktop — only path in is the mobile ctaBook branch
         but a media guard keeps the widget safe if hand-invoked. */
      "@media (min-width:641px){.tc-cnc-bg,.tc-cnc-sheet{display:none!important}}"
    ].join("");
    document.head.appendChild(styleTag);
  }

  function ensureShell() {
    if (bg) return;
    ensureStyle();
    bg = document.createElement("div");
    bg.className = "tc-cnc-bg";
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    bg.setAttribute("aria-label", "Book a test drive");
    bg.innerHTML =
      '<div class="tc-cnc-sheet" id="tcCncSheet">' +
        '<div class="tc-cnc-grip" aria-hidden="true"></div>' +
        '<div class="tc-cnc-agent">' +
          '<div class="tc-cnc-avatar" aria-hidden="true">' + DEALER_NAME.charAt(0) + '</div>' +
          '<div class="tc-cnc-agent-txt"><h3 id="tcCncTitle">Drive it Saturday?</h3>' +
            '<p>' + DEALER_NAME + ' · ' + DEALER_TITLE + '</p></div>' +
          '<span class="tc-cnc-live" aria-hidden="true"></span>' +
        '</div>' +
        '<div class="tc-cnc-slots" id="tcCncSlots" role="radiogroup" aria-label="Choose a time"></div>' +
        '<div class="tc-cnc-note" id="tcCncNote"></div>' +
        '<div class="tc-cnc-cta">' +
          '<button type="button" class="tc-cnc-primary" id="tcCncConfirm">' +
            '<span id="tcCncConfirmLbl">Confirm</span> <span class="arrow" aria-hidden="true">→</span>' +
          '</button>' +
          '<div class="tc-cnc-row">' +
            '<a class="tc-cnc-wa" id="tcCncWa" target="_blank" rel="noopener">' +
              'Ask ' + DEALER_NAME + ' on WhatsApp instead' +
            '</a>' +
            /* Single tap shows hint, double tap dials. Design's double-click
               pattern needs a single-tap fallback for accessibility — the
               hint IS that fallback: it explains what a second tap does. */
            '<button type="button" class="tc-cnc-call" id="tcCncCall" aria-label="Call — double tap to dial">Call</button>' +
          '</div>' +
          '<div class="tc-cnc-hint" id="tcCncHint" aria-live="polite">Double-tap to call ' + DEALER_NAME + ' directly</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);

    /* backdrop tap closes; taps inside sheet don't propagate */
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    sheet = bg.querySelector("#tcCncSheet");

    bg.querySelector("#tcCncConfirm").addEventListener("click", onConfirm);
    bg.querySelector("#tcCncCall").addEventListener("click", onCallTap);
    bg.querySelector("#tcCncCall").addEventListener("dblclick", onCallDial);
    /* Escape closes — mobile keyboards rarely need it but a paired BT keyboard does. */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && bg.classList.contains("open")) close();
    });
  }

  function renderSlots() {
    var el = bg.querySelector("#tcCncSlots");
    el.innerHTML = slots.map(function (s, i) {
      return '<button type="button" class="tc-cnc-slot' + (i === selIdx ? " on" : "") +
        '" role="radio" aria-checked="' + (i === selIdx) + '" data-i="' + i + '">' +
        '<div class="day">' + s.day + '</div><div class="time">' + s.time + '</div></button>';
    }).join("");
    el.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        selIdx = +b.dataset.i;
        renderSlots();
        updateConfirmLabel();
      });
    });
  }

  function updateConfirmLabel() {
    var s = slots[selIdx];
    bg.querySelector("#tcCncConfirmLbl").textContent =
      "Confirm " + s.day.charAt(0) + s.day.slice(1).toLowerCase() + " " + s.time;
  }

  function onConfirm() {
    if (!current) return close();
    var s = slots[selIdx];
    close();
    /* Hand off to TruBook — the actual booking backend. The slot ISO is
       carried so TruBook can pre-select or record it. TruBook.open only reads
       {mode, car} today; passing extras is forward-compatible and reviewers
       can wire them into the drawer without changing the concierge sheet. */
    if (root.TruBook && root.TruBook.open) {
      root.TruBook.open({
        mode: "live",
        car: current.payload.vehicle,
        vehicleId: current.payload.vehicleId,
        slotISO: s.iso,
        slotLabel: s.day + " " + s.time,
        agent: DEALER_NAME,
      });
    } else if (root.TruForm && root.TruForm.open) {
      root.TruForm.open({
        vehicle: current.payload.vehicle,
        vehicleId: current.payload.vehicleId,
        interest: "Test drive · " + s.day + " " + s.time,
        source: "concierge-sheet",
      });
    } else {
      /* Last-resort WhatsApp — never silently fail on a booking CTA. */
      location.href = waHref(current.payload.vehicle, s);
    }
  }

  function onCallTap() {
    var hint = bg.querySelector("#tcCncHint");
    hint.classList.add("on");
    clearTimeout(callHintTimer);
    callHintTimer = setTimeout(function () { hint.classList.remove("on"); }, 2200);
  }
  function onCallDial() {
    clearTimeout(callHintTimer);
    location.href = "tel:" + TEL_NUMBER;
  }

  function waHref(vehicleLabel, slot) {
    var msg = "Hi " + DEALER_NAME + ", I'd like to book a test drive: " +
      vehicleLabel + (slot ? " — " + slot.day + " " + slot.time : "");
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg);
  }

  function open(vehicle, payload) {
    ensureShell();
    current = { v: vehicle, payload: payload };
    slots = buildSlots();
    /* Default to Saturday 09:30 — the design's happy path, also the copy
       ("Drive it Saturday?") points there. */
    selIdx = 1;
    renderSlots();
    updateConfirmLabel();
    bg.querySelector("#tcCncNote").textContent =
      "The " + (vehicle.model || "car") + " will be fuelled and pulled to the front bay. " +
      "Bring your licence — the drive takes ±20 min.";
    bg.querySelector("#tcCncWa").href = waHref(payload.vehicle);
    /* Prevent page scroll behind the sheet on iOS */
    document.documentElement.style.overflow = "hidden";
    /* rAF so the transform transition triggers */
    requestAnimationFrame(function () { bg.classList.add("open"); });
  }

  function close() {
    if (!bg) return;
    bg.classList.remove("open");
    document.documentElement.style.overflow = "";
    current = null;
  }

  root.TruConcierge = { open: open, close: close };
})(window);
