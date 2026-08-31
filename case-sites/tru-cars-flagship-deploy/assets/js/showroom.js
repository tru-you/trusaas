/* ============================================================
   True Cars — editorial chrome and shared behaviour.
   Light cream theme. Injects topbar, sticky header, mobile
   action bar, footer. Renders vehicle cards and handles
   scroll reveal via IntersectionObserver.
   ============================================================ */
(function () {
  var TRU = (window.TruShowroom = window.TruShowroom || {});

  var NAV = [
    { href: "/index.html",    label: "Home" },
    { href: "/stock.html",    label: "Showroom" },
    { href: "/finance.html",  label: "Finance" },
    { href: "/trade-in.html", label: "Sell / trade-in" },
    { href: "https://trudealer.tru-saas.com", label: "The system", ext: true },
  ];

  var WA = "27620502091";
  var TEL = "+27620502091";

  /* Direct-contact FAB config — one place to change numbers or the calendar
     URL. WA numbers are digits only (wa.me expects the country code without +).
     CAL_URL: replace the placeholder with the real Cal.com / Calendly link. */
  var CONTACT = {
    waZa:  { num: "27620502091",  label: "WhatsApp SA", flag: "" },
    waUk:  { num: "447476995694", label: "WhatsApp UK", flag: "" },
    cal:   { url: "https://cal.com/pauldebeer",         label: "Book a call", flag: "" },
  };
  var ADDRESS = "Deploying dealer operating systems in South Africa, UK & USA";

  TRU.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---- query string & URL parameter extraction ---- */
  TRU.params = function () {
    var out = {};
    new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; });
    if (!out.stock && out.id) out.stock = out.id;
    if (!out.stock && out.v) out.stock = out.v;
    if (!out.stock) {
      var parts = location.pathname.split("/").filter(Boolean);
      var last = parts[parts.length - 1];
      if (last && last !== "vehicle" && last !== "vehicle.html" && last !== "index.html" && last !== "stock.html") {
        out.stock = decodeURIComponent(last);
      }
    }
    return out;
  };
  TRU.setParams = function (obj, replace) {
    var q = new URLSearchParams();
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== "" && obj[k] != null) q.set(k, obj[k]);
    });
    var url = location.pathname + (q.toString() ? "?" + q : "");
    history[replace ? "replaceState" : "pushState"]({}, "", url);
  };

  /* ---- icons ---- */
  var ICON = {
    share:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>' +
      '<polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2z"/></svg>',
    wa:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm5.5 12.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1s-.8 1-1 1.2c-.2.2-.4.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.3 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4z"/></svg>',
    grid:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>' +
      '<rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  };
  TRU.ICON = ICON;

  /* Body-type silhouettes */
  var BODY_ICON = {
    Hatchback: '<path d="M2 17h44M8 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5M28 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5"/><path d="M4 17v-4c0-1.4 1.1-2.5 2.5-2.5h4.9l3.6-4.6c.6-.8 1.5-1.2 2.5-1.2h10c1.2 0 2.3.5 3 1.5l3.3 4.3h3.7c1.4 0 2.5 1.1 2.5 2.5V17"/>',
    SUV:       '<path d="M2 18h44M8 18c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5M28 18c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5"/><path d="M4 18v-5.5c0-1.4 1.1-2.5 2.5-2.5h4.5l3.2-4.2c.6-.8 1.5-1.3 2.5-1.3h10.5c1.1 0 2.1.5 2.8 1.3l3.2 4.2h4.3c1.4 0 2.5 1.1 2.5 2.5V18"/>',
    Bakkie:    '<path d="M2 18h44M8 18c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5M30 18c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5"/><path d="M3 18v-5.5c0-1.3 1-2.4 2.3-2.4h3.5l3-4.5c.6-.8 1.5-1.3 2.5-1.3h8c1.4 0 2.5 1.1 2.5 2.5V13H43c1 0 1.7.7 1.7 1.7V18"/>',
    Sedan:     '<path d="M2 17h44M8 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5M28 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5"/><path d="M4 17v-3.5c0-1.3 1-2.4 2.2-2.6l4.5-.5 4.5-4.8c.6-.7 1.5-1.1 2.4-1.1h10c1 0 2 .4 2.6 1.1l4 4.7 4.8.6c1.2.2 2.2 1.3 2.2 2.6V17"/>',
    Coupe:     '<path d="M2 17h44M8 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5M28 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5"/><path d="M4 17v-3c0-1.3.9-2.4 2.2-2.6l5.6-1.1 6-4.8c.7-.6 1.5-.8 2.3-.8h8c1.1 0 2.2.5 2.9 1.4l3.9 5 3.9.9c1.2.3 2.1 1.3 2.1 2.6V17"/>',
    Wagon:     '<path d="M2 17h44M8 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5M28 17c0-3 2.4-5.5 5.4-5.5s5.4 2.5 5.4 5.5"/><path d="M4 17v-4.5c0-1.4 1.1-2.5 2.5-2.5h4.5l3.5-4.2c.6-.8 1.5-1.3 2.5-1.3h16c1.4 0 2.5 1.1 2.5 2.5V17"/>',
  };
  TRU.bodyIcon = function (name) {
    var path = BODY_ICON[name] || BODY_ICON.Sedan;
    return '<svg viewBox="0 0 48 22" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + path + "</svg>";
  };

  /* ---- price badge tier ---- */
  TRU.priceBadge = function (v) {
    if (!v.truPrice || v.truPrice >= v.price) return "";
    var pct = (v.price - v.truPrice) / v.price;
    if (pct >= 0.04) return '<span class="price-badge is-great">Great price</span>';
    if (pct >= 0.01) return '<span class="price-badge is-fair">Fair price</span>';
    return "";
  };

  /* ---- chrome ---- */
  function currentPage() {
    var p = location.pathname.replace(/\/$/, "");
    return p.slice(p.lastIndexOf("/") + 1) || "index.html";
  }

  function openingHours() {
    var d = new Date();
    var day = d.getDay();
    var hour = d.getHours();
    if (day === 0) return { open: false, text: "Closed Sundays" };
    var closeAt = day === 6 ? 13 : 17;
    if (hour >= 8 && hour < closeAt) return { open: true, text: "Open now — until " + closeAt + "h00" };
    return { open: false, text: hour < 8 ? "Opens 08h00" : "Opens tomorrow 08h00" };
  }

  TRU.mountChrome = function () {
    var here = currentPage();
    var hours = openingHours();

    var ribbon = document.createElement("div");
    ribbon.className = "demo-ribbon";
    ribbon.innerHTML =
      "<b>Demo storefront</b> — every widget on this page is the live TruDealer product. Stock is illustrative.";

    var topbar = document.createElement("div");
    topbar.className = "topbar";
    topbar.innerHTML =
      '<div class="wrap">' +
        '<span class="live">● Live</span>' +
        '<span class="sep hide-sm">/</span>' +
        '<span class="hide-sm">' + ADDRESS + "</span>" +
        '<span class="show-sm" style="font-size:10px;letter-spacing:0.08em">SA · UK · USA</span>' +
        '<span class="right">' +
          '<a class="hide-sm" href="tel:' + TEL + '">' + TEL + "</a>" +
          '<span class="sep hide-sm">/</span>' +
          '<a href="https://wa.me/' + WA + '">WhatsApp</a>' +
        "</span>" +
      "</div>";

    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<div class="wrap">' +
        '<a class="brand" href="/index.html">' +
          '<span class="brand-lockup">' +
            '<img class="lockup-light" src="/assets/brand/truecars-lockup-light.jpg" alt="TrueCars — Demo Site">' +
            '<img class="lockup-dark" src="/assets/brand/truecars-lockup-dark.jpg" alt="TrueCars — Demo Site">' +
          '</span>' +
        "</a>" +
        '<button class="nav-toggle" aria-expanded="false" aria-label="Menu">Menu</button>' +
        '<nav class="nav">' +
          NAV.map(function (n) {
            var active = false;
            if (here === "index.html" && n.href === "/index.html") active = true;
            else if (here !== "index.html" && n.href.indexOf(here) !== -1) active = true;
            /* ext:true → link out (TruDealer platform), rel-safe target=_blank. */
            var extra = n.ext ? ' target="_blank" rel="noopener"' : "";
            return '<a href="' + n.href + '"' + (active ? ' class="is-active"' : "") + extra + ">" + n.label + "</a>";
          }).join("") +
          '<a class="btn btn-outline btn-sm nav-cta" href="/finance.html">Apply for finance</a>' +
        "</nav>" +
      "</div>";

    document.body.prepend(header);
    document.body.prepend(topbar);
    document.body.prepend(ribbon);

    var toggle = header.querySelector(".nav-toggle");
    var nav = header.querySelector(".nav");
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
  };

  TRU.mountActionBar = function () {
    var bar = document.createElement("div");
    bar.className = "action-bar";
    bar.innerHTML =
      '<a href="tel:' + TEL + '">' + ICON.phone + "Call</a>" +
      '<a class="wa" href="https://wa.me/' + WA + '">' + ICON.wa + "WhatsApp</a>" +
      '<a class="stock" href="/stock.html">' + ICON.grid + "Stock</a>";
    document.body.appendChild(bar);
  };

  /* Direct-contact FAB retired in favor of right-hand unified glassmorphic dock */
  TRU.mountContactFab = function () {};

  TRU.mountGlassDock = function () {
    if (document.getElementById("fabDock")) return;
    var dock = document.createElement("div");
    dock.className = "glass-fab-dock";
    dock.id = "fabDock";
    dock.innerHTML =
      '<button type="button" class="glass-fab" id="fabChat" aria-label="AI Chat">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span>AI Chat</span>' +
      '</button>' +
      '<button type="button" class="glass-fab" id="fabEnquiry" aria-label="Enquire now">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
        '<span>Enquire</span>' +
      '</button>' +
      '<a class="glass-fab wa" href="https://wa.me/' + WA + '" target="_blank" rel="noopener" aria-label="WhatsApp">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.972.531 1.83.813 2.796.813h.005c3.18 0 5.767-2.586 5.768-5.766 0-1.54-.599-2.989-1.688-4.079-1.09-1.089-2.54-1.689-4.085-1.689z"/></svg>' +
        '<span>WhatsApp</span>' +
      '</a>';
    document.body.appendChild(dock);
  };

  TRU.mountFooter = function () {
    /* CTA band — brochure page 8 style */
    var cta = document.createElement("section");
    cta.className = "cta-band";
    cta.innerHTML =
      '<div class="wrap">' +
        '<h2>Twenty-five minutes, <em>on your own stock.</em></h2>' +
        '<a class="btn-accent" href="https://wa.me/' + WA + '?text=' +
          encodeURIComponent("I'd like to book a walkthrough of TruDealer.") + '">Book now</a>' +
      '</div>';
    document.body.appendChild(cta);

    var f = document.createElement("footer");
    f.className = "site-footer";
    f.innerHTML =
      '<div class="wrap">' +
        /* Newsletter / lead capture */
        '<div class="footer-newsletter">' +
          '<div class="footer-newsletter-text">' +
            '<h3>Stay in the loop</h3>' +
            '<p>New stock alerts, market insights, and platform updates. No spam — ever.</p>' +
          '</div>' +
          '<form class="footer-newsletter-form" onsubmit="event.preventDefault();this.querySelector(\'.fn-ok\').style.display=\'flex\';this.querySelector(\'.fn-fields\').style.display=\'none\'">' +
            '<div class="fn-fields">' +
              '<input type="email" placeholder="you@email.com" required aria-label="Email address">' +
              '<button type="submit" class="fn-btn">Subscribe →</button>' +
            '</div>' +
            '<div class="fn-ok" style="display:none"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5DE9D4" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <span>You\'re in! We\'ll be in touch.</span></div>' +
          '</form>' +
        '</div>' +

        /* Ecosystem pitch */
        '<a class="footer-lead" href="https://trudealer.tru-saas.com" ' +
          'target="_blank" rel="noopener">' +
          'Inspection reports, guided capture, stock management and AI — ' +
          '<em>one stack, any market.</em> Built in Cape Town. Deployed anywhere. ' +
          'Join independent dealers thriving on our <em>ecosystem</em>.' +
        '</a>' +

        '<div class="footer-grid">' +
          "<div>" +
            '<a class="brand" href="/index.html" style="display:inline-flex">' +
              '<span class="brand-mark"><img src="/assets/brand/favicon.svg" alt="" width="38" height="38"></span>' +
              '<span class="brand-text"><span class="brand-word" aria-label="Truecars">True<b class="lw lw-c">C<i></i></b><b class="lw lw-a">a<i></i></b><b class="lw lw-r">r<i></i></b><b class="lw lw-s">s<i></i></b></span><span style="color:rgba(250,250,247,0.35)">A TruDealer storefront</span></span>' +
            "</a>" +
            '<p style="margin-top:20px;font-size:14px;max-width:34ch;color:rgba(250,250,247,0.45)">' +
              "The demo storefront for the TruDealer platform — inventory, inspection, finance and messaging as one system." +
            "</p>" +
            /* Social icons */
            '<div class="footer-social">' +
              '<a href="https://wa.me/' + WA + '" aria-label="WhatsApp" class="footer-social-link"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></a>' +
              '<a href="https://www.facebook.com/trudealer/" aria-label="Facebook" class="footer-social-link" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>' +
              '<a href="https://share.google/PKoIMB5UMAox1OuzB" aria-label="Google" class="footer-social-link" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" y1="12" x2="22" y2="12"/></svg></a>' +
              '<a href="https://www.linkedin.com/company/trudealer/" aria-label="LinkedIn" class="footer-social-link" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>' +
            '</div>' +
          "</div>" +
          "<div><h4>Shop</h4><ul>" +
            '<li><a href="/stock.html">All stock</a></li>' +
            '<li><a href="/stock.html?bodyType=SUV">SUVs</a></li>' +
            '<li><a href="/stock.html?bodyType=Bakkie">Bakkies</a></li>' +
            '<li><a href="/stock.html?bodyType=Hatchback">Hatchbacks</a></li>' +
          "</ul></div>" +
          "<div><h4>Buy &amp; sell</h4><ul>" +
            '<li><a href="/finance.html">Finance calculator</a></li>' +
            '<li><a href="/trade-in.html">Sell or trade in</a></li>' +
            '<li><a href="https://wa.me/' + WA + '">WhatsApp us</a></li>' +
          "</ul></div>" +
          "<div><h4>Platform</h4><ul>" +
            '<li><a href="https://www.tru-saas.com" target="_blank" rel="noopener">TruDealer</a></li>' +
            '<li><a href="https://trudealer.tru-saas.com" target="_blank" rel="noopener">The system</a></li>' +
            '<li><a href="https://trudealer.tru-saas.com" target="_blank" rel="noopener">Client sites</a></li>' +
          "</ul></div>" +
        "</div>" +

        /* Trust badges */
        '<div class="footer-trust">' +
          '<div class="footer-trust-badge"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> TruInspect Certified</div>' +
          '<div class="footer-trust-badge"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> TransUnion Verified</div>' +
          '<div class="footer-trust-badge"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Secure Payments</div>' +
          '<div class="footer-trust-badge"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 48hr Reservation</div>' +
        '</div>' +

        '<div class="footer-note">' +
          "<span>© " + new Date().getFullYear() + " TruSaaS · Cape Town</span>" +
          "<span>Vehicles, prices &amp; inspection data are illustrative</span>" +
          '<span>Powered by <a href="https://www.tru-saas.com" target="_blank" rel="noopener" style="color:var(--accent)">TruDealer</a></span>' +
        "</div>" +
      "</div>";
    document.body.appendChild(f);
  };

  /* ---- favourites (local, demo-only) ---- */
  var FAVS = "tru_favs";
  function favs() {
    try { return JSON.parse(localStorage.getItem(FAVS) || "[]"); } catch (e) { return []; }
  }
  TRU.isFav = function (stock) { return favs().indexOf(stock) !== -1; };
  TRU.toggleFav = function (stock) {
    var list = favs();
    var i = list.indexOf(stock);
    if (i === -1) list.push(stock); else list.splice(i, 1);
    try { localStorage.setItem(FAVS, JSON.stringify(list)); } catch (e) {}
    return i === -1;
  };

  /* ---- vehicle card ---- */
  TRU.cardHtml = function (v, opts) {
    var e = TRU.esc;
    var o = opts || {};
    var price = v.truPrice && v.truPrice < v.price ? v.truPrice : v.price;
    var saving = v.truPrice && v.truPrice < v.price ? v.price - v.truPrice : 0;
    var stockId = v.stockNumber || v.id;

    var specs = [v.mileage ? TRU.km(v.mileage) : "", v.transmission, v.fuelType]
      .filter(Boolean)
      .map(function (s) { return '<span class="spec">' + e(s) + "</span>"; })
      .join("");

    var href = "/vehicle.html?stock=" + encodeURIComponent(stockId);
    var badge = TRU.priceBadge(v);
    var isFeature = !!o.feature;

    return (
      '<article class="card' + (isFeature ? " is-feature" : "") + '">' +
        '<div class="card-media">' +
          '<a href="' + href + '" aria-label="' + e(TRU.title(v)) + '" style="display:block;width:100%;height:100%">' +
            '<img src="' + e(v.heroImage || (v.images && v.images[0]) || "/assets/hero-showroom.jpg") + '" alt="' + e(TRU.title(v)) + '" loading="lazy">' +
          '</a>' +
          (badge ? badge : "") +
          (v.vir ? '<span class="card-vir-badge">VIR ' + v.vir + ' / 100</span>' : "") +
          (isFeature && o.callout
            ? '<span class="card-callout">' + e(o.callout) + "</span>"
            : "") +
        "</div>" +
        '<div class="card-tools">' +
          '<button data-share="' + e(stockId) + '" aria-label="Share">' + ICON.share + "</button>" +
          '<button data-fav="' + e(stockId) + '" aria-label="Save"' +
            (TRU.isFav(stockId) ? ' class="is-on"' : "") + ">" + ICON.heart + "</button>" +
        "</div>" +

        '<div class="card-body">' +
          '<div class="card-top-row">' +
            '<div class="card-meta">' + v.year + " · " + e(String(v.make).toUpperCase()) + "</div>" +
          '</div>' +
          '<a href="' + href + '" class="card-title-link">' +
            '<h3 class="card-title">' + e(v.model) + "</h3>" +
            (v.trim ? '<div class="card-trim">' + e(v.trim) + "</div>" : "") +
          "</a>" +
          '<div class="card-specs">' + specs + "</div>" +
          '<div class="card-price">' +
            '<div class="price-block">' +
              (saving ? '<span class="price-was">' + TRU.money(v.price) + "</span>" : "") +
              '<span class="price-now">' + TRU.money(price) + "</span>" +
            "</div>" +
            '<div class="price-pm">From <b>' + TRU.money(TRU.monthly(price)) + " / mo</b></div>" +
          "</div>" +
        "</div>" +
        '<a class="card-cta" href="' + href + '">View vehicle</a>' +
      "</article>"
    );
  };

  /* Share uses TruShare when present; native share sheet fallback */
  TRU.bindCardTools = function (root) {
    (root || document).addEventListener("click", function (ev) {
      var fav = ev.target.closest("[data-fav]");
      if (fav) {
        ev.preventDefault();
        fav.classList.toggle("is-on", TRU.toggleFav(fav.getAttribute("data-fav")));
        return;
      }
      var btn = ev.target.closest("[data-share]");
      if (!btn) return;
      ev.preventDefault();
      var v = TRU.get(btn.getAttribute("data-share"));
      if (!v) return;

      if (window.TruShare && typeof window.TruShare.open === "function") {
        window.TruShare.open(v);
        return;
      }
      var url = location.origin + "/vehicle/?stock=" + encodeURIComponent(v.stockNumber);
      var title = TRU.title(v) + " — " + TRU.money(v.truPrice || v.price);
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        btn.setAttribute("aria-label", "Link copied");
      }
    });
  };

  /* Hide default TruForm + TruAfford launchers (we use custom glass FABs)
     and restyle TruChat FAB to glassmorphic */
  var GLASS_CSS =
    "background: rgba(255,255,255,0.82) !important;" +
    "backdrop-filter: blur(18px) saturate(1.6) !important;" +
    "-webkit-backdrop-filter: blur(18px) saturate(1.6) !important;" +
    "border: 1px solid rgba(26,26,46,0.1) !important;" +
    "box-shadow: 0 4px 20px -4px rgba(26,26,46,0.1), 0 1px 3px rgba(26,26,46,0.06) !important;";

  TRU.glassifyWidgets = function () {
    function sweep() {
      /* hide TruForm launcher */
      document.querySelectorAll('[id^="tru-form-"][id$="-host"], [id^="tf-"][id$="-host"]').forEach(function (host) {
        if (host.dataset.launcherHidden || !host.shadowRoot) return;
        var launcher = host.shadowRoot.querySelector(".tf-launcher");
        if (!launcher) return;
        launcher.style.setProperty("display", "none", "important");
        host.dataset.launcherHidden = "1";
      });

      /* Hide TruAfford's own launcher — our glass FAB triggers it instead.
         Hide ONLY the launcher, never the host: the panel lives inside the
         same host, so display:none on the host meant TruAfford.open() had
         nothing visible to open and the Finance FAB appeared dead. */
      var affordHost = document.getElementById("tru-afford-host");
      if (affordHost && affordHost.shadowRoot && !affordHost.dataset.glassed) {
        var affordLauncher = affordHost.shadowRoot.querySelector(".ta-launcher");
        if (affordLauncher) {
          affordLauncher.style.setProperty("display", "none", "important");
          affordHost.dataset.glassed = "1";
        }
      }

      /* hide default TruChat launcher & tip because glassmorphic #fabChat triggers it */
      var chatFab = document.getElementById("tc-fab");
      if (chatFab) {
        chatFab.style.setProperty("display", "none", "important");
      }
      var chatTip = document.getElementById("tc-tip");
      if (chatTip) {
        chatTip.style.setProperty("display", "none", "important");
      }
    }
    sweep();
    new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
    setTimeout(sweep, 400);
    setTimeout(sweep, 1200);
    setTimeout(sweep, 3000);
    setTimeout(sweep, 6000);

    /* Wire glass dock actions */
    document.addEventListener("click", function (ev) {
      var chat = ev.target.closest("#fabChat");
      if (chat) {
        var tcFab = document.getElementById("tc-fab");
        if (tcFab) {
          tcFab.click();
        } else if (window.TruChat && window.TruChat.open) {
          window.TruChat.open();
        }
      }
      var enq = ev.target.closest("#fabEnquiry");
      if (enq) {
        if (window.TruForm && window.TruForm.open) {
          window.TruForm.open({ interest: "General enquiry", source: "glass-fab" });
        } else {
          location.href = "https://wa.me/" + WA;
        }
      }
    });
  };

  /* ---- scroll reveal (IntersectionObserver) ---- */
  TRU.initReveals = function () {
    var els = document.querySelectorAll(".reveal:not(.hero .reveal)");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px 12% 0px" });
    els.forEach(function (el) { io.observe(el); });
  };

  /* ---- card reveal stagger ---- */
  TRU.staggerCards = function (container) {
    if (!container) return;
    var cards = container.querySelectorAll(".card");
    cards.forEach(function (card, i) {
      card.classList.add("reveal");
      card.style.transitionDelay = (i * 50) + "ms";
    });
    if (!("IntersectionObserver" in window)) {
      cards.forEach(function (c) { c.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px 12% 0px" });
    cards.forEach(function (c) { io.observe(c); });
  };

  /* ---- 3D tilt on vehicle frames ----
     Pointer position drives --rx/--ry (rotation) and --mx/--my (sheen origin)
     on .card-media. Delegated from the document so cards rendered later — the
     stock grid re-renders on every filter change — are covered without rebinding.
     Pointer-coarse devices and reduced-motion users are skipped entirely. */
  TRU.initTilt = function () {
    if (!window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var MAX = 5.5; // degrees — restraint; more reads as a gimmick

    function onMove(ev) {
      var media = ev.target.closest && ev.target.closest(".card-media");
      if (!media) return;
      var r = media.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = (ev.clientX - r.left) / r.width;   // 0..1
      var py = (ev.clientY - r.top) / r.height;
      media.classList.add("is-tilting");
      media.style.setProperty("--ry", ((px - 0.5) * 2 * MAX).toFixed(2) + "deg");
      media.style.setProperty("--rx", ((0.5 - py) * 2 * MAX).toFixed(2) + "deg");
      media.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      media.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    }

    function reset(ev) {
      var media = ev.target.closest && ev.target.closest(".card-media");
      if (!media) return;
      media.classList.remove("is-tilting");
      media.style.setProperty("--rx", "0deg");
      media.style.setProperty("--ry", "0deg");
      media.style.setProperty("--mx", "50%");
      media.style.setProperty("--my", "50%");
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", reset, { passive: true });
  };

  /* ---- Parallax depth ---- */
  TRU.mountParallax = function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var heroMedia = document.querySelector('.hero-media');
    if (!heroMedia) return;
    heroMedia.classList.add('parallax-layer');
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var scrollY = window.scrollY;
          var heroH = heroMedia.offsetHeight;
          if (scrollY < heroH * 1.5) {
            heroMedia.style.transform = 'translate3d(0,' + (scrollY * 0.35) + 'px,0) scale(' + (1 + scrollY * 0.0001) + ')';
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  };

  /* ---- Dark mode toggle ---- */
  TRU.mountDarkMode = function () {
    var stored = localStorage.getItem('tru-theme');
    var theme = stored || 'light';
    document.documentElement.setAttribute('data-theme', theme);

    // Insert toggle into header
    var header = document.querySelector('.site-header .wrap');
    if (!header) return;
    var nav = header.querySelector('.nav');
    var toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.setAttribute('aria-label', 'Toggle dark mode');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    if (nav) header.insertBefore(toggle, nav);

    toggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('tru-theme', next);
    });
  };

  /* ---- Saved & Recently Viewed Drawer ---- */
  TRU.recentlyViewed = {
    KEY: 'tru-recent',
    MAX: 6,
    add: function (v) {
      if (!v || !v.stockNumber && !v.id) return;
      var id = v.stockNumber || v.id;
      var list = this.get();
      list = list.filter(function (item) { return item.id !== id; });
      list.unshift({ id: id, title: TRU.title(v), price: v.truPrice || v.price, img: v.heroImage || (v.images && v.images[0]) || '', make: v.make, model: v.model });
      if (list.length > this.MAX) list = list.slice(0, this.MAX);
      try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) {}
    },
    get: function () {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; }
    }
  };

  TRU.mountSavedDrawer = function () {
    var backdrop = document.createElement('div');
    backdrop.className = 'saved-drawer-backdrop';
    backdrop.id = 'savedBackdrop';

    var drawer = document.createElement('div');
    drawer.className = 'saved-drawer';
    drawer.id = 'savedDrawer';
    drawer.innerHTML =
      '<div class="saved-drawer-head">' +
        '<h3>My Garage</h3>' +
        '<button class="saved-drawer-close" id="savedClose">✕</button>' +
      '</div>' +
      '<div class="saved-drawer-tabs">' +
        '<button class="saved-drawer-tab is-active" data-tab="saved">Saved</button>' +
        '<button class="saved-drawer-tab" data-tab="recent">Recently Viewed</button>' +
      '</div>' +
      '<div class="saved-drawer-body" id="savedBody"></div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    var activeTab = 'saved';

    function renderDrawer() {
      var body = document.getElementById('savedBody');
      if (!body) return;
      var items = activeTab === 'saved' ? getSavedItems() : TRU.recentlyViewed.get();
      if (!items.length) {
        body.innerHTML =
          '<div class="saved-drawer-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
            '<p>' + (activeTab === 'saved' ? 'No saved vehicles yet. Tap the heart icon on any car to save it here.' : 'No vehicles viewed yet. Browse the showroom to see your history.') + '</p>' +
          '</div>';
        return;
      }
      body.innerHTML = items.map(function (item) {
        return (
          '<a class="saved-drawer-item" href="/vehicle.html?stock=' + encodeURIComponent(item.id) + '">' +
            (item.img ? '<img src="' + TRU.esc(item.img) + '" alt="">' : '') +
            '<div class="saved-drawer-item-info">' +
              '<div class="saved-drawer-item-title">' + TRU.esc(item.title) + '</div>' +
              '<div class="saved-drawer-item-meta">' + TRU.esc(item.make || '') + '</div>' +
              '<div class="saved-drawer-item-price">' + TRU.money(item.price) + '</div>' +
            '</div>' +
          '</a>'
        );
      }).join('');
      updateBadge();
    }

    function getSavedItems() {
      var favs = [];
      try { favs = JSON.parse(localStorage.getItem('tru-favs')) || []; } catch(e) {}
      // favs is an array of stock IDs; look up from stock data
      return favs.map(function(id) {
        var v = TRU.get ? TRU.get(id) : null;
        if (!v) return null;
        return { id: id, title: TRU.title(v), price: v.truPrice || v.price, img: v.heroImage || (v.images && v.images[0]) || '', make: v.make, model: v.model };
      }).filter(Boolean);
    }

    function updateBadge() {
      var badge = document.getElementById('savedBadgeCount');
      if (!badge) return;
      var saved = [];
      try { saved = JSON.parse(localStorage.getItem('tru-favs')) || []; } catch(e) {}
      var count = saved.length;
      badge.textContent = count;
      badge.classList.toggle('has-items', count > 0);
    }

    function openDrawer() {
      backdrop.classList.add('is-open');
      drawer.classList.add('is-open');
      renderDrawer();
    }
    function closeDrawer() {
      backdrop.classList.remove('is-open');
      drawer.classList.remove('is-open');
    }

    backdrop.addEventListener('click', closeDrawer);
    drawer.querySelector('#savedClose').addEventListener('click', closeDrawer);
    drawer.querySelectorAll('.saved-drawer-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        activeTab = tab.dataset.tab;
        drawer.querySelectorAll('.saved-drawer-tab').forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        renderDrawer();
      });
    });

    // Add saved button to header
    var header = document.querySelector('.site-header .wrap');
    if (header) {
      var nav = header.querySelector('.nav');
      var savedBtn = document.createElement('button');
      savedBtn.className = 'theme-toggle saved-badge';
      savedBtn.setAttribute('aria-label', 'Saved vehicles');
      savedBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
        '<span class="saved-badge-count" id="savedBadgeCount">0</span>';
      if (nav) header.insertBefore(savedBtn, nav);
      savedBtn.addEventListener('click', openDrawer);
      updateBadge();
    }
  };

  /* ---- Micro-interactions ---- */
  TRU.mountMicroInteractions = function () {
    // Button ripple on primary CTAs
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.btn-primary');
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      var ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      var size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (ev.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (ev.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', function () { ripple.remove(); });
    });
  };

  /* ---- Skeleton loading ---- */
  TRU.showSkeletons = function (container, count) {
    if (!container) return;
    count = count || 6;
    var html = '';
    for (var i = 0; i < count; i++) {
      html +=
        '<div class="skel-card">' +
          '<div class="skel-card-img skel"></div>' +
          '<div class="skel-card-body">' +
            '<div class="skel-line w60 skel"></div>' +
            '<div class="skel-line w80 skel"></div>' +
            '<div class="skel-line w40 tall skel"></div>' +
          '</div>' +
        '</div>';
    }
    container.innerHTML = html;
  };

  /* ---- Prefetch on nav hover ---- */
  TRU.mountPrefetch = function () {
    var prefetched = {};
    document.querySelectorAll('.nav a[href]').forEach(function (a) {
      a.addEventListener('mouseenter', function () {
        var href = a.getAttribute('href');
        if (!href || href.startsWith('http') || prefetched[href]) return;
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
        prefetched[href] = true;
      }, { once: true });
    });
  };

  /* ---- scroll polish: progress hairline, whole-card click, badge touch ---- */
  TRU.mountScrollPolish = function () {
    /* progress hairline under the top edge */
    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    function paint() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();

    /* whole card is clickable — interactive children keep their own clicks */
    document.addEventListener("click", function (ev) {
      if (ev.target.closest("a, button, input, label, select, textarea")) return;
      var card = ev.target.closest(".card");
      if (!card || card.classList.contains("card-filler")) return;
      var link = card.querySelector(".card-title-link, .card-media");
      if (link && link.href) location.href = link.href;
    });

    /* tech badges: tap / keyboard opens the tip on touch devices */
    var coarse = window.matchMedia && window.matchMedia("(hover: none)").matches;
    document.addEventListener("click", function (ev) {
      var badge = ev.target.closest(".tru-tech-badge");
      if (!badge) return;
      if (!coarse) return; /* hover devices keep pure hover behaviour */
      ev.preventDefault();
      var wasOpen = badge.classList.contains("is-open");
      document.querySelectorAll(".tru-tech-badge.is-open").forEach(function (b) {
        b.classList.remove("is-open");
        b.setAttribute("aria-expanded", "false");
      });
      if (!wasOpen) {
        badge.classList.add("is-open");
        badge.setAttribute("aria-expanded", "true");
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var badge = ev.target.closest && ev.target.closest(".tru-tech-badge");
      if (!badge) return;
      ev.preventDefault();
      badge.classList.toggle("is-open");
      badge.setAttribute("aria-expanded", badge.classList.contains("is-open") ? "true" : "false");
    });
  };

  function boot() {
    TRU.mountChrome();
    TRU.mountFooter();
    TRU.mountActionBar();
    TRU.mountContactFab();
    TRU.mountGlassDock();
    TRU.bindCardTools(document);
    TRU.glassifyWidgets();
    TRU.initReveals();
    TRU.initTilt();
    
    TRU.mountParallax();
    TRU.mountDarkMode();
    TRU.mountSavedDrawer();
    TRU.mountMicroInteractions();
    TRU.mountPrefetch();
    TRU.mountScrollPolish();
    
    var featured = document.getElementById('featured');
    if (featured) TRU.showSkeletons(featured);
    var results = document.getElementById('results');
    if (results) TRU.showSkeletons(results);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
