/**
 * TruShare — per-vehicle sharing for Apex Auto Investments
 */
(function (root) {
  "use strict";

  var scr = document.currentScript || document.querySelector("script[src*='tru-share']");
  function attr(name, fallback) {
    return (scr && scr.getAttribute(name)) || fallback;
  }

  var cfg = {
    dealer: attr("data-dealer", "Apex Auto Investments"),
    site: String(attr("data-site", location.origin)).replace(/\/$/, ""),
    vehiclePath: attr("data-vehicle-path", "/vehicle/"),
    wa: (attr("data-wa", "27726047878") || "").replace(/\D/g, ""),
    accent: attr("data-accent", "#E8611A"),
    z: attr("data-z", "999985"),
    postFlag: attr("data-post-flag", "post"),
    fbPage: attr("data-fb-page", ""),
    igHandle: attr("data-ig-handle", ""),
    gbp: attr("data-gbp", ""),
    currency: attr("data-currency", "R"),
    distanceUnit: attr("data-distance-unit", "km")
  };

  var INSTANCE = "tru-share";
  if (document.getElementById(INSTANCE + "-host")) return;

  var clean = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); };
  var fmtR = function (n) {
    n = Number(n) || 0;
    var grouped = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, cfg.currency === "R" ? " " : ",");
    return cfg.currency + grouped;
  };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function label(v) {
    v = v || {};
    var make = clean(v.make), name = clean(v.name);
    var parts = (make && name && name.toLowerCase().indexOf(make.toLowerCase()) === 0)
      ? [v.year, name]
      : [v.year, make, name];
    return clean(parts.filter(Boolean).join(" ")) || "this vehicle";
  }

  function shareUrl(v) {
    v = v || {};
    if (v.url) return v.url;
    var q = [];
    function add(k, val) {
      val = clean(val);
      if (val) q.push(k + "=" + encodeURIComponent(val));
    }
    add("stock", v.stock || v.stockNumber || v.id);
    add("year", v.year);
    add("make", v.make);
    add("name", v.model || v.name);
    add("variant", v.variant);
    if (Number(v.price) > 0) add("price", Math.round(Number(v.price)));
    add("km", v.mileage || v.km);
    if (cfg.currency !== "R") add("cur", cfg.currency);
    if (cfg.distanceUnit !== "km") add("odu", cfg.distanceUnit);
    add("trans", v.transmission || v.trans);
    add("fuel", v.fuelType || v.fuel);
    add("body", v.bodyType || v.body);
    var img = (Array.isArray(v.images) && v.images[0]) || v.heroImage || v.img || "";
    add("img", img);
    return cfg.site + cfg.vehiclePath + (q.length ? "?" + q.join("&") : "");
  }

  function caption(v) {
    v = v || {};
    var lines = [];
    var head = label(v);
    if (Number(v.price) > 0) head += " — " + fmtR(v.price);
    lines.push(head);

    var spec = [v.mileage || v.km, v.transmission || v.trans, v.fuelType || v.fuel, v.bodyType || v.body].map(clean).filter(function (s) {
      return s && s !== "—" && s !== "Vehicle";
    });
    if (spec.length) lines.push(spec.join(" · "));

    lines.push("");
    lines.push("Available now at " + cfg.dealer + " (Gqeberha / Port Elizabeth).");
    if (cfg.wa) lines.push("WhatsApp us on +" + cfg.wa + " or see the full listing:");
    else lines.push("See the full listing:");
    lines.push(shareUrl(v));
    return lines.join("\n");
  }

  function blurb(v) {
    var s = "Check out this " + label(v) + " at " + cfg.dealer;
    if (Number(v.price) > 0) s += " — " + fmtR(v.price);
    return s;
  }

  function isDealerMode() {
    try {
      var q = new URLSearchParams(location.search);
      var val = q.get(cfg.postFlag);
      return val !== null && val !== "0" && val !== "false";
    } catch (e) { return false; }
  }

  var host = document.createElement("div");
  host.id = INSTANCE + "-host";
  var shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    "<style>" +
    ":host{all:initial}*,*::before,*::after{box-sizing:border-box}" +
    ".ts{position:fixed;inset:0;z-index:" + esc(cfg.z) + ";display:none;font-family:'DM Sans',system-ui,sans-serif}" +
    ".ts.is-open{display:block}" +
    ".ts-bg{position:absolute;inset:0;background:rgba(17,19,24,.65);backdrop-filter:blur(4px);opacity:0;transition:opacity .2s}" +
    ".ts.is-open .ts-bg{opacity:1}" +
    ".ts-sheet{position:absolute;left:50%;bottom:0;transform:translate(-50%,14px);width:min(420px,100%);background:#111318;color:#FFFFFF;border:1px solid rgba(255,255,255,.15);border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -18px 60px rgba(0,0,0,.7);opacity:0;transition:transform .26s cubic-bezier(.22,1,.36,1),opacity .2s}" +
    ".ts.is-open .ts-sheet{transform:translate(-50%,0);opacity:1}" +
    "@media(min-width:560px){.ts-sheet{bottom:50%;transform:translate(-50%,50%) scale(.96);border-radius:20px}.ts.is-open .ts-sheet{transform:translate(-50%,50%) scale(1)}}" +
    ".ts-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:16px}" +
    ".ts-title{font-size:16px;font-weight:800;flex:1}" +
    ".ts-sub{font-size:13px;color:#E8611A;font-weight:700;margin-top:2px}" +
    ".ts-x{background:none;border:0;color:#AAA;font-size:22px;cursor:pointer}" +
    ".ts-x:hover{color:#fff}" +
    ".ts-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px}" +
    ".ts-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 8px;border-radius:10px;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:12px;font-weight:700;text-decoration:none;transition:background .2s,border-color .2s}" +
    ".ts-btn:hover{background:rgba(255,255,255,.12);border-color:var(--apex-orange)}" +
    ".ts-btn.wa{color:#4ADE80;background:rgba(37,211,102,.12);border-color:rgba(37,211,102,.3)}" +
    ".ts-btn.fb{color:#8AB4FF;background:rgba(24,119,242,.12);border-color:rgba(24,119,242,.3)}" +
    ".ts-toast{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);background:#E8611A;color:#fff;font-size:12px;font-weight:800;padding:8px 16px;border-radius:20px;white-space:nowrap;opacity:0;transition:opacity .2s;pointer-events:none}" +
    ".ts-toast.show{opacity:1}" +
    "</style>" +
    '<div class="ts" role="dialog">' +
      '<div class="ts-bg" data-close></div>' +
      '<div class="ts-sheet">' +
        '<div class="ts-toast"></div>' +
        '<div class="ts-head"><div><div class="ts-title"></div><div class="ts-sub"></div></div>' +
          '<button class="ts-x" type="button" data-close>&times;</button></div>' +
        '<div class="ts-row" data-buyer></div>' +
      '</div>' +
    '</div>';

  function mount() {
    if (!document.body.contains(host)) document.body.appendChild(host);
    document.body.classList.add("ts-ready");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  var el = {
    wrap: shadow.querySelector(".ts"),
    title: shadow.querySelector(".ts-title"),
    sub: shadow.querySelector(".ts-sub"),
    buyer: shadow.querySelector("[data-buyer]"),
    toast: shadow.querySelector(".ts-toast")
  };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove("show"); }, 2200);
  }

  function copy(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(msg); }, function () { legacy(); });
    } else { legacy(); }
    function legacy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast(msg);
      } catch (e) { toast("Copy failed — long-press to select"); }
    }
  }

  function btn(cls, text) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ts-btn " + cls;
    b.innerHTML = "<span>" + esc(text) + "</span>";
    return b;
  }

  function build(v) {
    var url = shareUrl(v);
    el.buyer.innerHTML = "";

    var wa = btn("wa", "WhatsApp");
    wa.addEventListener("click", function () {
      window.open("https://wa.me/?text=" + encodeURIComponent(blurb(v) + "\n" + url), "_blank", "noopener");
    });
    el.buyer.appendChild(wa);

    var fb = btn("fb", "Facebook");
    fb.addEventListener("click", function () {
      window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url), "_blank", "noopener");
    });
    el.buyer.appendChild(fb);

    var lk = btn("", "Copy Link");
    lk.addEventListener("click", function () { copy(url, "Link copied!"); });
    el.buyer.appendChild(lk);

    if (navigator.share) {
      var more = btn("", "More Options");
      more.addEventListener("click", function () {
        navigator.share({ title: label(v) + " — " + cfg.dealer, text: blurb(v), url: url }).catch(function () {});
      });
      el.buyer.appendChild(more);
    }
  }

  function open(v) {
    var current = v || {};
    build(current);
    el.title.textContent = label(current);
    el.sub.textContent = Number(current.price) > 0 ? fmtR(current.price) : cfg.dealer;
    el.wrap.classList.add("is-open");
  }

  function close() {
    el.wrap.classList.remove("is-open");
  }

  shadow.querySelectorAll("[data-close]").forEach(function (n) {
    n.addEventListener("click", close);
  });

  root.TruShare = {
    open: open,
    close: close,
    url: shareUrl,
    caption: caption,
    config: cfg
  };
})(window);
