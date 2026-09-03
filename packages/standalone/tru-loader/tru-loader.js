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
    webhook: getAttr("data-webhook", ""),
    cmbKey: getAttr("data-callmebot-key", ""),
    cmbPhone: getAttr("data-callmebot-phone", ""),
    wa: (getAttr("data-wa", "") || "").replace(/\D/g, ""),
    accent: getAttr("data-accent", "#1466E0"),
    accent2: getAttr("data-accent-2", ""),
    brand: getAttr("data-brand", "TruDealer"),
    theme: getAttr("data-theme", "dark"),
    text: getAttr("data-text", ""),
    scale: getAttr("data-scale", ""),
    vertical: getAttr("data-vertical", ""),
    position: getAttr("data-position", "right"),
    baseBottom: parseInt(getAttr("data-bottom", "24"), 10) || 24,
    // "nested" (default) resolves each widget as <name>/<name>.js — the folder
    // layout of this package. "flat" resolves <name>.js — for dealers who upload
    // every file into one directory. Set via data-layout.
    layout: (getAttr("data-layout", "nested") || "nested").toLowerCase(),
    // Chat is NOT in the standalone default: it needs an AI backend a
    // non-ecosystem dealer does not have. Opt in explicitly with data-widgets.
    widgets: (getAttr("data-widgets", "afford,repay,form,share") || "")
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

  // Forward every data-<prefix>-<attr> on the loader tag to a widget tag as
  // data-<attr>. This makes ANY widget option settable from the single loader
  // tag (e.g. data-repay-rate → data-rate) without maintaining a per-attribute
  // allow-list. Runs after the shared globals so an explicit per-widget value
  // wins. data-<prefix>-position/mode/target/bottom/etc. all map correctly.
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

  // Shared appearance globals every widget understands: text colour + size + vertical.
  function applyGlobalStyle(tag) {
    if (globalCfg.text) tag.setAttribute("data-text", globalCfg.text);
    if (globalCfg.scale) tag.setAttribute("data-scale", globalCfg.scale);
    if (globalCfg.vertical) tag.setAttribute("data-vertical", globalCfg.vertical);
  }

  // Resolve a path relative to the standalone package root (the folder that
  // contains tru-loader/). baseUrl is the loader's own directory, e.g.
  // ".../standalone/tru-loader/" — strip the trailing "tru-loader/" to get root.
  function getScriptUrl(relPath) {
    var rootUrl = baseUrl.replace(/tru-loader\/?$/, "");
    return rootUrl + relPath;
  }

  // Resolve a widget's entry script. Honours data-layout:
  //   nested (default): <root>/<name>/<name>.js  (this package's folder layout)
  //   flat:             <root>/<name>.js         (all files in one directory)
  function widgetUrl(name) {
    return globalCfg.layout === "flat"
      ? getScriptUrl(name + ".js")
      : getScriptUrl(name + "/" + name + ".js");
  }

  // Helper to load chat stack in order
  function loadChatStack(onComplete) {
    var configUrl = getAttr("data-chat-config", "");
    if (!configUrl) return;

    var chatBase = getScriptUrl("truchat/shared/qualifier.js").replace("qualifier.js", "");

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
      // Sits above TruRepay's launcher (base 24px + ~76px pill + 16px gap) when
      // both stack on the same side. Override with data-afford-bottom.
      tag.setAttribute("data-bottom", getAttr("data-afford-bottom", "116px"));
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
      rTag.setAttribute("data-mode", getAttr("data-repay-mode", "inline"));
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

    // 4. TruChat — requires an AI backend (data-flow). Standalone dealers
    //    without one should leave chat out; warn rather than 404 silently.
    if (wanted.indexOf("chat") !== -1 || wanted.indexOf("tru-chat") !== -1) {
      if (!globalCfg.flow) {
        console.warn(
          "[TruLoader] 'chat' requested but no data-flow backend is set — " +
          "TruChat needs an AI endpoint. Skipping. Remove 'chat' from " +
          "data-widgets, or provide data-flow."
        );
      } else {
        loadChatStack();
      }
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

    // TruValue
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

    // 6. TruShare — per-vehicle sharing. No OAuth, no tokens, no backend:
    //    the buttons are plain intent URLs and the native share sheet.
    //    Distinct from TruSocial (Zernio) in TruFlow Premium, which posts on
    //    the dealer's behalf to connected accounts and is a paid DMS module.
    //    A site can run both: this is the floor, that one automates.
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
      if (w === "chat" && root.TruChatUI) {
        var el = document.getElementById("tc-fab");
        if (el) el.click();
      }
    },
    closeAll: function () {
      if (root.TruAfford) root.TruAfford.close();
      if (root.TruRepay) root.TruRepay.close();
      if (root.TruForm) root.TruForm.close();
      if (root.TruValue) root.TruValue.close();
    },
  };
})(window);
