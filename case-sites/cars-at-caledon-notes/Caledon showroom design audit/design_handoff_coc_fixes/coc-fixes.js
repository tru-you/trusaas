/* ============================================================
   Cars on Caledon — Design Fixes (drop-in JS)
   Load AFTER coc-polish.js:
     <script src="coc-fixes.js?v=20260806a" defer></script>
   
   Does NOT touch feeds, widgets, or webhooks.
   ============================================================ */
(function () {
  "use strict";

  function init() {

    /* ── FIX 04: Kill the delivered ticker ──────────────────
       coc-polish.js creates .coc-ticker dynamically after 7s.
       Rather than race it, we watch for it and remove it. */
    var tickerObs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.classList && n.classList.contains("coc-ticker")) {
            n.remove();
          }
        });
      });
    });
    tickerObs.observe(document.body, { childList: true });
    // Also remove any already-existing ticker
    var existing = document.querySelector(".coc-ticker");
    if (existing) existing.remove();


    /* ── FIX 06: Collapsible search on mobile ──────────────
       Wraps the .sp-title content in a toggle button that
       shows/hides the .sp-row on tap. Desktop: no change. */
    var sp = document.querySelector(".search-panel");
    if (sp && window.matchMedia("(max-width:640px)").matches) {
      var title = sp.querySelector(".sp-title");
      if (title) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sp-toggle";
        btn.innerHTML = title.innerHTML
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
          + 'style="width:16px;height:16px;flex-shrink:0"><path d="M6 9l6 6 6-6"/></svg>';
        title.innerHTML = "";
        title.appendChild(btn);
        btn.addEventListener("click", function () {
          sp.classList.toggle("sp-open");
        });
      }
    }


    /* ── FIX: Splash — kill on mobile ──────────────────────
       The splash is session-gated and loaded via coc-splash.js
       which runs before this. On mobile, mark it as "seen"
       immediately so it never appears, and remove it if it's
       already in the DOM. */
    if (window.matchMedia("(max-width:768px)").matches) {
      try { sessionStorage.setItem("cocSplashSeen", "1"); } catch (e) {}
      var splash = document.querySelector(".coc-splash");
      if (splash) {
        splash.classList.add("out");
        document.body.style.overflow = "";
        setTimeout(function () { splash.remove(); }, 100);
      }
    }


    /* ── FIX 05: Faster call button ────────────────────────
       Reduce the arm timeout from 3.5s to 5s (gives more time
       to read the number) but also: on mobile, the first tap
       on the mobile-bar call button dials immediately (no arm).
       The topbar/visit/footer call buttons keep the double-tap
       since they're in context where a pocket-dial is possible. */
    if (window.matchMedia("(max-width:720px)").matches) {
      document.addEventListener("click", function (e) {
        var btn = e.target.closest(".coc-mbar .coc-call");
        if (!btn) return;
        // Skip the arm step — dial immediately
        e.preventDefault();
        e.stopImmediatePropagation();
        var tel = btn.getAttribute("data-tel");
        if (tel) window.location.href = "tel:" + tel;
      }, true); // capture phase — fires before coc-polish.js
    }


    /* ── FIX: Body type tile counts — don't flash wrong ───
       The tiles have hardcoded "12 vehicles" etc that flash
       before JS overwrites them. Set them to "Browse" initially
       so there's no false count during load. */
    document.querySelectorAll(".cat-tile .ct-count").forEach(function (el) {
      if (!el.closest("[data-bt='']")) {
        // Only clear specific body type tiles, not the "View All" tile
        if (el.textContent.match(/\d+ vehicles?/)) {
          el.textContent = "Browse";
        }
      }
    });


    /* ── FIX: Stats "40+" — don't flash wrong ─────────────
       Replace hardcoded stats number with a dash until stock
       count arrives (syncCounts in index.html will overwrite) */
    var statNum = document.querySelector(".stats-row .si:first-child .sn");
    if (statNum && statNum.textContent.trim() === "40+") {
      statNum.textContent = "—";
    }

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
