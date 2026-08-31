/**
 * TruChat · shared floating widget
 *
 * CANONICAL SOURCE — deploy a copy per dealer site alongside:
 *   <script src="…/qualifier.js"></script>
 *   <script src="…/chat-core.js"></script>
 *   <script src="…/<dealer>/config.js"></script>
 *   <script src="…/widget.js" data-bottom="24px" data-position="right" defer></script>
 *
 * The widget reads everything it needs from the dealer config object
 * (TRUECARS_TRUCHAT_CONFIG, RAY_TRUCHAT_CONFIG or COC_TRUCHAT_CONFIG). No
 * dealer-specific branding is hardcoded here.
 */
(function () {
  "use strict";

  if (window.__TRUCHAT_WIDGET__) return;
  window.__TRUCHAT_WIDGET__ = true;

  var script =
    document.currentScript ||
    (function () {
      var list = document.getElementsByTagName("script");
      return list[list.length - 1];
    })();

  var bottom = (script && script.getAttribute("data-bottom")) || "24px";
  var position = (script && script.getAttribute("data-position")) || "right";
  var autoOpen = script && script.getAttribute("data-open") === "1";
  var z = (script && script.getAttribute("data-z")) || "999990";

  function resolveAsset(path, fallback) {
    var p = path || fallback || "";
    if (!p) return "";
    if (/^https?:\/\//i.test(p) || p.indexOf("//") === 0 || p.indexOf("data:") === 0) return p;
    var src = (script && script.src) || "";
    if (src) {
      try {
        return new URL(p, src).href;
      } catch (e) {
        var base = src.replace(/\/[^/]*$/, "/");
        return base + p.replace(/^\.\//, "");
      }
    }
    return p;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function boot() {
    if (!window.TruChatQualifier || !window.TruChatUI) {
      console.error("[TruChat] Load qualifier.js and chat-core.js before widget.js");
      return;
    }

    var CFG = window.TRUECARS_TRUCHAT_CONFIG || window.RAY_TRUCHAT_CONFIG || window.COC_TRUCHAT_CONFIG || null;
    if (!CFG) {
      console.error("[TruChat] No config found — load a dealer config.js before widget.js");
      return;
    }

    var brandColor = CFG.brandRed || CFG.brandPrimary || "#e30613";
    var brandColorDark = CFG.brandRedDark || CFG.brandPrimaryDark || brandColor;
    var assistantName = CFG.assistantName || "Assistant";
    var dealerName = CFG.dealerName || "Showroom";

    var fabIcon = resolveAsset(CFG.fabIconUrl || CFG.logoUrl, "");
    var logoResolved = resolveAsset(CFG.logoUrl || CFG.fabIconUrl, "");
    var CFG_UI = Object.assign({}, CFG, { logoUrl: logoResolved, fabIconUrl: fabIcon });

    var side = position === "left" ? "left" : "right";
    var origin = side === "left" ? "left" : "right";

    var style = document.createElement("style");
    style.id = "truchat-widget-chrome";
    style.textContent = [
      "#tc-widget-root{all:initial;font-family:Inter,system-ui,sans-serif}",
      "#tc-widget-root *{box-sizing:border-box}",
      "@media(prefers-reduced-motion:reduce){#tc-fab,#tc-panel,#tc-fab .tc-ring,#tc-fab .tc-ring2{animation:none!important}}",

      "@keyframes tcFabIn{0%{opacity:0;transform:scale(.4) translateY(24px)}",
      "60%{opacity:1;transform:scale(1.08) translateY(-2px)}100%{transform:none}}",
      "@keyframes tcFabPulse{0%{box-shadow:0 14px 36px -10px ", brandColor, "a6,0 0 0 0 ", brandColor, "80}",
      "70%{box-shadow:0 14px 36px -10px ", brandColor, "a6,0 0 0 18px ", brandColor, "00}",
      "100%{box-shadow:0 14px 36px -10px ", brandColor, "a6,0 0 0 0 ", brandColor, "00}}",
      "@keyframes tcFabBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
      "@keyframes tcRingOut{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.55);opacity:0}}",
      "@keyframes tcPanelIn{0%{opacity:0;transform:translateY(28px) scale(.92);filter:blur(6px)}",
      "100%{opacity:1;transform:none;filter:none}}",
      "@keyframes tcPanelOut{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(16px) scale(.96)}}",
      "@keyframes tcLabelIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}",

      "#tc-fab{position:fixed;",
      side, ":18px;bottom:", bottom, ";z-index:", z,
      ";width:68px;height:68px;border-radius:50%;border:none;cursor:pointer;padding:0;",
      "background:radial-gradient(circle at 35% 30%,#2a2d38 0%,#0a0b10 70%);color:#fff;",
      "font-weight:800;font-size:12px;letter-spacing:.02em;",
      "box-shadow:0 14px 36px -10px ", brandColor, "8c,0 0 0 3px ", brandColor, "59,0 0 0 5px rgba(0,0,0,.35);",
      "display:grid;place-items:center;isolation:isolate;overflow:visible;",
      "transition:transform .25s cubic-bezier(.34,1.56,.64,1),filter .15s,box-shadow .2s;",
      "animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both}",
      "#tc-fab:hover{transform:scale(1.1);filter:brightness(1.1);",
      "box-shadow:0 16px 40px -8px ", brandColor, "b3,0 0 0 3px ", brandColor, "80,0 0 24px ", brandColor, "59}",
      "#tc-fab:active{transform:scale(.93)}",
      "#tc-fab.has-pulse{animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both,",
      "tcFabPulse 2.4s ease-out 1.1s infinite,tcFabBob 3.2s ease-in-out 1.4s infinite}",
      "#tc-fab.is-open{animation:none;background:linear-gradient(145deg,#2a2d3a,#12141c);",
      "box-shadow:0 12px 28px -10px rgba(0,0,0,.5),0 0 0 3px rgba(255,255,255,.12)}",
      "#tc-fab .tc-ring,#tc-fab .tc-ring2{position:absolute;inset:-7px;border-radius:50%;",
      "border:2px solid ", brandColor, "80;pointer-events:none;opacity:0}",
      "#tc-fab.has-pulse .tc-ring{animation:tcRingOut 2.4s ease-out 1.2s infinite}",
      "#tc-fab.has-pulse .tc-ring2{animation:tcRingOut 2.4s ease-out 2s infinite}",
      "#tc-fab .tc-fab-inner{position:relative;width:100%;height:100%;display:grid;place-items:center;",
      "border-radius:50%;overflow:hidden}",
      "#tc-fab .tc-fab-img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;",
      "transform:scale(1.08)}",
      "#tc-fab .tc-fab-ico{font-size:22px;line-height:1}",
      "#tc-fab .tc-fab-label{display:none}",
      "#tc-fab.is-open .tc-fab-inner{background:transparent}",
      "#tc-fab.is-open .tc-fab-ico{font-size:18px;font-weight:800}",
      "#tc-fab .tc-badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;border-radius:11px;",
      "background:linear-gradient(145deg,#34d399,#059669);border:2px solid #0a0b10;display:none;",
      "box-shadow:0 2px 8px rgba(16,185,129,.5);z-index:2;color:#042f1a;font-size:11px;font-weight:800;",
      "line-height:18px;text-align:center;padding:0 5px}",
      "#tc-fab .tc-badge.has-count{display:block}",
      "#tc-fab.has-pulse .tc-badge:not(.has-count){display:block}",

      "#tc-tip{position:fixed;",
      side, ":92px;bottom:calc(", bottom, " + 14px);z-index:", z,
      ";background:rgba(12,14,20,.94);color:#fff;font-size:12px;font-weight:600;",
      "padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);",
      "box-shadow:0 12px 32px -12px rgba(0,0,0,.55);pointer-events:none;",
      "opacity:0;transform:translateY(6px);transition:opacity .25s,transform .3s cubic-bezier(.22,1,.36,1);",
      "backdrop-filter:blur(12px);white-space:nowrap}",
      "#tc-tip.show{opacity:1;transform:none;animation:tcLabelIn .35s ease}",
      "#tc-tip strong{color:#fecaca}",
      "#tc-tip::after{content:'';position:absolute;top:50%;",
      side === "right" ? "right" : "left", ":-5px;margin-top:-5px;border:5px solid transparent;",
      side === "right" ? "border-left-color:rgba(12,14,20,.94)" : "border-right-color:rgba(12,14,20,.94)",
      "}",

      "#tc-panel{position:fixed;",
      side, ":14px;bottom:calc(", bottom, " + 78px);z-index:", z,
      ";width:min(420px,calc(100vw - 20px));height:min(640px,calc(100vh - 110px));",
      "display:none;flex-direction:column;border-radius:20px;overflow:hidden;",
      "box-shadow:0 32px 80px -20px rgba(0,0,0,.7),0 0 0 1px ", brandColor, "26;",
      "transform-origin:bottom ", origin, "}",
      "#tc-panel.open{display:flex;animation:tcPanelIn .4s cubic-bezier(.22,1,.36,1) both}",
      "#tc-panel.closing{display:flex;animation:tcPanelOut .24s ease forwards;pointer-events:none}",
      "#tc-panel-inner{flex:1;min-height:0;display:flex;flex-direction:column}",
      /* A floating card with margin on every side, not an edge-to-edge sheet —
         94vh/left:0/right:0/bottom:0 read as the chat taking over the whole
         screen rather than opening a widget panel. */
      "@media(max-width:480px){#tc-panel{left:10px;right:10px;bottom:10px;width:auto;height:min(72vh,600px);",
      "border-radius:20px;transform-origin:bottom center}",
      "#tc-tip{display:none!important}}",
    ].join("");
    document.head.appendChild(style);

    if (!document.getElementById("truchat-font")) {
      var link = document.createElement("link");
      link.id = "truchat-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }

    var root = document.createElement("div");
    root.id = "tc-widget-root";
    root.setAttribute("data-truchat", "1");

    var tip = document.createElement("div");
    tip.id = "tc-tip";
    tip.innerHTML = "Chat with <strong>" + esc(assistantName) + "</strong> — stock, finance & trade-ins";

    function fabClosedHtml() {
      return (
        '<span class="tc-ring" aria-hidden="true"></span>' +
        '<span class="tc-ring2" aria-hidden="true"></span>' +
        '<span class="tc-badge" aria-hidden="true"></span>' +
        '<span class="tc-fab-inner">' +
        (fabIcon
          ? '<img class="tc-fab-img" src="' +
            fabIcon.replace(/"/g, "") +
            '" alt="' + esc(dealerName) + '" width="68" height="68" />'
          : '<span class="tc-fab-ico" aria-hidden="true">' + esc(assistantName.charAt(0)) + '</span>') +
        "</span>"
      );
    }

    function fabOpenHtml() {
      return '<span class="tc-fab-inner"><span class="tc-fab-ico" aria-hidden="true">✕</span></span>';
    }

    var fab = document.createElement("button");
    fab.id = "tc-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Chat with " + assistantName);
    fab.innerHTML = fabClosedHtml();

    var panel = document.createElement("div");
    panel.id = "tc-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat with " + assistantName);
    var inner = document.createElement("div");
    inner.id = "tc-panel-inner";
    panel.appendChild(inner);

    root.appendChild(panel);
    root.appendChild(tip);
    root.appendChild(fab);
    document.body.appendChild(root);

    var ui = null;
    var open = false;
    var tipTimer = null;
    var badgeEl = null;

    function updateBadge(count) {
      if (!badgeEl) badgeEl = fab.querySelector(".tc-badge");
      if (!badgeEl) return;
      if (open) { badgeEl.classList.remove("has-count"); badgeEl.textContent = ""; return; }
      if (count > 0) {
        badgeEl.classList.add("has-count");
        badgeEl.textContent = count > 9 ? "9+" : String(count);
      } else {
        badgeEl.classList.remove("has-count");
        badgeEl.textContent = "";
      }
    }

    function showTip(ms) {
      tip.classList.add("show");
      clearTimeout(tipTimer);
      if (ms) {
        tipTimer = setTimeout(function () {
          tip.classList.remove("show");
        }, ms);
      }
    }

    var toggleLock = false;

    function setOpen(v) {
      var want = !!v;
      if (toggleLock) return;
      if (want === open && !(want && panel.classList.contains("closing"))) return;

      toggleLock = true;
      setTimeout(function () { toggleLock = false; }, 350);

      tip.classList.remove("show");

      if (!want && open) {
        open = false;
        panel.classList.remove("open");
        panel.classList.add("closing");
        fab.classList.remove("is-open");
        fab.classList.add("has-pulse");
        fab.innerHTML = fabClosedHtml();
        setTimeout(function () {
          panel.classList.remove("closing");
        }, 240);
        return;
      }

      open = want;
      panel.classList.remove("closing");
      panel.classList.toggle("open", open);
      fab.classList.toggle("has-pulse", !open);
      fab.classList.toggle("is-open", open);
      fab.innerHTML = open ? fabOpenHtml() : fabClosedHtml();

      if (open) {
        if (ui) ui.clearUnread();
        updateBadge(0);
        if (!ui) {
          ui = window.TruChatUI.mount(inner, {
            config: CFG_UI,
            showFoot: true,
            onClose: function () {
              setOpen(false);
            },
            onUnread: function (count) {
              updateBadge(count);
            },
          });
        }
        setTimeout(function () {
          if (ui) ui.focus();
        }, 120);
      }
    }

    fab.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!open);
    });
    fab.addEventListener("mouseenter", function () {
      if (!open) showTip(0);
    });
    fab.addEventListener("mouseleave", function () {
      if (!open) tip.classList.remove("show");
    });

    setTimeout(function () {
      if (!open) {
        fab.classList.add("has-pulse");
        showTip(4500);
      }
    }, 2800);

    if (autoOpen) setOpen(true);

    window.TruChatWidget = {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      toggle: function () { setOpen(!open); },
    };
  }

  ready(boot);
})();
