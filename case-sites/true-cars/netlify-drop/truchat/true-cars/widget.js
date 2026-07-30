/**
 * True-Cars · TruChat floating widget
 *
 * Joinchat = bottom-left on live site → we default bottom-right.
 *
 * <script src="…/qualifier.js"></script>
 * <script src="…/chat-core.js"></script>
 * <script src="…/config.js"></script>
 * <script src="…/widget.js" data-bottom="24px" data-position="right" defer></script>
 */
(function () {
  "use strict";

  if (window.__TRUECARS_TRUCHAT_WIDGET__) return;
  window.__TRUECARS_TRUCHAT_WIDGET__ = true;

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

  /** Resolve asset relative to widget.js (works on WP + file://) */
  function resolveAsset(path) {
    var p = path || "assets/truecars-mark.jpg";
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

  function boot() {
    if (!window.TruChatQualifier || !window.TruChatUI || !window.TRUECARS_TRUCHAT_CONFIG) {
      console.error("[TruChat True-Cars] Load qualifier.js, chat-core.js, and true-cars/config.js?v=4 before widget.js");
      return;
    }

    var CFG = window.TRUECARS_TRUCHAT_CONFIG;
    var fabIcon = resolveAsset(CFG.fabIconUrl || CFG.logoUrl || "assets/truecars-mark.jpg");
    var logoResolved = resolveAsset(CFG.logoUrl || CFG.fabIconUrl || "assets/truecars-mark.jpg");
    var CFG_UI = Object.assign({}, CFG, { logoUrl: logoResolved, fabIconUrl: fabIcon });
    var side = position === "left" ? "left" : "right";
    var origin = side === "left" ? "left" : "right";

    var style = document.createElement("style");
    style.id = "truchat-widget-chrome";
    style.textContent = [
      "#tc-widget-root{all:initial;font-family:Archivo,Inter,system-ui,-apple-system,Segoe UI,sans-serif}",
      "#tc-widget-root *{box-sizing:border-box}",
      "@media(prefers-reduced-motion:reduce){#tc-fab,#tc-panel,#tc-fab .tc-ring,#tc-fab .tc-ring2{animation:none!important}}",

      "@keyframes tcFabIn{0%{opacity:0;transform:scale(.4) translateY(24px)}",
      "60%{opacity:1;transform:scale(1.08) translateY(-2px)}100%{transform:none}}",
      "@keyframes tcFabPulse{0%{box-shadow:0 14px 36px -10px rgba(20,102,224,.65),0 0 0 0 rgba(20,102,224,.5)}",
      "70%{box-shadow:0 14px 36px -10px rgba(20,102,224,.65),0 0 0 18px rgba(20,102,224,0)}",
      "100%{box-shadow:0 14px 36px -10px rgba(20,102,224,.65),0 0 0 0 rgba(20,102,224,0)}}",
      "@keyframes tcFabBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
      "@keyframes tcRingOut{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.55);opacity:0}}",
      "@keyframes tcPanelIn{0%{opacity:0;transform:translateY(28px) scale(.92);filter:blur(6px)}",
      "100%{opacity:1;transform:none;filter:none}}",
      "@keyframes tcPanelOut{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(16px) scale(.96)}}",
      "@keyframes tcLabelIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}",
      "@keyframes tcShine{0%{transform:translateX(-120%) rotate(25deg)}100%{transform:translateX(180%) rotate(25deg)}}",

      /* FAB */
      "#tc-fab{position:fixed;",
      side,
      ":18px;bottom:",
      bottom,
      ";z-index:",
      z,
      ";width:68px;height:68px;border-radius:50%;border:none;cursor:pointer;padding:0;",
      "background:radial-gradient(circle at 35% 30%,#2a2d38 0%,#0a0b10 70%);color:#fff;",
      "font-weight:800;font-size:12px;letter-spacing:.02em;",
      "box-shadow:0 14px 36px -10px rgba(20,102,224,.55),0 0 0 3px rgba(20,102,224,.35),0 0 0 5px rgba(0,0,0,.35);",
      "display:grid;place-items:center;isolation:isolate;overflow:visible;",
      "transition:transform .25s cubic-bezier(.34,1.56,.64,1),filter .15s,box-shadow .2s;",
      "animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both}",
      "#tc-fab:hover{transform:scale(1.1);filter:brightness(1.1);",
      "box-shadow:0 16px 40px -8px rgba(20,102,224,.7),0 0 0 3px rgba(20,102,224,.5),0 0 24px rgba(20,102,224,.35)}",
      "#tc-fab:active{transform:scale(.93)}",
      "#tc-fab.has-pulse{animation:tcFabIn .65s cubic-bezier(.22,1,.36,1) both,",
      "tcFabPulse 2.4s ease-out 1.1s infinite,tcFabBob 3.2s ease-in-out 1.4s infinite}",
      "#tc-fab.is-open{animation:none;background:linear-gradient(145deg,#2a2d3a,#12141c);",
      "box-shadow:0 12px 28px -10px rgba(0,0,0,.5),0 0 0 3px rgba(255,255,255,.12);",
      "z-index:999999}",
      "#tc-fab .tc-ring,#tc-fab .tc-ring2{position:absolute;inset:-7px;border-radius:50%;",
      "border:2px solid rgba(20,102,224,.5);pointer-events:none;opacity:0}",
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
      "#tc-fab .tc-badge{position:absolute;top:-1px;right:-1px;width:15px;height:15px;border-radius:50%;",
      "background:linear-gradient(145deg,#34d399,#059669);border:2px solid #fff;display:none;",
      "box-shadow:0 2px 8px rgba(16,185,129,.5);z-index:2}",
      "#tc-fab.has-pulse .tc-badge{display:block}",

      /* tooltip */
      "#tc-tip{position:fixed;",
      side,
      ":92px;bottom:calc(",
      bottom,
      " + 14px);z-index:",
      z,
      ";background:rgba(12,14,20,.94);color:#fff;font-size:12px;font-weight:600;",
      "padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);",
      "box-shadow:0 12px 32px -12px rgba(0,0,0,.55);pointer-events:none;",
      "opacity:0;transform:translateY(6px);transition:opacity .25s,transform .3s cubic-bezier(.22,1,.36,1);",
      "backdrop-filter:blur(12px);white-space:nowrap}",
      "#tc-tip.show{opacity:1;transform:none;animation:tcLabelIn .35s ease}",
      "#tc-tip strong{color:#9CC4FF}",
      "#tc-tip::after{content:'';position:absolute;top:50%;",
      side === "right" ? "right" : "left",
      ":-5px;margin-top:-5px;border:5px solid transparent;",
      side === "right" ? "border-left-color:rgba(12,14,20,.94)" : "border-right-color:rgba(12,14,20,.94)",
      "}",

      /* panel */
      "#tc-panel{position:fixed;",
      side,
      ":14px;bottom:calc(",
      bottom,
      " + 78px);z-index:",
      z,
      ";width:min(420px,calc(100vw - 20px));height:min(640px,calc(100vh - 110px));",
      "display:none;flex-direction:column;border-radius:20px;overflow:hidden;",
      "box-shadow:0 32px 80px -20px rgba(0,0,0,.7),0 0 0 1px rgba(20,102,224,.15);",
      "transform-origin:bottom ",
      origin,
      "}",
      "#tc-panel.open{display:flex;animation:tcPanelIn .4s cubic-bezier(.22,1,.36,1) both}",
      "#tc-panel.closing{display:flex;animation:tcPanelOut .24s ease forwards;pointer-events:none}",
      "#tc-panel-inner{flex:1;min-height:0;display:flex;flex-direction:column}",
      "@media(max-width:480px){#tc-panel{left:0;right:0;bottom:0;width:100%;height:min(94vh,760px);",
      "border-radius:22px 22px 0 0;transform-origin:bottom center}",
      "#tc-tip{display:none!important}}",

      /* while the chat is open, clear the corner: hide TruAfford + lens tip + mobile bar */
      "body.tc-chat-open #tru-afford-root{opacity:0;pointer-events:none;transition:opacity .25s}",
      "body.tc-chat-open #tcsaLensTip{display:none!important}",
      "body.tc-chat-open #tcsaMab{display:none!important}",
    ].join("");
    document.head.appendChild(style);

    // No webfont request for the widget. Pulling a whole Inter family (5 weights)
    // from a third party just to style a chat bubble cost a render-blocking
    // request on every page load; the host page's own sans is already loaded.

    var root = document.createElement("div");
    root.id = "tc-widget-root";
    root.setAttribute("data-truchat", "1");

    var tip = document.createElement("div");
    tip.id = "tc-tip";
    tip.innerHTML = "Chat with <strong>True</strong> — stock, finance & trade-ins";

    function fabClosedHtml() {
      return (
        '<span class="tc-ring" aria-hidden="true"></span>' +
        '<span class="tc-ring2" aria-hidden="true"></span>' +
        '<span class="tc-badge" aria-hidden="true"></span>' +
        '<span class="tc-fab-inner">' +
        (fabIcon
          ? '<img class="tc-fab-img" src="' +
            fabIcon.replace(/"/g, "") +
            '" alt="True-Cars" width="68" height="68" />'
          : '<span class="tc-fab-ico" aria-hidden="true">Y</span>') +
        "</span>"
      );
    }

    function fabOpenHtml() {
      return (
        '<span class="tc-fab-inner"><span class="tc-fab-ico" aria-hidden="true">✕</span></span>'
      );
    }

    var fab = document.createElement("button");
    fab.id = "tc-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Chat with " + (CFG.assistantName || "True"));
    fab.innerHTML = fabClosedHtml();

    var panel = document.createElement("div");
    panel.id = "tc-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat with True");
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

    function showTip(ms) {
      tip.classList.add("show");
      clearTimeout(tipTimer);
      if (ms) {
        tipTimer = setTimeout(function () {
          tip.classList.remove("show");
        }, ms);
      }
    }

    function setOpen(v) {
      var want = !!v;
      if (want === open && !(want && panel.classList.contains("closing"))) return;

      tip.classList.remove("show");

      if (!want && open) {
        open = false;
        document.body.classList.remove("tc-chat-open");
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
      document.body.classList.toggle("tc-chat-open", open);
      panel.classList.remove("closing");
      panel.classList.toggle("open", open);
      fab.classList.toggle("has-pulse", !open);
      fab.classList.toggle("is-open", open);
      fab.innerHTML = open ? fabOpenHtml() : fabClosedHtml();

      if (open) {
        if (!ui) {
          ui = window.TruChatUI.mount(inner, {
            config: CFG_UI,
            showFoot: true,
            onClose: function () {
              setOpen(false);
            },
          });
        }
        setTimeout(function () {
          if (ui) ui.focus();
        }, 120);
      }
    }

    fab.addEventListener("click", function () {
      setOpen(!open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) setOpen(false);
    });
    fab.addEventListener("mouseenter", function () {
      if (!open) showTip(0);
    });
    fab.addEventListener("mouseleave", function () {
      if (!open) tip.classList.remove("show");
    });

    // Attention sequence for first-time visitors
    setTimeout(function () {
      if (!open) {
        fab.classList.add("has-pulse");
        showTip(4500);
      }
    }, 2800);

    if (autoOpen) setOpen(true);

    window.TrueCarsTruChatWidget = {
      open: function () {
        setOpen(true);
      },
      close: function () {
        setOpen(false);
      },
      toggle: function () {
        setOpen(!open);
      },
    };
  }

  ready(boot);
})();

