/* Halstead — TruValue trade-in profiler.
 *
 * Three short steps build the car's profile, and the "what moves your number"
 * panel reacts live as they answer. It never quotes a figure: TruValue's rule is
 * that a dealer sets the trade price subject to viewing, so the tool's job is to
 * get the car understood and the session booked, not to guess at a value.
 */
(function () {
  "use strict";

  var WA = "+44 161 496 0000";
  var state = { make: "", model: "", year: "", km: "", condition: "", finance: "", name: "", phone: "" };
  var step = 0;

  var FACTORS = [
    {
      key: "km", b: "Mileage against age",
      p: "A low-km car of its year carries a premium. High km isn't a dealbreaker — a full service history offsets a lot of it.",
      ic: '<path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="6"/>'
    },
    {
      key: "condition", b: "Condition and panels",
      p: "Straight panels and matching paint move the number most. Kerbed rims and stone chips are cheap for us to put right.",
      ic: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-5"/>'
    },
    {
      key: "finance", b: "Outstanding finance",
      p: "We settle the bank directly and trade against the balance. Being upfront about it speeds the deal up, it doesn't hurt your price.",
      ic: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/>'
    },
    {
      key: "history", b: "Service history and spares",
      p: "Book stamps, a second key and the spare wheel are worth real money at trade-in. Dig them out before the session.",
      ic: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6"/>'
    }
  ];

  function tpl() {
    return ''
      + '<div class="ti-card" id="tiCard">'
      + '<div class="ti-steps"><span class="on"></span><span></span><span></span></div>'

      + '<div class="ti-step on" data-step="0">'
      + '<div class="ti-q">Step 1 — what are you trading?</div>'
      + '<div class="ti-fields">'
      + '<div><input id="ti-make" placeholder="Make — e.g. Toyota" autocomplete="off"></div>'
      + '<div><input id="ti-model" placeholder="Model — e.g. Hilux 2.8" autocomplete="off"></div>'
      + '<div><input id="ti-year" placeholder="Year" inputmode="numeric" autocomplete="off"></div>'
      + '<div><input id="ti-km" placeholder="Mileage (km)" inputmode="numeric" autocomplete="off"></div>'
      + "</div></div>"

      + '<div class="ti-step" data-step="1">'
      + '<div class="ti-q">Step 2 — honest condition</div>'
      + '<div class="ti-opts" id="tiCond">'
      + '<div class="ti-opt" data-v="excellent">Excellent<small>No marks</small></div>'
      + '<div class="ti-opt" data-v="good">Good<small>Light wear</small></div>'
      + '<div class="ti-opt" data-v="fair">Fair<small>Needs work</small></div>'
      + "</div>"
      + '<div class="ti-q" style="margin-top:18px">Still on finance?</div>'
      + '<div class="ti-opts" id="tiFin">'
      + '<div class="ti-opt" data-v="yes">Yes</div>'
      + '<div class="ti-opt" data-v="no">No</div>'
      + '<div class="ti-opt" data-v="unsure">Not sure</div>'
      + "</div></div>"

      + '<div class="ti-step" data-step="2">'
      + '<div class="ti-q">Step 3 — who do we call?</div>'
      + '<div class="ti-summary" id="tiSummary"></div>'
      + '<div class="ti-fields">'
      + '<div><input id="ti-name" placeholder="Your name" autocomplete="name"></div>'
      + '<div><input id="ti-phone" placeholder="Mobile number" inputmode="tel" autocomplete="tel"></div>'
      + "</div></div>"

      + '<div class="ti-nav">'
      + '<button type="button" class="back" id="tiBack" disabled>Back</button>'
      + '<button type="button" class="next" id="tiNext">Next</button>'
      + "</div></div>";
  }

  function factorsHtml() {
    return '<div class="ti-factors">'
      + FACTORS.map(function (f) {
        return '<div class="ti-factor" data-k="' + f.key + '">'
          + '<div class="ic"><svg viewBox="0 0 24 24">' + f.ic + "</svg></div>"
          + "<div><b>" + f.b + "</b><p>" + f.p + "</p></div></div>";
      }).join("")
      + "</div>"
      + '<div class="ti-note"><b>No robot valuations here.</b>'
      + "<p>We don't let software guess your car's worth. A Halstead buyer walks the car with you on a live TruValue call and gives you a trade price in writing, subject to viewing — a real number from a real person.</p></div>";
  }

  function hot(key, on) {
    var el = document.querySelector('.ti-factor[data-k="' + key + '"]');
    if (el) el.classList.toggle("hot", !!on);
  }

  function readStep0() {
    ["make", "model", "year", "km"].forEach(function (k) {
      var el = document.getElementById("ti-" + k);
      if (el) state[k] = el.value.trim();
    });
    var km = +String(state.km).replace(/\D/g, "");
    hot("km", km > 0);
    hot("history", !!state.year);
  }

  function summary() {
    var el = document.getElementById("tiSummary");
    if (!el) return;
    var rows = [
      ["Vehicle", [state.year, state.make, state.model].filter(Boolean).join(" ") || "—"],
      ["Mileage", state.km ? Number(String(state.km).replace(/\D/g, "")).toLocaleString("en-GB") + " mi" : "—"],
      ["Condition", state.condition ? state.condition.charAt(0).toUpperCase() + state.condition.slice(1) : "—"],
      ["Finance", state.finance === "yes" ? "Still financed" : state.finance === "no" ? "Settled" : state.finance ? "Not sure" : "—"]
    ];
    el.innerHTML = rows.map(function (r) {
      return "<div><span>" + r[0] + "</span><b>" + r[1] + "</b></div>";
    }).join("");
  }

  function show(n) {
    step = Math.max(0, Math.min(2, n));
    var card = document.getElementById("tiCard");
    Array.prototype.forEach.call(card.querySelectorAll(".ti-step"), function (s) {
      s.classList.toggle("on", +s.getAttribute("data-step") === step);
    });
    Array.prototype.forEach.call(card.querySelectorAll(".ti-steps span"), function (s, i) {
      s.className = i === step ? "on" : (i < step ? "done" : "");
    });
    document.getElementById("tiBack").disabled = step === 0;
    document.getElementById("tiNext").textContent = step === 2 ? "Book my TruValue session" : "Next";
    if (step === 2) summary();
  }

  function handoff() {
    var name = document.getElementById("ti-name");
    var phone = document.getElementById("ti-phone");
    state.name = name ? name.value.trim() : "";
    state.phone = phone ? phone.value.trim() : "";

    var car = {
      y: state.year,
      make: state.make,
      name: state.model,
      priceLabel: [
        state.km ? Number(String(state.km).replace(/\D/g, "")).toLocaleString("en-GB") + " mi" : "",
        state.condition ? state.condition.charAt(0).toUpperCase() + state.condition.slice(1) + " condition" : "",
        state.finance === "yes" ? "on finance" : ""
      ].filter(Boolean).join(" · "),
      img: "demo-logo.svg"
    };

    if (window.COCBook) { window.COCBook.open({ mode: "tradein", car: car }); return; }
    var text = ["Hi Halstead Motor Co. — I'd like a TruValue trade-in.", "",
      "Vehicle: " + [state.year, state.make, state.model].filter(Boolean).join(" "),
      "Mileage: " + state.km, "Condition: " + state.condition,
      "Finance: " + state.finance, "Name: " + state.name, "Mobile: " + state.phone].join("\n");
    window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  function bind() {
    document.getElementById("tiNext").addEventListener("click", function () {
      if (step === 0) readStep0();
      if (step === 2) { handoff(); return; }
      show(step + 1);
    });
    document.getElementById("tiBack").addEventListener("click", function () { show(step - 1); });

    ["tiCond", "tiFin"].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      box.addEventListener("click", function (e) {
        var o = e.target.closest(".ti-opt");
        if (!o) return;
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove("on"); });
        o.classList.add("on");
        var v = o.getAttribute("data-v");
        if (id === "tiCond") { state.condition = v; hot("condition", true); }
        else { state.finance = v; hot("finance", v === "yes" || v === "unsure"); }
      });
    });
  }

  function init() {
    var host = document.getElementById("tradein");
    if (!host) return;
    var grid = host.querySelector(".ti-grid");
    if (!grid) return;
    grid.innerHTML = tpl() + "<div>" + factorsHtml() + "</div>";
    bind();
    show(0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.COCTradeIn = { state: function () { return state; } };
})();
