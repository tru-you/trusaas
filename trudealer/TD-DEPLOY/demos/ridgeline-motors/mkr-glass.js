/* Ridgeline Glass — rebuilds the topbar with a live trading-hours status.
   The strip used to be three lines of static text; now it tells a visitor
   whether anyone is actually there right now, which is the one thing that
   changes what they do next. */
(function () {
  "use strict";

  // Mon–Fri 08:00–17:30, Sat 08:00–14:00, closed Sunday.
  var HOURS = {
    0: null,
    1: [8, 17.5], 2: [8, 17.5], 3: [8, 17.5], 4: [8, 17.5], 5: [8, 17.5],
    6: [8, 14]
  };
  var DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function hhmm(dec) {
    var h = Math.floor(dec), m = Math.round((dec - h) * 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function status(now) {
    now = now || new Date();
    var d = now.getDay();
    var t = now.getHours() + now.getMinutes() / 60;
    var today = HOURS[d];

    if (today && t >= today[0] && t < today[1]) {
      return { open: true, text: "Open now &middot; closes " + hhmm(today[1]) };
    }
    if (today && t < today[0]) {
      return { open: false, text: "Opens today " + hhmm(today[0]) };
    }
    // find the next trading day
    for (var i = 1; i <= 7; i++) {
      var nd = (d + i) % 7;
      if (HOURS[nd]) {
        var label = i === 1 ? "tomorrow" : DAY[nd];
        return { open: false, text: "Opens " + label + " " + hhmm(HOURS[nd][0]) };
      }
    }
    return { open: false, text: "Closed" };
  }

  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var TEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.8.7a2 2 0 0 1 1.8 2.1z"/></svg>';

  function build() {
    var bar = document.querySelector(".topbar .wrap");
    if (!bar) return;
    var s = status();
    bar.innerHTML =
      '<span class="tb-loc">' + PIN + "4400 South Congress Ave &middot; <b>Austin</b></span>"
      + '<span class="tb-status ' + (s.open ? "open" : "shut") + '" id="tbStatus" aria-live="polite">'
      + "<i></i>" + s.text + "</span>"
      + '<a class="tb-phone" href="tel:+15125550142">' + TEL + "+1 512 555 0142</a>";

    // Re-check on the minute boundary so it flips as the showroom opens/closes.
    setInterval(function () {
      var el = document.getElementById("tbStatus");
      if (!el) return;
      var n = status();
      el.className = "tb-status " + (n.open ? "open" : "shut");
      el.innerHTML = "<i></i>" + n.text;
    }, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  window.RidgelineGlass = { status: status };
})();
