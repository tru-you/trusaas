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
 *           data-flow="https://premium.trudealers.com"
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
    dealer: getAttr("data-dealer", "Truecars"),
    slug: getAttr("data-slug", "true-cars"),
    flow: (getAttr("data-flow", "https://premium.trudealers.com") || "").replace(/https?:\/\/(premium|flow)\.tru-saas\.com/g, "https://premium.trudealers.com"),
    webhook: getAttr("data-webhook", ""),
    cmbKey: getAttr("data-callmebot-key", ""),
    cmbPhone: getAttr("data-callmebot-phone", ""),
    wa: (getAttr("data-wa", "27620502091") || "").replace(/\D/g, ""),
    accent: getAttr("data-accent", "#07879A"),
    accent2: getAttr("data-accent-2", "#5DE9D4"),
    brand: getAttr("data-brand", "TruDealer"),
    theme: getAttr("data-theme", "light"),
    text: getAttr("data-text", ""),
    scale: getAttr("data-scale", ""),
    vertical: getAttr("data-vertical", ""),
    position: getAttr("data-position", "right"),
    baseBottom: parseInt(getAttr("data-bottom", "24"), 10) || 24,
    layout: (getAttr("data-layout", "flat") || "flat").toLowerCase(),
    widgets: (getAttr("data-widgets", "form,chat,share,book,afford,repay") || "")
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

  function applyPrefixed(tag, prefix) {
    if (!script || !script.attributes) return;
    var pre = "data-" + prefix + "-";
    for (var i = 0; i < script.attributes.length; i++) {
      var at = script.attributes[i];
      if (at.name.indexOf(pre) === 0 && at.name.length > pre.length) {
        tag.setAttribute("data-" + at.name.slice(pre.length), at.value);
      }
    }
  }

  function applyGlobalStyle(tag) {
    if (globalCfg.text) tag.setAttribute("data-text", globalCfg.text);
    if (globalCfg.scale) tag.setAttribute("data-scale", globalCfg.scale);
    if (globalCfg.vertical) tag.setAttribute("data-vertical", globalCfg.vertical);
  }

  function getScriptUrl(relPath) {
    if (baseUrl.includes("tru-loader")) {
      return baseUrl.replace(/tru-loader.*$/, relPath);
    }
    return baseUrl + relPath;
  }

  function widgetUrl(name) {
    return globalCfg.layout === "nested"
      ? getScriptUrl(name + "/" + name + ".js")
      : getScriptUrl(name + ".js");
  }

  // Helper to load chat stack in order
  function loadChatStack(onComplete) {
    var chatBase = getScriptUrl("truchat/shared/qualifier.js").replace("qualifier.js", "");
    var configUrl = getAttr("data-chat-config", "") || getScriptUrl("truchat/true-cars/config.js");

    loadScript(configUrl, function () {
      loadScript(chatBase + "qualifier.js", function () {
        loadScript(chatBase + "chat-core.js", function () {
          // Ensure dummy dealer config if none loaded
          if (!window.TRUECARS_TRUCHAT_CONFIG && !window.RAY_TRUCHAT_CONFIG && !window.COC_TRUCHAT_CONFIG) {
            window.TRUECARS_TRUCHAT_CONFIG = {
              dealerName: globalCfg.dealer,
              brandRed: globalCfg.accent,
              brandRedDark: globalCfg.accent2 || globalCfg.accent,
              assistantName: "True",
              salesWhatsApp: globalCfg.wa,
              flowUrl: globalCfg.flow,
              slug: globalCfg.slug,
              theme: globalCfg.theme,
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
      var affordSrc = widgetUrl("tru-afford");
      var tag = document.createElement("script");
      tag.src = affordSrc;
      tag.setAttribute("data-dealer", globalCfg.dealer);
      tag.setAttribute("data-wa", globalCfg.wa);
      tag.setAttribute("data-accent", globalCfg.accent);
      tag.setAttribute("data-flow", globalCfg.flow);
      if (globalCfg.webhook) tag.setAttribute("data-webhook", globalCfg.webhook);
      if (globalCfg.cmbKey) tag.setAttribute("data-callmebot-key", globalCfg.cmbKey);
      if (globalCfg.cmbPhone) tag.setAttribute("data-callmebot-phone", globalCfg.cmbPhone);
      tag.setAttribute("data-slug", globalCfg.slug);
      tag.setAttribute("data-position", getAttr("data-afford-position", globalCfg.position));
      tag.setAttribute("data-bottom", getAttr("data-afford-bottom", "92px"));
      tag.setAttribute("data-theme", globalCfg.theme);
      applyGlobalStyle(tag);
      applyPrefixed(tag, "afford");
      document.head.appendChild(tag);
    }

    // 2. TruRepay
    if (wanted.indexOf("repay") !== -1 || wanted.indexOf("tru-repay") !== -1) {
      var repaySrc = widgetUrl("tru-repay");
      var rTag = document.createElement("script");
      rTag.src = repaySrc;
      rTag.setAttribute("data-dealer", globalCfg.dealer);
      rTag.setAttribute("data-slug", globalCfg.slug);
      rTag.setAttribute("data-flow", globalCfg.flow);
      if (globalCfg.webhook) rTag.setAttribute("data-webhook", globalCfg.webhook);
      if (globalCfg.cmbKey) rTag.setAttribute("data-callmebot-key", globalCfg.cmbKey);
      if (globalCfg.cmbPhone) rTag.setAttribute("data-callmebot-phone", globalCfg.cmbPhone);
      rTag.setAttribute("data-wa", globalCfg.wa);
      rTag.setAttribute("data-accent", globalCfg.accent);
      rTag.setAttribute("data-mode", getAttr("data-repay-mode", "float"));
      rTag.setAttribute("data-position", getAttr("data-repay-position", globalCfg.position));
      rTag.setAttribute("data-target", getAttr("data-repay-target", "#finance-calc"));
      rTag.setAttribute("data-price", getAttr("data-repay-price", "0"));
      rTag.setAttribute("data-vehicle", getAttr("data-repay-vehicle", ""));
      rTag.setAttribute("data-brand", globalCfg.brand);
      rTag.setAttribute("data-bottom", getAttr("data-repay-bottom", "24px"));
      rTag.setAttribute("data-theme", globalCfg.theme);
      rTag.setAttribute("data-collapsible", getAttr("data-repay-collapsible", "0"));
      applyGlobalStyle(rTag);
      applyPrefixed(rTag, "repay");
      document.head.appendChild(rTag);
    }

    // 3. TruForm
    if (wanted.indexOf("form") !== -1 || wanted.indexOf("tru-form") !== -1) {
      var formSrc = widgetUrl("tru-form");
      var fTag = document.createElement("script");
      fTag.src = formSrc;
      fTag.setAttribute("data-dealer", globalCfg.dealer);
      fTag.setAttribute("data-slug", globalCfg.slug);
      fTag.setAttribute("data-flow", globalCfg.flow);
      if (globalCfg.webhook) fTag.setAttribute("data-webhook", globalCfg.webhook);
      if (globalCfg.cmbKey) fTag.setAttribute("data-callmebot-key", globalCfg.cmbKey);
      if (globalCfg.cmbPhone) fTag.setAttribute("data-callmebot-phone", globalCfg.cmbPhone);
      fTag.setAttribute("data-wa", globalCfg.wa);
      fTag.setAttribute("data-accent", globalCfg.accent);
      fTag.setAttribute("data-mode", getAttr("data-form-mode", "float"));
      fTag.setAttribute("data-target", getAttr("data-form-target", "#contact-form"));
      fTag.setAttribute("data-fields", getAttr("data-form-fields", "vehicle,tradein,finance,location"));
      fTag.setAttribute("data-brand", globalCfg.brand);
      fTag.setAttribute("data-theme", globalCfg.theme);
      fTag.setAttribute("data-position", getAttr("data-form-position", globalCfg.position));
      fTag.setAttribute("data-bottom", getAttr("data-form-bottom", "24px"));
      applyGlobalStyle(fTag);
      applyPrefixed(fTag, "form");
      document.head.appendChild(fTag);
    }

    // 4. TruChat
    if (wanted.indexOf("chat") !== -1 || wanted.indexOf("tru-chat") !== -1) {
      loadChatStack();
    }

    // 5. TruBook
    if (wanted.indexOf("book") !== -1 || wanted.indexOf("tru-book") !== -1) {
      var bookSrc = widgetUrl("tru-book");
      var bTag = document.createElement("script");
      bTag.src = bookSrc;
      bTag.setAttribute("data-dealer", globalCfg.dealer);
      bTag.setAttribute("data-slug", globalCfg.slug);
      bTag.setAttribute("data-flow", globalCfg.flow);
      if (globalCfg.webhook) bTag.setAttribute("data-webhook", globalCfg.webhook);
      if (globalCfg.cmbKey) bTag.setAttribute("data-callmebot-key", globalCfg.cmbKey);
      if (globalCfg.cmbPhone) bTag.setAttribute("data-callmebot-phone", globalCfg.cmbPhone);
      bTag.setAttribute("data-wa", globalCfg.wa);
      bTag.setAttribute("data-accent", globalCfg.accent);
      bTag.setAttribute("data-brand", globalCfg.brand);
      bTag.setAttribute("data-theme", globalCfg.theme);
      applyGlobalStyle(bTag);
      applyPrefixed(bTag, "book");
      document.head.appendChild(bTag);
    }

    // 6. TruValue
    if (wanted.indexOf("value") !== -1 || wanted.indexOf("tru-value") !== -1) {
      var valueSrc = widgetUrl("tru-value");
      var vTag = document.createElement("script");
      vTag.src = valueSrc;
      vTag.setAttribute("data-dealer", globalCfg.dealer);
      vTag.setAttribute("data-slug", globalCfg.slug);
      vTag.setAttribute("data-flow", globalCfg.flow);
      if (globalCfg.webhook) vTag.setAttribute("data-webhook", globalCfg.webhook);
      if (globalCfg.cmbKey) vTag.setAttribute("data-callmebot-key", globalCfg.cmbKey);
      if (globalCfg.cmbPhone) vTag.setAttribute("data-callmebot-phone", globalCfg.cmbPhone);
      vTag.setAttribute("data-wa", globalCfg.wa);
      vTag.setAttribute("data-accent", globalCfg.accent);
      vTag.setAttribute("data-brand", globalCfg.brand);
      vTag.setAttribute("data-theme", globalCfg.theme);
      applyGlobalStyle(vTag);
      applyPrefixed(vTag, "value");
      document.head.appendChild(vTag);
    }

    // 7. TruShare
    if (wanted.indexOf("share") !== -1 || wanted.indexOf("tru-share") !== -1) {
      var shareSrc = widgetUrl("tru-share");
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
      applyGlobalStyle(sTag);
      applyPrefixed(sTag, "share");
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
      if (w === "value" && root.TruValue) root.TruValue.open(payload);
      if (w === "chat") {
        if (root.TruChatWidget && root.TruChatWidget.open) {
          root.TruChatWidget.open();
        } else if (root.TruChat && root.TruChat.open) {
          root.TruChat.open();
        } else if (root.TrueCarsTruChatWidget && root.TrueCarsTruChatWidget.open) {
          root.TrueCarsTruChatWidget.open();
        } else {
          var el = document.getElementById("tc-fab");
          if (el) el.click();
        }
      }
    },
    closeAll: function () {
      if (root.TruAfford) root.TruAfford.close();
      if (root.TruRepay) root.TruRepay.close();
      if (root.TruForm) root.TruForm.close();
      if (root.TruValue) root.TruValue.close();
      if (root.TruChatWidget && root.TruChatWidget.close) root.TruChatWidget.close();
    },
  };
})(window);
