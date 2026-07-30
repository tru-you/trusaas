/**
 * Your Car Guy — TruChat floating widget(s) (WordPress)
 *
 * Renders ONE or TWO floating chat bubbles depending on CFG.skin:
 *   - "default"  → one premium (dealer-colour) bubble, bottom-right
 *   - "whatsapp" → one WhatsApp-styled bubble
 *   - "both"     → TWO bubbles at once: a WhatsApp-styled one (bottom-left,
 *                  raised to clear the Seriti finance button) and the premium
 *                  AI "Ray" one (bottom-right). Both open the same Ray brain.
 *
 * Each bubble is an independent instance with its own ids/positioning, so the
 * two never collide. Both mount window.TruChatUI, passing a per-instance skin.
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

  var dataBottom = (script && script.getAttribute("data-bottom")) || "24px";
  var dataPos = (script && script.getAttribute("data-position")) || "right";
  var autoOpen = script && script.getAttribute("data-open") === "1";
  var Z = (script && script.getAttribute("data-z")) || "999990";

  /** Resolve asset relative to widget.js (works on WP + file://) */
  function resolveAsset(path) {
    var p = path || "assets/ycg-icon.jpg";
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

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  // WhatsApp logo glyph (white) for the floating button.
  var WA_GLYPH =
    '<svg class="tc-wa-glyph" viewBox="0 0 32 32" fill="#fff" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M16.03 5.33c-5.87 0-10.64 4.76-10.64 10.63 0 1.87.49 3.7 1.42 5.31L5.33 26.67l5.53-1.45c1.55.85 ' +
    "3.3 1.29 5.08 1.29h.01c5.86 0 10.63-4.76 10.63-10.63 0-2.84-1.11-5.51-3.11-7.52a10.56 10.56 0 0 0-7.52-3.03zm0 " +
    "19.35h-.01c-1.59 0-3.15-.43-4.51-1.24l-.32-.19-3.28.86.88-3.2-.21-.33a8.83 8.83 0 0 1-1.35-4.7c0-4.88 3.97-8.85 " +
    "8.85-8.85 2.36 0 4.58.92 6.25 2.6a8.8 8.8 0 0 1 2.59 6.26c0 4.88-3.97 8.85-8.84 8.85zm4.85-6.62c-.27-.13-1.57-.78-1.82-.86-.24-.09-.42-.13-.6.13-.18.27-.68.86-.84 " +
    "1.04-.15.18-.31.2-.58.07-.27-.13-1.12-.41-2.14-1.32-.79-.7-1.32-1.57-1.48-1.84-.15-.27-.02-.41.12-.54.12-.12.27-.31.4-.47.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.47-.07-.13-.6-1.45-.83-1.98-.22-.52-.44-.45-.6-.46-.15-.01-.33-.01-.51-.01s-.47.07-.72.34c-.24.27-.94.92-.94 " +
    '2.25 0 1.32.97 2.6 1.1 2.78.13.18 1.9 2.9 4.6 4.07.64.28 1.14.44 1.53.57.64.2 1.23.17 1.69.11.52-.08 1.57-.64 1.79-1.26.22-.62.22-1.15.16-1.26-.07-.11-.24-.18-.51-.31z"/></svg>';

  /* ---- shared, position-independent styling (injected once) ------------- */

  var SHARED_CSS_ID = "truchat-widget-chrome";
  var WA_CSS_ID = "truchat-widget-wa";

  function ensureWaCss() {
    if (document.getElementById(WA_CSS_ID)) return;
    var s = document.createElement("style");
    s.id = WA_CSS_ID;
    s.textContent = [
      "@keyframes tcFabPulseWa{0%{box-shadow:0 14px 36px -10px rgba(37,211,102,.6),0 0 0 0 rgba(37,211,102,.5)}",
      "70%{box-shadow:0 14px 36px -10px rgba(37,211,102,.6),0 0 0 18px rgba(37,211,102,0)}",
      "100%{box-shadow:0 14px 36px -10px rgba(37,211,102,.6),0 0 0 0 rgba(37,211,102,0)}}",
      ".tc-fab.tc-wa{background:radial-gradient(circle at 35% 30%,#42d980 0%,#25d366 55%,#1ebe5d 100%)!important;",
      "box-shadow:0 14px 36px -10px rgba(37,211,102,.55),0 0 0 3px rgba(37,211,102,.35),0 0 0 5px rgba(0,0,0,.25)!important}",
      ".tc-fab.tc-wa:hover{box-shadow:0 16px 40px -8px rgba(37,211,102,.75),0 0 0 3px rgba(37,211,102,.5),0 0 24px rgba(37,211,102,.4)!important}",
      ".tc-fab.tc-wa.has-pulse{animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both,",
      "tcFabPulseWa 2.4s ease-out 1.1s infinite,tcFabBob 3.2s ease-in-out 1.4s infinite}",
      ".tc-fab.tc-wa .tc-ring,.tc-fab.tc-wa .tc-ring2{border-color:rgba(37,211,102,.5)}",
      ".tc-fab.tc-wa.is-open{background:linear-gradient(145deg,#128c7e,#008069)!important}",
      ".tc-fab.tc-wa .tc-badge{background:linear-gradient(145deg,#25d366,#059669)}",
      ".tc-fab.tc-wa .tc-wa-glyph{width:46px;height:46px;display:block}",
    ].join("");
    document.head.appendChild(s);
  }

  function injectSharedCss() {
    if (document.getElementById(SHARED_CSS_ID)) return;
    var style = document.createElement("style");
    style.id = SHARED_CSS_ID;
    style.textContent = [
      ".tc-widget-root{all:initial;font-family:Inter,system-ui,sans-serif}",
      ".tc-widget-root *{box-sizing:border-box}",
      "@media(prefers-reduced-motion:reduce){.tc-fab,.tc-panel,.tc-fab .tc-ring,.tc-fab .tc-ring2{animation:none!important}}",

      "@keyframes tcFabIn{0%{opacity:0;transform:scale(.4) translateY(24px)}",
      "60%{opacity:1;transform:scale(1.08) translateY(-2px)}100%{transform:none}}",
      "@keyframes tcFabPulse{0%{box-shadow:0 14px 36px -10px rgba(227,6,19,.65),0 0 0 0 rgba(227,6,19,.5)}",
      "70%{box-shadow:0 14px 36px -10px rgba(227,6,19,.65),0 0 0 18px rgba(227,6,19,0)}",
      "100%{box-shadow:0 14px 36px -10px rgba(227,6,19,.65),0 0 0 0 rgba(227,6,19,0)}}",
      "@keyframes tcFabBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
      "@keyframes tcRingOut{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.55);opacity:0}}",
      "@keyframes tcPanelIn{0%{opacity:0;transform:translateY(28px) scale(.92);filter:blur(6px)}",
      "100%{opacity:1;transform:none;filter:none}}",
      "@keyframes tcPanelOut{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(16px) scale(.96)}}",
      "@keyframes tcLabelIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}",

      /* FAB (positioning comes from inline styles per instance) */
      ".tc-fab{position:fixed;width:68px;height:68px;border-radius:50%;border:none;cursor:pointer;padding:0;",
      "background:radial-gradient(circle at 35% 30%,#2a2d38 0%,#0a0b10 70%);color:#fff;",
      "font-weight:800;font-size:12px;letter-spacing:.02em;",
      "box-shadow:0 14px 36px -10px rgba(227,6,19,.55),0 0 0 3px rgba(227,6,19,.35),0 0 0 5px rgba(0,0,0,.35);",
      "display:grid;place-items:center;isolation:isolate;overflow:visible;",
      "transition:transform .25s cubic-bezier(.34,1.56,.64,1),filter .15s,box-shadow .2s;",
      "animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both}",
      ".tc-fab:hover{transform:scale(1.1);filter:brightness(1.1);",
      "box-shadow:0 16px 40px -8px rgba(227,6,19,.7),0 0 0 3px rgba(227,6,19,.5),0 0 24px rgba(227,6,19,.35)}",
      ".tc-fab:active{transform:scale(.93)}",
      ".tc-fab.has-pulse{animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both,",
      "tcFabPulse 2.4s ease-out 1.1s infinite,tcFabBob 3.2s ease-in-out 1.4s infinite}",
      ".tc-fab.is-open{animation:none;background:linear-gradient(145deg,#2a2d3a,#12141c);",
      "box-shadow:0 12px 28px -10px rgba(0,0,0,.5),0 0 0 3px rgba(255,255,255,.12)}",
      ".tc-fab .tc-ring,.tc-fab .tc-ring2{position:absolute;inset:-7px;border-radius:50%;",
      "border:2px solid rgba(227,6,19,.5);pointer-events:none;opacity:0}",
      ".tc-fab.has-pulse .tc-ring{animation:tcRingOut 2.4s ease-out 1.2s infinite}",
      ".tc-fab.has-pulse .tc-ring2{animation:tcRingOut 2.4s ease-out 2s infinite}",
      ".tc-fab .tc-fab-inner{position:relative;width:100%;height:100%;display:grid;place-items:center;",
      "border-radius:50%;overflow:hidden}",
      ".tc-fab .tc-fab-img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;",
      "transform:scale(1.08)}",
      ".tc-fab .tc-fab-ico{font-size:22px;line-height:1}",
      ".tc-fab.is-open .tc-fab-inner{background:transparent}",
      ".tc-fab.is-open .tc-fab-ico{font-size:18px;font-weight:800}",
      ".tc-fab .tc-badge{position:absolute;top:-1px;right:-1px;width:15px;height:15px;border-radius:50%;",
      "background:linear-gradient(145deg,#34d399,#059669);border:2px solid #fff;display:none;",
      "box-shadow:0 2px 8px rgba(16,185,129,.5);z-index:2}",
      ".tc-fab.has-pulse .tc-badge{display:block}",

      /* tooltip */
      ".tc-tip{position:fixed;background:rgba(12,14,20,.94);color:#fff;font-size:12px;font-weight:600;",
      "padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);",
      "box-shadow:0 12px 32px -12px rgba(0,0,0,.55);pointer-events:none;",
      "opacity:0;transform:translateY(6px);transition:opacity .25s,transform .3s cubic-bezier(.22,1,.36,1);",
      "backdrop-filter:blur(12px);white-space:nowrap}",
      ".tc-tip.show{opacity:1;transform:none;animation:tcLabelIn .35s ease}",
      ".tc-tip strong{color:#fecaca}",
      ".tc-tip.tc-tip-right::after{content:'';position:absolute;top:50%;right:-5px;margin-top:-5px;",
      "border:5px solid transparent;border-left-color:rgba(12,14,20,.94)}",
      ".tc-tip.tc-tip-left::after{content:'';position:absolute;top:50%;left:-5px;margin-top:-5px;",
      "border:5px solid transparent;border-right-color:rgba(12,14,20,.94)}",

      /* panel (positioning comes from inline styles per instance) */
      ".tc-panel{position:fixed;width:min(420px,calc(100vw - 20px));",
      "display:none;flex-direction:column;border-radius:20px;overflow:hidden;",
      "box-shadow:0 32px 80px -20px rgba(0,0,0,.7),0 0 0 1px rgba(227,6,19,.15)}",
      ".tc-panel.open{display:flex;animation:tcPanelIn .4s cubic-bezier(.22,1,.36,1) both}",
      ".tc-panel.closing{display:flex;animation:tcPanelOut .24s ease forwards;pointer-events:none}",
      ".tc-panel-inner{flex:1;min-height:0;display:flex;flex-direction:column}",
      "@media(max-width:480px){.tc-panel{left:0!important;right:0!important;bottom:0!important;",
      "width:100%;height:min(94vh,760px);border-radius:22px 22px 0 0;transform-origin:bottom center!important}",
      ".tc-tip{display:none!important}}",
    ].join("");
    document.head.appendChild(style);

    if (!document.getElementById("truchat-font")) {
      var link = document.createElement("link");
      link.id = "truchat-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }

  /* ---- one floating bubble instance ------------------------------------- */

  var instanceCount = 0;

  function createWidget(cfgUi, fabIcon, opts) {
    opts = opts || {};
    var side = opts.side === "left" ? "left" : "right";
    var bottom = opts.bottom || "24px";
    var skin = opts.skin || "default";
    var waSkin = skin === "whatsapp";
    var bnum = parseInt(bottom, 10);
    if (isNaN(bnum)) bnum = 24;
    instanceCount++;
    if (waSkin) ensureWaCss();

    function fabClosedHtml() {
      var inner = waSkin
        ? WA_GLYPH
        : fabIcon
        ? '<img class="tc-fab-img" src="' + fabIcon.replace(/"/g, "") + '" alt="" width="68" height="68" />'
        : '<span class="tc-fab-ico" aria-hidden="true">Y</span>';
      return (
        '<span class="tc-ring" aria-hidden="true"></span>' +
        '<span class="tc-ring2" aria-hidden="true"></span>' +
        '<span class="tc-badge" aria-hidden="true"></span>' +
        '<span class="tc-fab-inner">' +
        inner +
        "</span>"
      );
    }
    function fabOpenHtml() {
      return '<span class="tc-fab-inner"><span class="tc-fab-ico" aria-hidden="true">✕</span></span>';
    }

    var root = document.createElement("div");
    root.className = "tc-widget-root";
    root.setAttribute("data-truchat", "1");

    var tip = document.createElement("div");
    tip.className = "tc-tip tc-tip-" + side;
    tip.style.cssText =
      side + ":92px;bottom:" + (bnum + 14) + "px;z-index:" + Z + ";";
    tip.innerHTML = opts.label || "Chat with <strong>Ray</strong>";

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "tc-fab" + (waSkin ? " tc-wa" : "");
    fab.style.cssText = side + ":18px;bottom:" + bottom + ";z-index:" + Z + ";";
    fab.setAttribute("aria-label", opts.ariaLabel || "Open chat");
    fab.innerHTML = fabClosedHtml();

    var panel = document.createElement("div");
    panel.className = "tc-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", opts.ariaLabel || "Chat");
    panel.style.cssText =
      side +
      ":14px;bottom:" +
      (bnum + 78) +
      "px;height:min(640px,calc(100vh - " +
      (bnum + 96) +
      "px));z-index:" +
      Z +
      ";transform-origin:bottom " +
      side +
      ";";
    var inner = document.createElement("div");
    inner.className = "tc-panel-inner";
    panel.appendChild(inner);

    root.appendChild(panel);
    root.appendChild(tip);
    root.appendChild(fab);
    document.body.appendChild(root);

    var ui = null;
    var open = false;
    var tipTimer = null;

    function showTip(ms) {
      tip.classList.add("show");
      clearTimeout(tipTimer);
      if (ms) tipTimer = setTimeout(function () { tip.classList.remove("show"); }, ms);
    }

    function setOpen(v) {
      var want = !!v;
      if (want === open && !(want && panel.classList.contains("closing"))) return;
      tip.classList.remove("show");

      if (!want && open) {
        open = false;
        panel.classList.remove("open");
        panel.classList.add("closing");
        fab.classList.remove("is-open");
        fab.classList.add("has-pulse");
        fab.innerHTML = fabClosedHtml();
        setTimeout(function () { panel.classList.remove("closing"); }, 240);
        return;
      }

      open = want;
      panel.classList.remove("closing");
      panel.classList.toggle("open", open);
      fab.classList.toggle("has-pulse", !open);
      fab.classList.toggle("is-open", open);
      fab.innerHTML = open ? fabOpenHtml() : fabClosedHtml();

      if (open) {
        if (!ui) {
          ui = window.TruChatUI.mount(inner, {
            config: cfgUi,
            skin: skin,
            showFoot: true,
            onClose: function () { setOpen(false); },
          });
        }
        setTimeout(function () { if (ui) ui.focus(); }, 120);
      }
    }

    fab.addEventListener("click", function () { setOpen(!open); });
    fab.addEventListener("mouseenter", function () { if (!open) showTip(0); });
    fab.addEventListener("mouseleave", function () { if (!open) tip.classList.remove("show"); });

    // First-visit attention nudge. Both bubbles start pulsing together (matched
    // look); only the tooltips are staggered so two labels don't overlap.
    var myIndex = instanceCount;
    setTimeout(function () {
      if (!open) fab.classList.add("has-pulse");
    }, 2800);
    setTimeout(function () {
      if (!open) showTip(4000);
    }, 2800 + (myIndex - 1) * 5000);

    if (opts.autoOpen) setOpen(true);

    return {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      toggle: function () { setOpen(!open); },
    };
  }

  /* ---- boot ------------------------------------------------------------- */

  function boot(attempt) {
    attempt = attempt || 0;
    if (!window.TruChatQualifier || !window.TruChatUI || !window.RAY_TRUCHAT_CONFIG) {
      if (attempt < 25) {
        window.setTimeout(function () { boot(attempt + 1); }, 120);
        return;
      }
      console.error("[TruChat] Load qualifier.js, chat-core.js, and config before widget.js");
      return;
    }

    var CFG = window.RAY_TRUCHAT_CONFIG;
    var mode = CFG.skin || "default"; // "default" | "whatsapp" | "both"
    var fabIcon = resolveAsset(CFG.fabIconUrl || CFG.logoUrl || "assets/ycg-icon.jpg");
    var logoResolved = resolveAsset(CFG.logoUrl || CFG.fabIconUrl || "assets/ycg-icon.jpg");
    var cfgUi = Object.assign({}, CFG, { logoUrl: logoResolved, fabIconUrl: fabIcon });

    injectSharedCss();

    var WA_LABEL = "Chat with us on <strong>WhatsApp</strong>";
    var AI_LABEL = "Chat with <strong>Ray</strong> — stock, finance & trade-ins";

    if (mode === "both") {
      // Positions are settings-driven so the WhatsApp bubble can be moved clear
      // of whatever a site puts in a corner (e.g. a Seriti finance button
      // bottom-left) without editing this file. Defaults keep the previous
      // layout: WhatsApp bottom-LEFT raised to 150px, Ray bottom-RIGHT at 24px.
      var norm = function (v, d) {
        v = (v == null ? "" : String(v)).trim();
        if (!v) return d;
        return /^\d+$/.test(v) ? v + "px" : v; // bare number → px
      };
      var waSide = CFG.waSide === "right" ? "right" : "left";
      var aiSide = CFG.aiSide === "left" ? "left" : "right";
      var wa = createWidget(cfgUi, fabIcon, {
        side: waSide, bottom: norm(CFG.waBottom, "150px"), skin: "whatsapp",
        label: WA_LABEL, ariaLabel: "Chat with us on WhatsApp", autoOpen: false,
      });
      var ai = createWidget(cfgUi, fabIcon, {
        side: aiSide, bottom: norm(CFG.aiBottom, "24px"), skin: "default",
        label: AI_LABEL, ariaLabel: "Chat with " + (CFG.assistantName || "Ray"), autoOpen: autoOpen,
      });
      window.TruChatWidget = ai;
      window.TruChatWidgetWhatsApp = wa;
    } else if (mode === "whatsapp") {
      window.TruChatWidget = createWidget(cfgUi, fabIcon, {
        side: dataPos, bottom: dataBottom, skin: "whatsapp",
        label: WA_LABEL, ariaLabel: "Chat with us on WhatsApp", autoOpen: autoOpen,
      });
    } else {
      window.TruChatWidget = createWidget(cfgUi, fabIcon, {
        side: dataPos, bottom: dataBottom, skin: "default",
        label: AI_LABEL, ariaLabel: "Chat with " + (CFG.assistantName || "Ray"), autoOpen: autoOpen,
      });
    }
  }

  ready(function () { boot(0); });
})();
