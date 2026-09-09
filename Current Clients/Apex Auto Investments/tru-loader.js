/**
 * TruLoader — Universal Widget Loader for Apex Auto Investments
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

  var globalCfg = {
    dealer: getAttr("data-dealer", "Apex Auto Investments"),
    slug: getAttr("data-slug", "apex-wholesale-investments"),
    flow: getAttr("data-flow", "https://flow.tru-saas.com"),
    wa: (getAttr("data-wa", "27726047878") || "").replace(/\D/g, ""),
    accent: getAttr("data-accent", "#E8611A"),
    brand: getAttr("data-brand", "Apex Auto"),
    theme: getAttr("data-theme", "light"),
    position: getAttr("data-position", "right"),
    baseBottom: parseInt(getAttr("data-bottom", "24"), 10) || 24,
    widgets: (getAttr("data-widgets", "afford,repay,form,share,book,value") || "")
      .split(",")
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(Boolean),
  };

  var scriptSrc = (script && script.src) || "";
  var baseUrl = scriptSrc ? scriptSrc.substring(0, scriptSrc.lastIndexOf("/") + 1) || "./" : "./";

  function loadScript(url, callback) {
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = function () { if (callback) callback(); };
    s.onerror = function () { console.error("[TruLoader] Failed to load script:", url); };
    document.head.appendChild(s);
  }

  function getScriptUrl(relPath) {
    if (baseUrl.includes("tru-loader")) {
      return baseUrl.replace(/tru-loader.*$/, relPath);
    }
    return baseUrl + relPath;
  }

  function boot() {
    var wanted = globalCfg.widgets;

    // TruAfford
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

    // TruRepay
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
      document.head.appendChild(rTag);
    }

    // TruForm
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
      fTag.setAttribute("data-brand", globalCfg.brand);
      fTag.setAttribute("data-theme", globalCfg.theme);
      document.head.appendChild(fTag);
    }

    // TruShare
    if (wanted.indexOf("share") !== -1 || wanted.indexOf("tru-share") !== -1) {
      var shareSrc = getScriptUrl("tru-share.js");
      var sTag = document.createElement("script");
      sTag.src = shareSrc;
      sTag.setAttribute("data-dealer", globalCfg.dealer);
      sTag.setAttribute("data-wa", globalCfg.wa);
      sTag.setAttribute("data-accent", globalCfg.accent);
      sTag.setAttribute("data-site", getAttr("data-share-site", location.origin));
      sTag.setAttribute("data-vehicle-path", getAttr("data-share-vehicle-path", "/vehicle/"));
      document.head.appendChild(sTag);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  root.TruDealer = root.TruSaaS = {
    version: "2.5.0",
    config: globalCfg,
    open: function (widget, payload) {
      var w = String(widget || "").toLowerCase();
      if (w === "afford" && root.TruAfford) root.TruAfford.open(payload);
      if (w === "repay" && root.TruRepay) root.TruRepay.open(payload);
      if (w === "form" && root.TruForm) root.TruForm.open(payload);
    }
  };
})(window);
