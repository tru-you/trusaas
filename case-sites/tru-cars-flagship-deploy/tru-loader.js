/**
 * TruLoader — Universal Widget Loader (TruDealer / TruSaaS)
 *
 * One script tag to orchestrate all canonical dealer widgets:
 *   - TruAfford (affordability / soft pre-qual calculator)
 *   - TruRepay  (finance repayment calculator)
 *   - TruForm   (contact & enquiry capture)
 *   - TruChat   (AI showroom chat & qualifier)
 *
 * Features:
 *   - Shared global config (accent, dealer, wa, flow, slug)
 *   - Automatic FAB vertical stacking on mobile & desktop
 *   - Cross-widget communication & event bus
 *   - Unified window.TruDealer / window.TruSaaS JS API
 *
 * Usage:
 *   <script src="tru-loader.js"
 *           data-dealer="Cars on Caledon"
 *           data-slug="cars-on-caledon"
 *           data-flow="https://premium.tru-saas.com"
 *           data-wa="27618759389"
 *           data-accent="#e30613"
 *           data-widgets="afford,repay,form,chat"
 *           data-repay-target="#finance-calc"
 *           data-repay-price="459900"
 *           data-repay-vehicle="2023 Toyota Fortuner 2.8 GD-6"></script>
 */
(function (root) {
  "use strict";

  if (root.__TruLoaderLoaded) return;
  root.__TruLoaderLoaded = true;

  var script =
    document.currentScript ||
    (function () {
      var list = document.getElementsByTagName("script");
      return list[list.length - 1];
    })();

  function getAttr(name, fallback) {
    return (script && script.getAttribute(name)) || fallback;
  }

  // Base configurations
  var globalCfg = {
    dealer: getAttr("data-dealer", "this dealership"),
    slug: getAttr("data-slug", ""),
    flow: getAttr("data-flow", ""),
    wa: (getAttr("data-wa", "") || "").replace(/\D/g, ""),
    accent: getAttr("data-accent", "#1466E0"),
    accent2: getAttr("data-accent-2", ""),
    brand: getAttr("data-brand", "TruDealer"),
    theme: getAttr("data-theme", "dark"),
    position: getAttr("data-position", "right"),
    baseBottom: parseInt(getAttr("data-bottom", "24"), 10) || 24,
    widgets: (getAttr("data-widgets", "afford,repay,form,chat") || "")
      .split(",")
      .map(function (s) {
        return s.trim().toLowerCase();
      })
      .filter(Boolean),
  };

  // Resolve base script path for loading sub-widgets
  var scriptSrc = (script && script.src) || "";
  var baseUrl = scriptSrc ? scriptSrc.substring(0, scriptSrc.lastIndexOf("/") + 1) || "./" : "./";

  function loadScript(url, callback) {
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = function () {
      if (callback) callback();
    };
    s.onerror = function () {
      console.error("[TruLoader] Failed to load script:", url);
    };
    document.head.appendChild(s);
  }

/* DEPLOY-ADAPTED COPY — do NOT blind-copy canonical over this file.
   Widgets sit FLAT in this site root, not in packages/<name>/.
   Canonical resolves "tru-form/tru-form.js"; here that 404s and every
   widget silently fails to mount. Port canonical changes by hand. */
  function getScriptUrl(relPath) {
    if (baseUrl.includes("tru-loader")) {
      return baseUrl.replace(/tru-loader.*$/, relPath);
    }
    return baseUrl + relPath;
  }

  // Helper to load chat stack in order
  function loadChatStack(onComplete) {
    var chatBase = getScriptUrl("truchat/shared/qualifier.js").replace("qualifier.js", "");

    // Load dealer-specific config if available (e.g. truchat/coc/config.js)
    var configUrl = getScriptUrl("truchat/true-cars/config.js");

    loadScript(configUrl, function () {
      loadScript(chatBase + "qualifier.js", function () {
        loadScript(chatBase + "chat-core.js", function () {
          // Ensure dummy dealer config if none loaded
          if (!window.TRUECARS_TRUCHAT_CONFIG && !window.RAY_TRUCHAT_CONFIG && !window.COC_TRUCHAT_CONFIG) {
            window.TRUECARS_TRUCHAT_CONFIG = {
              dealerName: globalCfg.dealer,
              brandRed: globalCfg.accent,
              brandRedDark: globalCfg.accent2 || globalCfg.accent,
              assistantName: "TruDealer Assistant",
              salesWhatsApp: globalCfg.wa,
              flowUrl: globalCfg.flow,
              slug: globalCfg.slug,
            };
          }
          loadScript(chatBase + "widget.js", function () {
            if (onComplete) onComplete();
          });
        });
      });
    });
  }

  // Loader Boot
  function boot() {
    var wanted = globalCfg.widgets;

    // 1. TruAfford
    if (wanted.indexOf("afford") !== -1 || wanted.indexOf("tru-afford") !== -1) {
      var affordSrc = getScriptUrl("tru-afford.js");
      var tag = document.createElement("script");
      tag.src = affordSrc;
      tag.setAttribute("data-dealer", globalCfg.dealer);
      tag.setAttribute("data-wa", globalCfg.wa);
      tag.setAttribute("data-accent", globalCfg.accent);
      tag.setAttribute("data-flow", globalCfg.flow);
      tag.setAttribute("data-slug", globalCfg.slug);
      tag.setAttribute("data-position", globalCfg.position);
      tag.setAttribute("data-bottom", "92px");
      tag.setAttribute("data-theme", globalCfg.theme);
      document.head.appendChild(tag);
    }

    // 2. TruRepay
    if (wanted.indexOf("repay") !== -1 || wanted.indexOf("tru-repay") !== -1) {
      var repaySrc = getScriptUrl("tru-repay.js");
      var rTag = document.createElement("script");
      rTag.src = repaySrc;
      rTag.setAttribute("data-dealer", globalCfg.dealer);
      rTag.setAttribute("data-slug", globalCfg.slug);
      rTag.setAttribute("data-flow", globalCfg.flow);
      rTag.setAttribute("data-wa", globalCfg.wa);
      rTag.setAttribute("data-accent", globalCfg.accent);
      rTag.setAttribute("data-mode", getAttr("data-repay-mode", "float"));
      rTag.setAttribute("data-target", getAttr("data-repay-target", "#finance-calc"));
      rTag.setAttribute("data-price", getAttr("data-repay-price", "0"));
      rTag.setAttribute("data-vehicle", getAttr("data-repay-vehicle", ""));
      rTag.setAttribute("data-brand", globalCfg.brand);
      rTag.setAttribute("data-bottom", getAttr("data-repay-bottom", "24px"));
      rTag.setAttribute("data-theme", globalCfg.theme);
      rTag.setAttribute("data-collapsible", getAttr("data-repay-collapsible", "0"));
      document.head.appendChild(rTag);
    }

    // 3. TruForm
    if (wanted.indexOf("form") !== -1 || wanted.indexOf("tru-form") !== -1) {
      var formSrc = getScriptUrl("tru-form.js");
      var fTag = document.createElement("script");
      fTag.src = formSrc;
      fTag.setAttribute("data-dealer", globalCfg.dealer);
      fTag.setAttribute("data-slug", globalCfg.slug);
      fTag.setAttribute("data-flow", globalCfg.flow);
      fTag.setAttribute("data-wa", globalCfg.wa);
      fTag.setAttribute("data-accent", globalCfg.accent);
      fTag.setAttribute("data-mode", getAttr("data-form-mode", "float"));
      fTag.setAttribute("data-target", getAttr("data-form-target", "#contact-form"));
      fTag.setAttribute("data-fields", getAttr("data-form-fields", "vehicle,tradein,finance,location"));
      fTag.setAttribute("data-brand", globalCfg.brand);
      fTag.setAttribute("data-theme", globalCfg.theme);
      fTag.setAttribute("data-position", getAttr("data-form-position", globalCfg.position));
      fTag.setAttribute("data-bottom", getAttr("data-form-bottom", "24px"));
      document.head.appendChild(fTag);
    }

    // 4. TruChat
    if (wanted.indexOf("chat") !== -1 || wanted.indexOf("tru-chat") !== -1) {
      loadChatStack();
    }

    // 5. TruBook
    if (wanted.indexOf("book") !== -1 || wanted.indexOf("tru-book") !== -1) {
      var bookSrc = getScriptUrl("tru-book.js");
      var bTag = document.createElement("script");
      bTag.src = bookSrc;
      bTag.setAttribute("data-dealer", globalCfg.dealer);
      bTag.setAttribute("data-slug", globalCfg.slug);
      bTag.setAttribute("data-flow", globalCfg.flow);
      bTag.setAttribute("data-wa", globalCfg.wa);
      bTag.setAttribute("data-accent", globalCfg.accent);
      bTag.setAttribute("data-brand", globalCfg.brand);
      bTag.setAttribute("data-theme", globalCfg.theme);
      document.head.appendChild(bTag);
    }

    // 6. TruShare — per-vehicle sharing. No OAuth, no tokens, no backend:
    //    the buttons are plain intent URLs and the native share sheet.
    //    Distinct from TruSocial (Zernio) in TruFlow Premium, which posts on
    //    the dealer's behalf to connected accounts and is a paid DMS module.
    //    A site can run both: this is the floor, that one automates.
    if (wanted.indexOf("share") !== -1 || wanted.indexOf("tru-share") !== -1) {
      var shareSrc = getScriptUrl("tru-share.js");
      var sTag = document.createElement("script");
      sTag.src = shareSrc;
      sTag.setAttribute("data-dealer", globalCfg.dealer);
      sTag.setAttribute("data-wa", globalCfg.wa);
      sTag.setAttribute("data-accent", globalCfg.accent);
      sTag.setAttribute("data-site", getAttr("data-share-site", location.origin));
      sTag.setAttribute("data-vehicle-path", getAttr("data-share-vehicle-path", "/vehicle/"));
      sTag.setAttribute("data-fb-page", getAttr("data-share-fb-page", ""));
      sTag.setAttribute("data-ig-handle", getAttr("data-share-ig-handle", ""));
      sTag.setAttribute("data-gbp", getAttr("data-share-gbp", ""));
      document.head.appendChild(sTag);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Unified TruDealer API
  root.TruDealer = root.TruSaaS = {
    version: "2.5.0",
    config: globalCfg,
    open: function (widget, payload) {
      var w = String(widget || "").toLowerCase();
      if (w === "afford" && root.TruAfford) root.TruAfford.open(payload);
      if (w === "repay" && root.TruRepay) root.TruRepay.open(payload);
      if (w === "form" && root.TruForm) root.TruForm.open(payload);
      if (w === "book" && (root.TruBook || root.COCBook)) (root.TruBook || root.COCBook).open(payload);
      if (w === "chat" && root.TruChatUI) {
        var el = document.getElementById("tc-fab");
        if (el) el.click();
      }
    },
    closeAll: function () {
      if (root.TruAfford) root.TruAfford.close();
      if (root.TruRepay) root.TruRepay.close();
      if (root.TruForm) root.TruForm.close();
    },
  };
})(window);
