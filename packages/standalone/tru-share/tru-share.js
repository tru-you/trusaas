/**
 * TruShare — per-vehicle sharing for dealer websites (TruSaaS)
 *
 * CANONICAL SOURCE. Per-dealer copies under case-sites/ are deploy
 * artefacts — fix bugs here, then re-copy.
 *
 * WHY THIS EXISTS, AND WHAT IT IS NOT
 * TruSocial (Zernio, in TruFlow Premium) posts to connected Facebook /
 * Instagram / Google Business accounts on the dealer's behalf. It needs an
 * OAuth connect per platform, per-dealer provisioning, and tokens that
 * expire. It is the right tool for a group posting at volume.
 * It is the wrong tool for a one-person yard, and it CANNOT reach Facebook
 * Marketplace at all — no public posting API exists for it.
 *
 * TruShare is the floor beneath that: zero setup, works on any site. The
 * apps handle their own auth and nothing here ever sees a token.
 * NOTE: a Marketplace "create listing" button was tried and removed — that
 * flow accepts nothing prefilled, so it dropped the dealer into an empty
 * vehicle form with no way to hand it the car. The native share sheet still
 * reaches Marketplace on a phone if they want it.
 *
 * THE HARD PART IS NOT IN THIS FILE.
 * A shared link is only worth pasting if it UNFURLS — photo, model, price
 * under the post. Facebook's crawler never runs JavaScript, so per-car
 * Open Graph tags must be injected server-side by the host (on Netlify, an
 * edge function; see case-sites/cars-at-caledon/netlify/edge-functions/
 * vehicle-og.js for the reference implementation). Without that, every
 * button below still works and every share looks generic.
 *
 * Drop-in:
 *   <script src="tru-share.js"
 *           data-dealer="Cars on Caledon"
 *           data-site="https://www.carsoncaledon.co.za"
 *           data-vehicle-path="/vehicle/"
 *           data-wa="27618759389"
 *           data-accent="#23419A"></script>
 *
 * Optional attributes:
 *   data-vehicle-path  path of the per-car share page (default "/vehicle/")
 *   data-accent        brand colour
 *   data-z             z-index (default 999985 — under TruForm's 999980+? no:
 *                      deliberately ABOVE it, this is a transient sheet)
 *   data-post-flag     query param that reveals dealer post tools
 *                      (default "post" → open the site with ?post=1)
 *   data-fb-page       the dealer's Facebook page handle or id, so the post
 *                      button opens THEIR page rather than facebook.com
 *   data-ig-handle     the dealer's Instagram handle
 *   data-gbp           full Google Business profile URL (optional)
 *   data-currency      price currency symbol for captions/sheet (default "R";
 *                      also declared on share links as ?cur= when not R)
 *   data-distance-unit odometer unit declared on share links as ?odu= when
 *                      not "km" (the value itself is whatever the site passes)
 *
 * Programmatic:
 *   window.TruShare.open(vehicle)      open the sheet for a vehicle
 *   window.TruShare.url(vehicle)       the per-car share URL (string)
 *   window.TruShare.caption(vehicle)   the ready-to-paste post caption
 *   window.TruShare.isDealerMode()     true when the post flag is present
 *
 * A `vehicle` is a plain object; every field is optional:
 *   { year, make, name, variant, price, km, trans, fuel, body,
 *     stock, extras: [], images: [], url }
 * Pass `url` to override the built share URL entirely.
 *
 * TWO MODES, because there are two different jobs:
 *   BUYER  (default) — "send this car to someone". Native sheet, WhatsApp,
 *                      Facebook, copy link.
 *   DEALER (?post=1) — "put this car in my own post". Copies a written
 *                      caption WITH the link already in it, opens the photos
 *                      to save, and links straight through to the dealer's
 *                      own Facebook / Instagram / Google page. Those are
 *                      plain destination links, not API calls: signed in on
 *                      that device they land in the composer, signed out
 *                      they get that platform's login and carry on.
 *                      Caption is copied BEFORE the tab opens, so it is
 *                      already on the clipboard when they arrive.
 * The dealer tools are behind a URL flag rather than a login: there is
 * nothing sensitive in them, and a flag costs no auth, no session and no
 * server. A buyer never sees them.
 */
(function (root) {
  "use strict";

  var scr = document.currentScript || document.querySelector("script[src*='tru-share']");
  function attr(name, fallback) {
    return (scr && scr.getAttribute(name)) || fallback;
  }

  var cfg = {
    dealer: attr("data-dealer", "this dealership"),
    site: String(attr("data-site", location.origin)).replace(/\/$/, ""),
    vehiclePath: attr("data-vehicle-path", "/vehicle/"),
    wa: (attr("data-wa", "") || "").replace(/\D/g, ""),
    accent: attr("data-accent", "#23419A"),
    z: attr("data-z", "999985"),
    postFlag: attr("data-post-flag", "post"),
    /* Where "post it yourself" sends the dealer. These are ordinary
       destination URLs, NOT API calls — no OAuth, no tokens, no app review.
       If the dealer is already signed in on that device (they always are on
       the yard phone) the link lands them straight in the right composer;
       if not, they get that platform's own login and carry on afterwards.
       Set the page/handle ones per dealer so the button opens THEIR page
       rather than the generic Facebook home. */
    fbPage: attr("data-fb-page", ""),        // "carsoncaledon" or a numeric id
    igHandle: attr("data-ig-handle", ""),    // "carsoncaledon"
    gbp: attr("data-gbp", ""),               // Google Business profile URL, optional
    /* Market display: currency symbol for prices, odometer unit for the
       share contract. Defaults keep ZA sites byte-identical. */
    currency: attr("data-currency", "R"),
    distanceUnit: attr("data-distance-unit", "km"),
    vertical: (attr("data-vertical", "") || "").toLowerCase()
  };

  var INSTANCE = "tru-share";
  if (document.getElementById(INSTANCE + "-host")) return;   // never mount twice

  /* ---------- helpers ---------- */
  var clean = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); };
  var fmtR = function (n) {
    n = Number(n) || 0;
    /* R keeps the SA space grouping; £/$ take commas and attach directly. */
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
    var isMoto = cfg.vertical === "moto" || v.vertical === "moto";
    var make = clean(v.make), name = clean(v.name);
    /* drop the make when the name already leads with it — "Ford Ford Ranger" */
    var parts = (make && name && name.toLowerCase().indexOf(make.toLowerCase()) === 0)
      ? [v.year, name]
      : [v.year, make, name];
    return clean(parts.filter(Boolean).join(" ")) || (isMoto ? "this motorcycle" : "this vehicle");
  }

  /* ---------- the share URL ----------
     Mirrors the query contract the vehicle-og edge function reads. Keep the
     key names in step with it: change one, change both, or shares silently
     fall back to the generic card. */
  function shareUrl(v) {
    v = v || {};
    if (v.url) return v.url;
    var stock = clean(v.stock || v.id || v.stockNumber);
    if (stock) {
      return cfg.site + cfg.vehiclePath + "?stock=" + encodeURIComponent(stock);
    }
    var isMoto = cfg.vertical === "moto" || v.vertical === "moto";
    var q = [];
    function add(k, val) {
      val = clean(val);
      if (val) q.push(k + "=" + encodeURIComponent(val));
    }
    add("stock", v.stock);
    add("year", v.year);
    add("make", v.make);
    add("name", v.name);
    add("variant", v.variant);
    if (Number(v.price) > 0) add("price", Math.round(Number(v.price)));
    add("km", v.km);
    if (isMoto) add("vert", "moto");
    /* Market declarations ride along only when they differ from the launch
       defaults — SA share URLs stay byte-identical, and old edge functions
       ignore unknown params. Keep key names in step with vehicle-og.js. */
    if (cfg.currency !== "R") add("cur", cfg.currency);
    if (cfg.distanceUnit !== "km") add("odu", cfg.distanceUnit);
    add("trans", v.trans);
    add("fuel", v.fuel);
    add("body", v.body);
    var img = (Array.isArray(v.images) && v.images[0]) || v.img || "";
    add("img", img);
    return cfg.site + cfg.vehiclePath + (q.length ? "?" + q.join("&") : "");
  }

  /* ---------- the caption ----------
     Written to be pasted into the dealer's OWN Facebook / Marketplace post,
     so it reads as the dealer talking, not as a system notification. The
     link goes last: platforms unfurl the final URL, and a link mid-sentence
     reads like spam. */
  function caption(v) {
    v = v || {};
    var lines = [];
    var head = label(v);
    if (Number(v.price) > 0) head += " — " + fmtR(v.price);
    lines.push(head);

    var spec = [v.km, v.trans, v.fuel, v.body].map(clean).filter(function (s) {
      return s && s !== "—" && s !== "Vehicle";
    });
    if (spec.length) lines.push(spec.join(" · "));

    var x = (Array.isArray(v.extras) ? v.extras : []).filter(Boolean);
    if (x.length) lines.push(x.slice(0, 6).join(" · "));

    lines.push("");
    lines.push("Available now at " + cfg.dealer + ".");
    if (cfg.wa) lines.push("WhatsApp us on +" + cfg.wa + " or see the full listing:");
    else lines.push("See the full listing:");
    lines.push(shareUrl(v));
    return lines.join("\n");
  }

  /* buyer-facing blurb — shorter, first person, for a person sending a car
     to a friend rather than a dealer advertising it */
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

  /* ---------- shadow host ---------- */
  var host = document.createElement("div");
  host.id = INSTANCE + "-host";
  var shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    /* border-box or the sheet's 18px padding is ADDED to width:100%,
       pushing it wider than the viewport and off-centre. all:initial on
       the host does not reach children, so this must be explicit. */
    "*,*::before,*::after{box-sizing:border-box}" +
    ".ts{position:fixed;inset:0;z-index:" + esc(cfg.z) + ";display:none;" +
      "font-family:'Mulish',system-ui,-apple-system,sans-serif}" +
    ".ts.is-open{display:block}" +
    ".ts-bg{position:absolute;inset:0;background:rgba(6,9,16,.62);" +
      "backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;" +
      "transition:opacity .22s cubic-bezier(.4,0,.2,1)}" +
    ".ts.is-open .ts-bg{opacity:1}" +
    ".ts-sheet{position:absolute;left:50%;bottom:0;transform:translate(-50%,14px);" +
      "width:min(420px,100%);background:#0E1730;color:#E8EAE6;" +
      "border:1px solid rgba(255,255,255,.12);border-bottom:0;" +
      "border-radius:20px 20px 0 0;padding:18px 18px 22px;" +
      "box-shadow:0 -18px 60px -20px rgba(0,0,0,.7);" +
      "opacity:0;transition:transform .26s cubic-bezier(.22,1,.36,1),opacity .2s}" +
    ".ts.is-open .ts-sheet{transform:translate(-50%,0);opacity:1}" +
    "@media(min-width:560px){.ts-sheet{bottom:50%;transform:translate(-50%,50%) scale(.97);" +
      "border-radius:20px;border-bottom:1px solid rgba(255,255,255,.12)}" +
      ".ts.is-open .ts-sheet{transform:translate(-50%,50%) scale(1)}}" +
    ".ts-grab{width:38px;height:4px;border-radius:99px;background:rgba(255,255,255,.18);" +
      "margin:0 auto 14px}" +
    "@media(min-width:560px){.ts-grab{display:none}}" +
    ".ts-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}" +
    ".ts-title{font-size:15px;font-weight:800;line-height:1.25;flex:1;min-width:0}" +
    ".ts-sub{font-size:12px;color:rgba(232,234,230,.55);margin-top:2px;font-weight:600}" +
    ".ts-x{background:none;border:0;color:rgba(232,234,230,.55);font-size:20px;" +
      "line-height:1;cursor:pointer;padding:2px 4px;flex-shrink:0}" +
    ".ts-x:hover{color:#fff}" +
    ".ts-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px}" +
    ".ts-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "gap:7px;padding:14px 8px;border-radius:14px;cursor:pointer;text-align:center;" +
      "border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);" +
      "color:#E8EAE6;font-size:11.5px;font-weight:700;font-family:inherit;" +
      "text-decoration:none;transition:background .18s,border-color .18s}" +
    ".ts-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2)}" +
    ".ts-btn svg{width:20px;height:20px;flex-shrink:0}" +
    ".ts-btn.wa{color:#4ADE80;background:rgba(37,211,102,.10);border-color:rgba(37,211,102,.24)}" +
    ".ts-btn.fb{color:#8AB4FF;background:rgba(24,119,242,.12);border-color:rgba(24,119,242,.26)}" +
    ".ts-sec{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}" +
    ".ts-sec-l{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;" +
      "color:rgba(232,234,230,.42);margin-bottom:10px}" +
    ".ts-toast{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);" +
      "background:#E8EAE6;color:#0E1730;font-size:12px;font-weight:800;padding:8px 14px;" +
      "border-radius:99px;white-space:nowrap;opacity:0;transition:opacity .2s;pointer-events:none}" +
    ".ts-toast.show{opacity:1}" +
    "</style>" +
    '<div class="ts" role="dialog" aria-modal="true" aria-label="Share this vehicle">' +
      '<div class="ts-bg" data-close></div>' +
      '<div class="ts-sheet">' +
        '<div class="ts-toast"></div>' +
        '<div class="ts-grab"></div>' +
        '<div class="ts-head"><div><div class="ts-title"></div><div class="ts-sub"></div></div>' +
          '<button class="ts-x" type="button" data-close aria-label="Close">&times;</button></div>' +
        '<div class="ts-row" data-buyer></div>' +
        '<div class="ts-sec" data-dealer hidden>' +
          '<div class="ts-sec-l">Post it yourself</div>' +
          '<div class="ts-row" data-dealer-row></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  function mount() {
    if (!document.body.contains(host)) document.body.appendChild(host);
    /* Tells the host page the widget is actually present. Sites gate their
       own share affordances on `body.ts-ready` so a card share button never
       renders as a dead control when TruShare is not loaded — which is the
       normal state on a site that has not bought the feature. Enabling is
       then one word in data-widgets, with no markup change. */
    document.body.classList.add("ts-ready");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else { mount(); }

  var el = {
    wrap: shadow.querySelector(".ts"),
    title: shadow.querySelector(".ts-title"),
    sub: shadow.querySelector(".ts-sub"),
    buyer: shadow.querySelector("[data-buyer]"),
    dealer: shadow.querySelector("[data-dealer]"),
    dealerRow: shadow.querySelector("[data-dealer-row]"),
    toast: shadow.querySelector(".ts-toast")
  };

  var ICON = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.1 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1-1.4-1-2.7s.6-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.9-1.1c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.1z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12.2 19"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    gbp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    li: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
  };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove("show"); }, 2200);
  }

  function copy(text, msg) {
    /* execCommand fallback kept deliberately: clipboard.writeText needs a
       secure context, and dealers do open these sites over plain http on
       yard wifi. A copy button that silently does nothing is worse than an
       ugly fallback. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(msg); }, function () { legacy(); });
    } else { legacy(); }
    function legacy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast(msg);
      } catch (e) { toast("Copy failed — long-press to select"); }
    }
  }

  function btn(cls, icon, text) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ts-btn " + cls;
    b.innerHTML = icon + "<span>" + esc(text) + "</span>";
    return b;
  }

  var current = null;

  function build(v) {
    var url = shareUrl(v);
    el.buyer.innerHTML = "";
    el.dealerRow.innerHTML = "";

    /* --- buyer row --- */
    var wa = btn("wa", ICON.wa, "WhatsApp");
    wa.addEventListener("click", function () {
      window.open("https://wa.me/?text=" + encodeURIComponent(blurb(v) + "\n" + url), "_blank", "noopener");
    });
    el.buyer.appendChild(wa);

    /* Facebook's sharer takes a URL only — it has ignored custom text since
       2017 and reads the page's OG tags instead. That is exactly why the
       server-side OG injection matters. */
    var fb = btn("fb", ICON.fb, "Facebook");
    fb.addEventListener("click", function () {
      window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url),
        "_blank", "noopener,width=620,height=560");
    });
    el.buyer.appendChild(fb);

    var lk = btn("", ICON.link, "Copy link");
    lk.addEventListener("click", function () { copy(url, "Link copied"); });
    el.buyer.appendChild(lk);

    /* Native sheet last, and only where it exists: it is the best option on a
       phone (it reaches Marketplace, Instagram, Messages, everything) but on
       desktop it is either missing or a confusing OS panel. */
    if (navigator.share) {
      var more = btn("", ICON.more, "More…");
      more.addEventListener("click", function () {
        navigator.share({ title: label(v) + " — " + cfg.dealer, text: blurb(v), url: url })
          .catch(function () {});
      });
      el.buyer.appendChild(more);
    }

    /* --- dealer row --- */
    var dealerOn = isDealerMode();
    el.dealer.hidden = !dealerOn;
    if (dealerOn) {
      var cap = btn("", ICON.text, "Copy caption");
      cap.addEventListener("click", function () {
        copy(caption(v), "Caption copied — paste into your post");
      });
      el.dealerRow.appendChild(cap);

      var imgs = (Array.isArray(v.images) ? v.images : []).filter(Boolean);
      if (imgs.length) {
        var ph = btn("", ICON.photo, "Photos (" + imgs.length + ")");
        ph.addEventListener("click", function () {
          /* Opened as tabs rather than fetched-and-downloaded: the images are
             cross-origin (the DMS media host) and a forced download would
             need CORS headers we do not control. Long-press → save works on
             every phone, which is where posting actually happens. */
          imgs.slice(0, 10).forEach(function (src, i) {
            setTimeout(function () { window.open(src, "_blank", "noopener"); }, i * 120);
          });
          toast("Long-press each photo to save");
        });
        el.dealerRow.appendChild(ph);
      }

      /* Straight to the platform the dealer actually posts on.
         Marketplace's create flow was here and has been removed: it accepts
         nothing prefilled, so it dropped the dealer into an empty vehicle
         form with no way to hand it the car — worse than useless.
         These are plain destinations. Signed in on that device (which the
         yard phone always is) they land in the composer; signed out they get
         that platform's login and continue afterwards. The caption is copied
         BEFORE the tab opens, so it is already on the clipboard when they
         arrive — that ordering is the whole trick. */
      function poster(labelText, icon, url, note) {
        if (!url) return;
        var b = btn("", icon, labelText);
        b.addEventListener("click", function () {
          copy(caption(v), note);
          /* Small delay so the clipboard write settles before the tab steals
             focus — Safari in particular drops it otherwise. */
          setTimeout(function () { window.open(url, "_blank", "noopener"); }, 350);
        });
        el.dealerRow.appendChild(b);
      }

      poster("Facebook", ICON.fb,
        cfg.fbPage ? "https://www.facebook.com/" + encodeURIComponent(cfg.fbPage)
                   : "https://www.facebook.com/",
        "Caption copied — paste into your post");

      poster("Marketplace", ICON.shop,
        "https://www.facebook.com/marketplace/create/vehicle",
        "Vehicle specs copied — paste into Marketplace");

      poster("Instagram", ICON.ig,
        cfg.igHandle ? "https://www.instagram.com/" + encodeURIComponent(cfg.igHandle) + "/"
                     : "https://www.instagram.com/",
        "Caption copied — Instagram needs the photos too");

      poster("LinkedIn", ICON.li,
        "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url),
        "Link ready — paste into LinkedIn post");

      poster("Google", ICON.gbp, cfg.gbp, "Caption copied — paste into your update");
    }
  }

  var lastFocus = null;
  function open(v) {
    current = v || {};
    build(current);
    el.title.textContent = label(current);
    el.sub.textContent = Number(current.price) > 0 ? fmtR(current.price) : cfg.dealer;
    lastFocus = document.activeElement;
    el.wrap.classList.add("is-open");
    document.body.classList.add("ts-open");
    setTimeout(function () {
      var f = shadow.querySelector(".ts-btn");
      if (f) { try { f.focus(); } catch (e) {} }
    }, 60);
  }
  function close() {
    el.wrap.classList.remove("is-open");
    document.body.classList.remove("ts-open");
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  shadow.querySelectorAll("[data-close]").forEach(function (n) {
    n.addEventListener("click", close);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && el.wrap.classList.contains("is-open")) { e.stopPropagation(); close(); }
  });

  root.TruShare = {
    open: open,
    close: close,
    url: shareUrl,
    caption: caption,
    isDealerMode: isDealerMode,
    config: cfg
  };
})(window);
