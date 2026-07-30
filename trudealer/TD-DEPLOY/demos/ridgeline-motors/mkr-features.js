/* Ridgeline Features — Virtual Trade-In simulator + interactive delivery map
   Home page only. Both blocks are self-contained and fail quietly if their
   markup isn't on the page. */
(function () {
  "use strict";

  var WA = "15125550142";
  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ============================================================
     VIRTUAL TRADE-IN — mirrors the ten guided sections the real
     TruLive session walks a seller through.
     ============================================================ */
  var SECTIONS = [
    { name: "Exterior — Front", instr: "Frame the full front — bumper, grille, headlights and badge.", checks: ["Bumper & grille undamaged", "Both headlights clear, no cracks", "Panel gaps even, paint matches", "Windscreen — no chips or cracks"] },
    { name: "Driver Side", instr: "Walk the driver's side slowly, front to back. Hold on any marks.", checks: ["Doors & panels straight", "No dents, rust or repaint", "Side mirror intact", "Door seals in good condition"] },
    { name: "Rear & Boot", instr: "Show the rear, tailgate and open the load bay or boot.", checks: ["Tail lights working", "Tailgate opens & latches", "Boot floor clean", "Spare wheel & tools present"] },
    { name: "Passenger Side", instr: "Walk the passenger side back to front. Show the sill and lower panels.", checks: ["Panels match driver side", "No kerb damage on sills", "Fuel flap opens", "Trim & handles intact"] },
    { name: "Wheels & Tyres", instr: "Show each tyre tread and the rim face. Point the camera close.", checks: ["Tread depth legal on all four", "Even wear — no alignment issue", "No cracks or bulges in sidewall", "Rims — no serious kerbing"] },
    { name: "Engine Bay", instr: "Open the bonnet. Show the engine, then the dipstick and fluid levels.", checks: ["No oil or coolant leaks", "Oil on dipstick clean", "Belts & hoses intact", "No corrosion on battery terminals"] },
    { name: "Interior — Front", instr: "Show the dash, then the odometer reading, seats and controls.", checks: ["Odometer reading confirmed", "No warning lights on cluster", "Seats & upholstery good", "Aircon blows cold"] },
    { name: "Interior — Rear", instr: "Show the back seats, floor and roof lining.", checks: ["Rear seats clean & intact", "Seatbelts all present", "Roof lining not sagging", "No damp or musty smell"] },
    { name: "Start-up & Electronics", instr: "Start the engine on camera. Let us hear the idle, then test lights and wipers.", checks: ["Starts cleanly, no smoke", "Idle steady, no odd noise", "Indicators, brake & reverse lights", "Infotainment & windows work"] },
    { name: "Underbody & Documents", instr: "Show underneath if you can, then the service book and paperwork.", checks: ["No major underbody rust", "No fresh leaks on the ground", "Service history shown", "Your questions answered"] }
  ];

  var TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  function tradeIn() {
    var stage = document.getElementById("vtiStage");
    if (!stage) return;

    var rail = document.getElementById("vtiRail");
    var idxEl = document.getElementById("vtiIdx");
    var secEl = document.getElementById("vtiSec");
    var insEl = document.getElementById("vtiInstr");
    var chkEl = document.getElementById("vtiChecks");
    var autoEl = document.getElementById("vtiAuto");
    var clockEl = document.getElementById("vtiClock");
    var cur = 0, auto = null, seconds = 0, clockT = null, started = false;

    rail.innerHTML = SECTIONS.map(function () { return '<span class="seg"></span>'; }).join("");
    var segs = rail.querySelectorAll(".seg");

    function pad(n) { return (n < 10 ? "0" : "") + n; }

    function paint() {
      var s = SECTIONS[cur];
      idxEl.textContent = pad(cur + 1) + " / " + pad(SECTIONS.length);
      secEl.textContent = s.name;
      insEl.textContent = s.instr;
      chkEl.innerHTML = s.checks.map(function (c) { return "<li>" + TICK + "<span>" + c + "</span></li>"; }).join("");
      Array.prototype.forEach.call(segs, function (seg, i) {
        seg.className = "seg" + (i < cur ? " done" : i === cur ? " cur" : "");
      });
    }

    function go(n, manual) {
      cur = (n + SECTIONS.length) % SECTIONS.length;
      paint();
      if (manual) stop();
    }
    function stop() {
      if (auto) { clearInterval(auto); auto = null; }
      if (autoEl) autoEl.textContent = "Manual";
    }
    function start() {
      if (started || reduce) return;
      started = true;
      if (autoEl) autoEl.textContent = "Auto-playing";
      auto = setInterval(function () { go(cur + 1); }, 4200);
      clockT = setInterval(function () {
        seconds++;
        if (clockEl) clockEl.textContent = pad(Math.floor(seconds / 60)) + ":" + pad(seconds % 60);
      }, 1000);
    }

    document.getElementById("vtiPrev").addEventListener("click", function () { go(cur - 1, true); });
    document.getElementById("vtiNext").addEventListener("click", function () { go(cur + 1, true); });
    paint();

    // Only run the session once it's actually on screen. IntersectionObserver
    // where available, with a plain rect check as the fallback — some renderers
    // never fire IO callbacks when the page isn't compositing.
    function onScreen() {
      var r = stage.getBoundingClientRect();
      return r.top < window.innerHeight * 0.85 && r.bottom > 0;
    }
    function maybeStart() {
      if (started) return;
      if (onScreen()) { start(); window.removeEventListener("scroll", maybeStart); }
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { start(); io.disconnect(); } });
      }, { threshold: 0.35 });
      io.observe(stage);
    }
    window.addEventListener("scroll", maybeStart, { passive: true });
    maybeStart();

    // Starter form → opens the shared booking calendar pre-loaded with their car.
    var form = document.getElementById("vtiForm");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var theirCar = {
        y: v("vti-year"),
        make: v("vti-make"),
        name: v("vti-model"),
        priceLabel: v("vti-km") + (v("vti-name") ? " · " + v("vti-name") : ""),
        img: "demo-logo.svg"
      };
      if (window.RidgelineBook) {
        window.RidgelineBook.open({ mode: "tradein", car: theirCar });
        return;
      }
      var text = [
        "Hi Ridgeline — I'd like to do a virtual trade-in.",
        "",
        "Vehicle: " + v("vti-year") + " " + v("vti-make") + " " + v("vti-model"),
        "Mileage: " + v("vti-km"),
        "Me: " + v("vti-name"),
        "",
        "Please send me the live inspection link and a slot."
      ].join("\n");
      window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
  }

  /* ============================================================
     DELIVERY MAP
     ============================================================ */
  function delivery() {
    var section = document.getElementById("delivery");
    if (!section) return;

    var cities = section.querySelectorAll(".mkr-city");
    var routes = section.querySelectorAll(".route");
    var cityEl = document.getElementById("delCity");
    var kmEl = document.getElementById("delKm");
    var etaEl = document.getElementById("delEta");
    var pickEl = document.getElementById("delPick");
    var waEl = document.getElementById("delWa");
    if (!cities.length) return;

    function select(g) {
      var name = g.getAttribute("data-city");
      var km = g.getAttribute("data-km");
      var eta = g.getAttribute("data-eta");

      Array.prototype.forEach.call(cities, function (c) { c.classList.toggle("on", c === g); });
      Array.prototype.forEach.call(routes, function (r) {
        r.classList.toggle("on", r.getAttribute("data-city") === name);
      });

      if (cityEl) { cityEl.textContent = name; cityEl.style.fontSize = ""; }
      if (kmEl) kmEl.innerHTML = Number(km).toLocaleString("en-US") + '<em> mi</em>';
      if (etaEl) etaEl.innerHTML = eta;
      if (pickEl) pickEl.innerHTML = "Austin to <b>" + name + "</b> &mdash; fully insured in transit, <b>$0</b> delivery fee.";
      if (waEl) waEl.href = "https://wa.me/" + WA + "?text=" +
        encodeURIComponent("Hi Ridgeline, I'm in " + name + " — what does delivery look like for me?");
    }

    Array.prototype.forEach.call(cities, function (g) {
      g.addEventListener("click", function () { select(g); });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(g); }
      });
    });

    // Open on the busiest lane so the panel is never empty.
    var jhb = section.querySelector('.mkr-city[data-city="Dallas"]');
    if (jhb) select(jhb);
  }

  function init() {
    try { tradeIn(); } catch (e) {}
    try { delivery(); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
