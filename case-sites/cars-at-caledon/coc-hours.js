/* Caledon — live trading-hours status in the topbar.
   The bar already reads "Mon–Fri 08:00–17:30 · Sat 08:00–13:00", which makes a
   visitor do the arithmetic themselves. This replaces that line with whether
   anyone is actually there right now, and keeps the static hours as the title
   attribute for anyone who wants the full week. */
(function () {
  "use strict";

  // Mon–Fri 08:00–17:30, Sat 08:00–13:00, closed Sunday.
  var HOURS = { 0: null, 1: [8, 17.5], 2: [8, 17.5], 3: [8, 17.5], 4: [8, 17.5], 5: [8, 17.5], 6: [8, 13] };
  var DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var FULL = "Mon–Fri 08:00–17:30 · Sat 08:00–13:00 · Closed Sunday";

  function hhmm(dec) {
    var h = Math.floor(dec), m = Math.round((dec - h) * 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function status(now) {
    now = now || new Date();
    var d = now.getDay(), t = now.getHours() + now.getMinutes() / 60, today = HOURS[d];
    if (today && t >= today[0] && t < today[1]) return { open: true, text: "Open now · closes " + hhmm(today[1]) };
    if (today && t < today[0]) return { open: false, text: "Opens today " + hhmm(today[0]) };
    for (var i = 1; i <= 7; i++) {
      var nd = (d + i) % 7;
      if (HOURS[nd]) return { open: false, text: "Opens " + (i === 1 ? "tomorrow" : DAY[nd]) + " " + hhmm(HOURS[nd][0]) };
    }
    return { open: false, text: "Closed" };
  }

  function paint(el) {
    var s = status();
    el.className = "coc-status " + (s.open ? "open" : "shut");
    el.innerHTML = "<i></i>" + s.text;
    el.setAttribute("title", FULL);
  }

  function init() {
    // The hours sit in the second span of the static group, and again inside the
    // mobile marquee track — swap every occurrence so both stay in step.
    var targets = [];
    var stat = document.querySelector(".topbar .tb-static");
    if (stat && stat.children[1]) targets.push(stat.children[1]);
    var track = document.querySelector(".topbar .tb-track");
    if (track) {
      Array.prototype.forEach.call(track.querySelectorAll("span"), function (sp) {
        if (/08:00/.test(sp.textContent)) targets.push(sp);
      });
    }
    if (!targets.length) return;

    targets.forEach(function (el) {
      el.setAttribute("data-coc-hours", "1");
      paint(el);
    });
    setInterval(function () {
      document.querySelectorAll("[data-coc-hours]").forEach(paint);
    }, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.COCHours = { status: status };
})();
