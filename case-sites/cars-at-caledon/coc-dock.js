/* Caledon Dock — one launcher rail.
   The site was stacking three independent floating launchers in the same
   corner: the FAB rail, TruChat's #tc-fab and TruAfford's .ta-launcher.
   This hides the two widget launchers and puts proxy buttons in the FAB rail
   instead — the widgets' own panels and logic are untouched, we just click
   their real launcher for them. */
(function () {
  "use strict";

  var WIDGETS = [
    {
      key: "chat",
      sel: "#tc-fab",
      cls: "fab-chat",
      label: "Chat with us",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>'
    },
    {
      key: "afford",
      sel: ".ta-launcher",
      cls: "fab-afford",
      label: "What can I afford?",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
    }
  ];

  function mount(w) {
    var rail = document.getElementById("fabRail");
    var real = document.querySelector(w.sel);
    if (!rail || !real || rail.querySelector("." + w.cls)) return !!rail.querySelector("." + w.cls);

    // Hide the widget's own floating launcher — its panel still opens normally.
    real.style.setProperty("display", "none", "important");

    var b = document.createElement("button");
    b.type = "button";
    b.className = "fab-btn " + w.cls;
    b.setAttribute("aria-label", w.label);
    b.innerHTML = w.icon + '<span class="fab-label">' + w.label + "</span>";
    b.addEventListener("click", function () {
      var target = document.querySelector(w.sel);
      if (!target) return;
      // Un-hide for the duration of the click so the widget's own handler,
      // which may check visibility, behaves exactly as it would normally.
      target.style.removeProperty("display");
      target.click();
      setTimeout(function () { target.style.setProperty("display", "none", "important"); }, 0);
    });
    rail.insertBefore(b, rail.firstChild);
    return true;
  }

  function init() {
    var pending = WIDGETS.slice();
    var tries = 0;

    function sweep() {
      pending = pending.filter(function (w) { return !mount(w); });
      tries++;
      if (!pending.length || tries > 40) clearInterval(timer);
    }
    var timer = setInterval(sweep, 250); // widgets mount async / deferred
    sweep();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
