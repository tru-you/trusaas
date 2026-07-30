/* MKR Booking — one calendar for every appointment on the site.
   Replaces the "straight to WhatsApp" jump on viewing CTAs with a real slot
   picker: pick a day, pick a time, leave a name and number. Confirmation
   still hands off to WhatsApp (that's where the showroom team lives) but the
   customer also gets a calendar (.ics) file for their own diary.

   Public API:  MKRBook.open({ mode, car, title })
                mode = "showroom" | "live" | "tradein"
*/
(function () {
  "use strict";

  var WA = "27662912809";
  var ADDRESS = "MKR Auto Sales, 495 Cape Road, Westering, Gqeberha, 6025";
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var MODES = {
    showroom: {
      label: "Showroom visit",
      title: "Book a showroom visit",
      sub: "Come see it in person at 495 Cape Road, Westering. Coffee's on us — no pressure, no hard sell.",
      dur: 60,
      ev: "Showroom visit — MKR Auto Sales",
      loc: ADDRESS
    },
    live: {
      label: "Live video",
      title: "Book a live video viewing",
      sub: "We walk the car live on video — cold start, engine bay, underbody. You direct the camera, from anywhere in SA.",
      dur: 30,
      ev: "Live video viewing — MKR Auto Sales",
      loc: "Live video call (link sent by WhatsApp)"
    },
    tradein: {
      label: "Remote trade-in",
      title: "TruValue Remote Trade-In Offer",
      sub: "A live guided walkthrough of your car with a consultant — photos, video and the questions that set the price — ending in a written Offer to Purchase.",
      dur: 30,
      ev: "TruValue remote trade-in — MKR Auto Sales",
      loc: "Live video call (link sent by WhatsApp)"
    }
  };

  /* ---------- slots: next 6 trading days, real dates, real hours ---------- */
  function buildSlots() {
    var out = [], now = new Date(), i = 1;
    while (out.length < 6 && i < 14) {
      var d = new Date(now);
      d.setDate(d.getDate() + i);
      i++;
      if (d.getDay() === 0) continue;              // closed Sundays
      out.push({
        date: d,
        dow: DAYS[d.getDay()],
        dm: d.getDate() + " " + MONTHS[d.getMonth()],
        // Mon–Fri 08:00–17:30, Sat 08:00–14:00
        times: d.getDay() === 6
          ? ["08:30", "09:30", "10:30", "11:30", "12:30"]
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

  function ensureBg() {
    if (bg) return bg;
    bg = document.createElement("div");
    bg.className = "vd-booking-bg";
    bg.id = "mkrBookBg";
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    bg.setAttribute("aria-label", "Book an appointment");
    document.body.appendChild(bg);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && bg.classList.contains("open")) close();
    });
    return bg;
  }

  function close() {
    if (!bg) return;
    bg.classList.remove("open");
    document.body.classList.remove("modal-open");
  }

  function timeGridHtml(day) {
    return slots[day].times.map(function (t, i) {
      return '<div class="vd-slot' + (i === 0 ? " on" : "") + '" data-time="' + t + '" role="button" tabindex="0">' + t + "</div>";
    }).join("");
  }

  function carCard() {
    if (!car) return "";
    return '<div class="vd-booking-car">'
      + '<div class="bk-img" style="background-image:url(\'' + esc(car.img) + '\')"></div>'
      + '<div><div class="bk-name">' + esc([car.y, car.make, car.name].filter(Boolean).join(" ")) + "</div>"
      + '<div class="bk-price">' + esc(car.priceLabel || "") + "</div></div></div>";
  }

  function paint() {
    var m = MODES[mode];
    selTime = slots[selDay].times[0];

    bg.innerHTML = '<div class="vd-booking">'
      + '<div class="vd-booking-head"><div style="display:flex;align-items:center;gap:10px">'
      + '<img src="mkr-badge.jpg" alt="" style="width:34px;height:34px;border-radius:9px;object-fit:cover;flex-shrink:0">'
      + "<h3>" + esc(m.title) + "</h3></div>"
      + '<button class="vd-booking-close" id="mkrBkClose" aria-label="Close">&times;</button></div>'
      + '<div class="sub">' + esc(m.sub) + "</div>"
      + carCard()
      + '<div class="mkr-bk-modes" id="mkrBkModes">'
      + Object.keys(MODES).map(function (k) {
        return '<div class="mkr-bk-mode' + (k === mode ? " on" : "") + '" data-mode="' + k + '" role="button" tabindex="0">' + MODES[k].label + "</div>";
      }).join("")
      + "</div>"
      + '<div class="vd-slot-label">Select a day</div>'
      + '<div class="vd-slot-grid" id="mkrBkDays">'
      + slots.map(function (s, i) {
        return '<div class="vd-slot' + (i === selDay ? " on" : "") + '" data-day="' + i + '" role="button" tabindex="0">'
          + '<div class="day">' + s.dow + "</div>" + s.dm + "</div>";
      }).join("")
      + "</div>"
      + '<div class="vd-slot-label">Select a time</div>'
      + '<div class="vd-slot-grid" id="mkrBkTimes">' + timeGridHtml(selDay) + "</div>"
      + '<div class="vd-slot-label">Your details</div>'
      + '<div class="mkr-bk-fields">'
      + '<input id="mkrBkName" placeholder="Your name" autocomplete="name" required>'
      + '<input id="mkrBkPhone" placeholder="Mobile number" inputmode="tel" autocomplete="tel" required>'
      + (mode === "tradein" && !car ? '<input class="full" id="mkrBkCar" placeholder="Your car — e.g. 2019 Toyota Hilux 2.8, 86 000 km" autocomplete="off">' : "")
      + "</div>"
      + '<div class="mkr-bk-when" id="mkrBkWhen"></div>'
      + '<button class="vd-booking-confirm" id="mkrBkConfirm">Confirm this slot</button>'
      + '<div class="vd-booking-note">No charge, no obligation. We confirm on WhatsApp within business hours — Mon&ndash;Fri 08:00&ndash;17:30, Sat 08:00&ndash;14:00.</div>'
      + "</div>";

    bind();
    paintWhen();
  }

  function paintWhen() {
    var el = document.getElementById("mkrBkWhen");
    if (!el) return;
    var s = slots[selDay];
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>'
      + "<span><b>" + s.dow + " " + s.dm + " &middot; " + selTime + "</b> &mdash; " + MODES[mode].dur + " min</span>";
  }

  function activate(container, el) {
    Array.prototype.forEach.call(container.querySelectorAll(".vd-slot, .mkr-bk-mode"), function (x) { x.classList.remove("on"); });
    el.classList.add("on");
  }

  function onPick(container, handler) {
    container.addEventListener("click", function (e) {
      var el = e.target.closest(".vd-slot, .mkr-bk-mode");
      if (el && container.contains(el)) handler(el);
    });
    container.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var el = e.target.closest(".vd-slot, .mkr-bk-mode");
      if (el && container.contains(el)) { e.preventDefault(); handler(el); }
    });
  }

  function bind() {
    document.getElementById("mkrBkClose").addEventListener("click", close);

    onPick(document.getElementById("mkrBkModes"), function (el) {
      mode = el.getAttribute("data-mode");
      paint();
    });

    var days = document.getElementById("mkrBkDays");
    var times = document.getElementById("mkrBkTimes");

    onPick(days, function (el) {
      selDay = +el.getAttribute("data-day");
      activate(days, el);
      times.innerHTML = timeGridHtml(selDay);
      selTime = slots[selDay].times[0];
      paintWhen();
    });
    onPick(times, function (el) {
      selTime = el.getAttribute("data-time");
      activate(times, el);
      paintWhen();
    });

    document.getElementById("mkrBkConfirm").addEventListener("click", confirm);
  }

  /* ---------- confirm ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function startEnd() {
    var s = slots[selDay].date;
    var hm = selTime.split(":");
    var start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), +hm[0], +hm[1], 0);
    var end = new Date(start.getTime() + MODES[mode].dur * 60000);
    return [start, end];
  }

  // Local-time ICS (no Z suffix) — the slot is South African trading hours.
  function ics(name) {
    var se = startEnd(), m = MODES[mode];
    var f = function (d) {
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
    };
    var title = m.ev + (car ? " — " + [car.y, car.make, car.name].filter(Boolean).join(" ") : "");
    var desc = [
      m.sub,
      car ? "Vehicle: " + [car.y, car.make, car.name].filter(Boolean).join(" ") : "",
      "Booked by: " + name,
      "MKR Auto Sales · +27 66 291 2809"
    ].filter(Boolean).join("\\n");
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MKR Auto Sales//Booking//EN",
      "BEGIN:VEVENT",
      "UID:mkr-" + f(se[0]) + "-" + Math.abs(hashStr(title)) + "@mkrautosales.co.za",
      "DTSTAMP:" + f(new Date()),
      "DTSTART:" + f(se[0]),
      "DTEND:" + f(se[1]),
      "SUMMARY:" + title,
      "LOCATION:" + m.loc,
      "DESCRIPTION:" + desc,
      "BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", "DESCRIPTION:" + title, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function confirm() {
    var nameEl = document.getElementById("mkrBkName");
    var phoneEl = document.getElementById("mkrBkPhone");
    var carEl = document.getElementById("mkrBkCar");
    var name = nameEl.value.trim(), phone = phoneEl.value.trim();

    nameEl.classList.toggle("err", !name);
    phoneEl.classList.toggle("err", phone.replace(/\D/g, "").length < 9);
    if (!name) { nameEl.focus(); return; }
    if (phone.replace(/\D/g, "").length < 9) { phoneEl.focus(); return; }

    var s = slots[selDay], m = MODES[mode];
    var when = s.dow + " " + s.dm + " at " + selTime;
    var text = [
      "Hi MKR — I'd like to book a " + m.label.toLowerCase() + ".",
      "",
      "When: " + when,
      car ? "Vehicle: " + [car.y, car.make, car.name].filter(Boolean).join(" ") + (car.priceLabel ? " (" + car.priceLabel + ")" : "") : "",
      carEl && carEl.value.trim() ? "My car: " + carEl.value.trim() : "",
      "Name: " + name,
      "Mobile: " + phone,
      "",
      "Please confirm the slot."
    ].filter(Boolean).join("\n");
    var href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);

    var blob = new Blob([ics(name)], { type: "text/calendar;charset=utf-8" });
    var icsUrl = URL.createObjectURL(blob);
    var icsName = "mkr-" + mode + "-" + s.date.getFullYear() + pad(s.date.getMonth() + 1) + pad(s.date.getDate()) + ".ics";

    bg.querySelector(".vd-booking").innerHTML =
      '<div class="mkr-bk-done">'
      + '<div class="mkr-bk-tick"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>'
      + "<h3>Slot held for you</h3>"
      + '<div class="slot">' + esc(when) + "<span>" + esc(m.ev.split(" — ")[0]) + " &middot; " + m.dur + " minutes</span></div>"
      + "<p>Send it through on WhatsApp and the showroom team confirms — usually within the hour during trading hours. Add it to your own diary below so it doesn't get away.</p>"
      + '<div class="mkr-bk-acts">'
      + '<a class="wa" href="' + href + '" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3.2C8.9 3.2 3.2 8.9 3.2 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6 7.1 0 12.8-5.7 12.8-12.8S23.1 3.2 16 3.2zm5.9 15.3c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-1.9-1-3.2-1.7-4.5-3.9-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2.4.9 2.9.8 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>Send on WhatsApp</a>'
      + '<a class="ics" href="' + icsUrl + '" download="' + icsName + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>Add to my calendar</a>'
      + '<button class="ics" id="mkrBkDone2">Done</button>'
      + "</div></div>";

    var waLink = bg.querySelector(".mkr-bk-acts .wa");
    if (waLink) waLink.focus();
    bg.querySelector("#mkrBkDone2").addEventListener("click", close);
  }

  /* ---------- open ---------- */
  function open(opts) {
    opts = opts || {};
    ensureBg();
    slots = buildSlots();
    selDay = 0;
    mode = MODES[opts.mode] ? opts.mode : "showroom";
    car = opts.car || null;
    paint();
    bg.classList.add("open");
    document.body.classList.add("modal-open");
    var first = bg.querySelector(".mkr-bk-mode.on");
    if (first) first.focus && first.focus();
  }

  /* ---------- intercept the old straight-to-WhatsApp CTAs ---------- */
  function cardFrom(el) {
    var card = el.closest && el.closest(".card");
    if (!card) return null;
    var t = function (s) { var e = card.querySelector(s); return e ? e.textContent.trim() : ""; };
    var head = t(".yr").split("·");
    var im = card.querySelector(".im");
    var imgSrc = im && im.tagName === "IMG"
      ? (im.getAttribute("src") || "")
      : (function () {
          var m = im ? /url\(["']?([^"')]+)/.exec(im.style.backgroundImage || "") : null;
          return m ? m[1] : "";
        })();
    return {
      y: (head[0] || "").trim(),
      make: (head[1] || "").trim(),
      name: t("h3"),
      priceLabel: t(".pr"),
      img: imgSrc
    };
  }

  function modeFor(txt) {
    if (/trade|valuation/i.test(txt)) return "tradein";
    if (/live|video|walkaround/i.test(txt)) return "live";
    return "showroom";
  }

  function intercept() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href*="wa.me"], [data-book]');
      if (!a) return;

      var explicit = a.getAttribute("data-book");
      var label = (a.textContent || "") + " " + (a.getAttribute("aria-label") || "") + " " + decodeURIComponent(a.getAttribute("href") || "");

      // Only take over booking-shaped CTAs; plain "WhatsApp us" links stay as they are.
      if (!explicit && !/viewing|test drive|book|walkaround|valuation|trade-in/i.test(label)) return;

      e.preventDefault();
      e.stopPropagation();
      open({ mode: explicit && MODES[explicit] ? explicit : modeFor(label), car: cardFrom(a) });
    }, true);
  }

  function init() {
    intercept();
    // The vehicle-detail modal's own booking button routes here too, so there's
    // one calendar on the site rather than two.
    if (window.openBookingModal) {
      var native = window.openBookingModal;
      window.openBookingModal = function (c) {
        try {
          open({
            mode: "live",
            car: c && { y: c.y, make: c.make, name: c.name, img: c.img, priceLabel: (window.fmtR || function (n) { return "R " + n; })(c.price) }
          });
        } catch (err) { native(c); }
      };
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.MKRBook = { open: open, close: close };
})();
