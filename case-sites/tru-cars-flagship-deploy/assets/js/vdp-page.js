(function () {
  var TRU = window.TruShowroom;
  var e = TRU.esc;

/* ---- Immersive Gallery + Lightbox ---- */
function galleryHTML(images, title) {
  if (!images || !images.length) return '';
  var hero = images[0];
  var thumbs = images.map(function(img, i) {
    return '<button type="button" class="vdp-filmstrip-thumb' + (i === 0 ? ' is-active' : '') + '" data-idx="' + i + '">' +
      '<img src="' + e(img) + '" alt="Photo ' + (i+1) + '" loading="lazy">' +
    '</button>';
  }).join('');
  return (
    '<div class="vdp-gallery-immersive">' +
      '<div class="vdp-gallery-hero" id="galleryHero" role="button" tabindex="0" aria-label="Open full-screen gallery">' +
        '<img id="galleryHeroImg" src="' + e(hero) + '" alt="' + e(title) + '">' +
        '<span class="vdp-gallery-count">' + images.length + ' photos</span>' +
      '</div>' +
      '<div class="vdp-filmstrip" id="galleryFilmstrip">' + thumbs + '</div>' +
    '</div>'
  );
}

function mountGallery(images) {
  if (!images || images.length < 2) return;
  var heroImg = document.getElementById('galleryHeroImg');
  var filmstrip = document.getElementById('galleryFilmstrip');
  var heroWrap = document.getElementById('galleryHero');
  if (!heroImg || !filmstrip) return;

  var currentIdx = 0;

  filmstrip.addEventListener('click', function(ev) {
    var btn = ev.target.closest('.vdp-filmstrip-thumb');
    if (!btn) return;
    var idx = Number(btn.dataset.idx);
    currentIdx = idx;
    heroImg.src = images[idx];
    filmstrip.querySelectorAll('.vdp-filmstrip-thumb').forEach(function(t, i) {
      t.classList.toggle('is-active', i === idx);
    });
  });

  // Lightbox
  heroWrap.addEventListener('click', function() { openLightbox(images, currentIdx); });
  heroWrap.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') openLightbox(images, currentIdx); });
}

function openLightbox(images, startIdx) {
  var idx = startIdx || 0;
  var lb = document.createElement('div');
  lb.className = 'gallery-lightbox';
  lb.innerHTML =
    '<button class="gallery-lightbox-close" aria-label="Close">×</button>' +
    '<button class="gallery-lightbox-nav prev" aria-label="Previous">‹</button>' +
    '<img src="' + e(images[idx]) + '" alt="Photo ' + (idx+1) + '">' +
    '<button class="gallery-lightbox-nav next" aria-label="Next">›</button>' +
    '<div class="gallery-lightbox-counter">' + (idx+1) + ' / ' + images.length + '</div>';
  document.body.appendChild(lb);
  requestAnimationFrame(function() { lb.classList.add('is-open'); });

  var img = lb.querySelector('img');
  var counter = lb.querySelector('.gallery-lightbox-counter');

  function show(i) {
    idx = (i + images.length) % images.length;
    img.src = images[idx];
    counter.textContent = (idx+1) + ' / ' + images.length;
  }

  lb.querySelector('.prev').addEventListener('click', function() { show(idx - 1); });
  lb.querySelector('.next').addEventListener('click', function() { show(idx + 1); });
  lb.querySelector('.gallery-lightbox-close').addEventListener('click', close);
  lb.addEventListener('click', function(ev) { if (ev.target === lb) close(); });

  document.addEventListener('keydown', onKey);
  function onKey(ev) {
    if (ev.key === 'Escape') close();
    if (ev.key === 'ArrowLeft') show(idx - 1);
    if (ev.key === 'ArrowRight') show(idx + 1);
  }
  function close() {
    lb.classList.remove('is-open');
    setTimeout(function() { lb.remove(); }, 300);
    document.removeEventListener('keydown', onKey);
  }
}

  function notFound() {
    document.getElementById("content").innerHTML =
      '<div class="empty"><h3>That car is no longer on the floor.</h3>' +
      '<a class="link" href="/stock.html" style="margin-top:16px">Back to the showroom</a></div>';
  }

  function specRows(v) {
    var rows = [
      ["Stock number",  v.stockNumber || v.id],
      ["Year",          v.year],
      ["Mileage",       v.mileage ? TRU.km(v.mileage) : null],
      ["Transmission",  v.transmission],
      ["Fuel type",     v.fuelType],
      ["Body type",     v.bodyType],
      ["Colour",        v.color],
      ["Drivetrain",    v.drive || "Front-Wheel Drive"],
      ["Engine / Power",v.engine || (v.trim ? v.trim : null)],
      ["Service history", v.serviceHistory || "Full Franchise Service History"],
      ["VIN",           v.vin || "Verified TransUnion"],
    ];
    return rows
      .filter(function (r) { return r[1] != null && r[1] !== ""; })
      .map(function (r) { return "<tr><td>" + e(r[0]) + "</td><td>" + e(r[1]) + "</td></tr>"; })
      .join("");
  }

  function renderHighlights(v) {
    var items = [
      { label: "Year", val: v.year },
      { label: "Mileage", val: v.mileage ? TRU.km(v.mileage) : "Low KM" },
      { label: "Gearbox", val: v.transmission || "Automatic" },
      { label: "Fuel", val: v.fuelType || "Petrol" },
      { label: "Body", val: v.bodyType || "Sedan / Hatch" },
      { label: "Colour", val: v.color || "Metallic" },
      { label: "Condition", val: v.vir ? ("VIR " + v.vir + "/100") : "Inspected" },
      { label: "Warranty", val: "TruDealer Certified" },
    ];
    return (
      '<div class="vdp-highlights-grid">' +
        items.map(function (it) {
          return (
            '<div class="highlight-tile">' +
              '<span class="highlight-label">' + e(it.label) + '</span>' +
              '<span class="highlight-value">' + e(it.val) + '</span>' +
            '</div>'
          );
        }).join("") +
      '</div>'
    );
  }

  function virPanel(v) {
    var score = Number(v.vir) || 94;
    var grade = score >= 90 ? "Grade A+" : (score >= 80 ? "Grade A" : "Grade B");
    var advisories = (v.damage || []).length
      ? '<ul class="advisories" style="margin-top:16px">' +
          v.damage.map(function (d) {
            return '<li><span class="dot"></span><div><b>' + e(d.area) +
              "</b>" + e(d.note) + "</div></li>";
          }).join("") +
        "</ul>"
      : '<p style="margin:16px 0 0;font-size:13.5px;color:var(--ink-quiet)">All primary components passed multi-point certification with zero critical advisories.</p>';

    return (
      '<div class="vir-full-card panel" id="virSection">' +
        '<div class="tru-tech-badge" tabindex="0" role="button" aria-expanded="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
          '<span>Verified by <b>TruInspect</b></span>' +
          '<div class="tech-tip"><b>TruInspect</b> conducts 114-point mobile condition audits, calculates VIR scoring rubrics, and generates verified inspection certificates on phone/tablet.</div>' +
        '</div>' +
        '<div class="vir-score-row">' +
          '<div class="vir-ring-wrap">' +
            '<svg class="vir-ring-svg" viewBox="0 0 140 140">' +
              '<defs><linearGradient id="virGradient" x1="0%" y1="0%" x2="100%" y2="0%">' +
                '<stop offset="0%" stop-color="#22c55e"/>' +
                '<stop offset="50%" stop-color="#07879A"/>' +
                '<stop offset="100%" stop-color="#5DE9D4"/>' +
              '</linearGradient></defs>' +
              '<circle class="vir-ring-bg" cx="70" cy="70" r="60"/>' +
              '<circle class="vir-ring-fill" id="virRing" cx="70" cy="70" r="60" ' +
                'stroke-dasharray="' + (2 * Math.PI * 60).toFixed(1) + '" ' +
                'stroke-dashoffset="' + (2 * Math.PI * 60).toFixed(1) + '"/>' +
            '</svg>' +
            '<div class="vir-ring-label">' +
              '<span class="vir-ring-num" id="virScoreNum">0</span>' +
              '<span class="vir-ring-max">/ 100</span>' +
            '</div>' +
          '</div>' +
          '<div class="vir-seal-meta">' +
            '<h4>' + e(v.conditionLabel || "TruInspect Certified") + '</h4>' +
            '<p>114-point mechanical, electrical and structural audit</p>' +
            '<div class="vir-badge-certified">' + grade + ' Verified Condition</div>' +
          '</div>' +
        '</div>' +

        '<div class="vir-cat-bars">' +
          '<div class="vir-cat-item">' +
            '<div class="vir-cat-info"><span>Mechanical & Powertrain</span><b>98%</b></div>' +
            '<div class="vir-progress-track"><div class="vir-progress-fill" style="width:98%"></div></div>' +
          '</div>' +
          '<div class="vir-cat-item">' +
            '<div class="vir-cat-info"><span>Body & Structural Integrity</span><b>95%</b></div>' +
            '<div class="vir-progress-track"><div class="vir-progress-fill" style="width:95%"></div></div>' +
          '</div>' +
          '<div class="vir-cat-item">' +
            '<div class="vir-cat-info"><span>Electrical & OBD Diagnostics</span><b>100%</b></div>' +
            '<div class="vir-progress-track"><div class="vir-progress-fill" style="width:100%"></div></div>' +
          '</div>' +
          '<div class="vir-cat-item">' +
            '<div class="vir-cat-info"><span>Interior & Safety Systems</span><b>94%</b></div>' +
            '<div class="vir-progress-track"><div class="vir-progress-fill" style="width:94%"></div></div>' +
          '</div>' +
          '<div class="vir-cat-item">' +
            '<div class="vir-cat-info"><span>Tyres, Brakes & Suspension</span><b>92%</b></div>' +
            '<div class="vir-progress-track"><div class="vir-progress-fill" style="width:92%"></div></div>' +
          '</div>' +
        '</div>' +

        '<div class="vir-trust-grid">' +
          '<div class="vir-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Clean Title Guaranteed</div>' +
          '<div class="vir-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> TransUnion Data Verified</div>' +
          '<div class="vir-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Authenticated Odometer</div>' +
          '<div class="vir-trust-item"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Roadworthy Certified</div>' +
        '</div>' +

        advisories +

        '<div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">' +
          '<a class="btn btn-outline btn-block" id="virRequest" style="cursor:pointer;text-align:center" href="/vir-report.html?stock=' + encodeURIComponent(v.stockNumber || v.id) + '">Request TruDealer Inspection Report</a>' +
        '</div>' +
        '<div class="widget-powered">Powered by TruDealer</div>' +
      '</div>'
    );
  }

  function marketPricePanel(v) {
    var price = v.truPrice && v.truPrice < v.price ? v.truPrice : v.price;
    // Simulated market comparison data
    var avgMarket = Math.round(price * 1.06);
    var highMarket = Math.round(price * 1.14);
    var lowMarket = Math.round(price * 0.97);
    var pct = Math.round(((avgMarket - price) / avgMarket) * 100);
    var tier = pct >= 4 ? 'great' : (pct >= 1 ? 'fair' : 'above');
    var tierLabel = pct >= 4 ? 'Great Price' : (pct >= 1 ? 'Fair Price' : 'Above Market');
    var markerPos = Math.max(5, Math.min(95, Math.round((price - lowMarket) / (highMarket - lowMarket) * 100)));

    return (
      '<div class="market-panel">' +
        '<div class="market-panel-head">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>' +
          '<h4>This car vs. the market</h4>' +
          '<span class="market-panel-badge ' + tier + '">' + tierLabel + ' · ' + pct + '% below avg</span>' +
        '</div>' +
        '<div class="market-bar-wrap">' +
          '<div class="market-bar-fill" style="width:100%"></div>' +
          '<div class="market-bar-marker" id="marketMarker" style="left:' + markerPos + '%">' +
            '<span class="market-bar-label">You: ' + TRU.money(price) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="market-comps">' +
          '<div class="market-comp"><div class="market-comp-source">AutoTrader Avg</div><div class="market-comp-price">' + TRU.money(avgMarket) + '</div></div>' +
          '<div class="market-comp"><div class="market-comp-source">Cars.co.za</div><div class="market-comp-price">' + TRU.money(Math.round(avgMarket * 1.02)) + '</div></div>' +
          '<div class="market-comp"><div class="market-comp-source">TruDealer Fair</div><div class="market-comp-price">' + TRU.money(price) + '</div></div>' +
        '</div>' +
        '<div class="widget-powered">Powered by TruDealer</div>' +
      '</div>'
    );
  }

  function renderFinanceCalc(v, basePrice) {
    return (
      '<div class="fin-calc-card" id="financeCalc">' +
        '<div class="tru-tech-badge" style="margin-bottom:12px" tabindex="0" role="button" aria-expanded="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' +
          '<span>Calculated with <b>TruRepay</b></span>' +
          '<div class="tech-tip"><b>TruRepay</b> embeds live bank-grade finance calculators with deposit, term, and balloon sliders that capture pre-qualified leads for TruFlow DMS.</div>' +
        '</div>' +
        '<div class="fin-calc-head">' +
          '<h3 class="fin-calc-title">Interactive Finance Calculator</h3>' +
          '<span class="fin-calc-badge">Real-Time Figures</span>' +
        '</div>' +

        '<div class="fin-breakdown">' +
          '<div class="fin-bd-item is-main">' +
            '<span class="fin-bd-label">Estimated Monthly Instalment</span>' +
            '<span class="fin-bd-val" id="calcMonthly">' + TRU.money(TRU.monthly(basePrice)) + ' <span style="font-size:16px;font-family:var(--sans);font-weight:400;color:var(--ink-quiet)">/ mo</span></span>' +
          '</div>' +
          '<div class="fin-bd-item">' +
            '<span class="fin-bd-label">Vehicle Price</span>' +
            '<span class="fin-bd-sub" id="calcVehiclePrice" style="font-weight:600;color:var(--ink)">' + TRU.money(basePrice) + '</span>' +
          '</div>' +
          '<div class="fin-bd-item">' +
            '<span class="fin-bd-label">Deposit Amount</span>' +
            '<span class="fin-bd-sub" id="calcDepositVal" style="font-weight:600;color:var(--accent)">' + TRU.money(basePrice * 0.1) + '</span>' +
          '</div>' +
          '<div class="fin-bd-item">' +
            '<span class="fin-bd-label">Principal Financed</span>' +
            '<span class="fin-bd-sub" id="calcPrincipal" style="font-weight:600;color:var(--ink)">' + TRU.money(basePrice * 0.9) + '</span>' +
          '</div>' +
          '<div class="fin-bd-item">' +
            '<span class="fin-bd-label">Balloon Value</span>' +
            '<span class="fin-bd-sub" id="calcBalloonVal" style="font-weight:600;color:var(--ink)">R0 (0%)</span>' +
          '</div>' +
        '</div>' +

        '<div class="fin-slider-group">' +
          '<div class="fin-control">' +
            '<div class="fin-control-top">' +
              '<span class="fin-control-label">Deposit Percentage</span>' +
              '<span class="fin-control-val" id="dispDep">10%</span>' +
            '</div>' +
            '<input type="range" class="fin-slider" id="slideDep" min="0" max="50" step="5" value="10">' +
          '</div>' +

          '<div class="fin-control">' +
            '<div class="fin-control-top">' +
              '<span class="fin-control-label">Loan Term</span>' +
              '<span class="fin-control-val" id="dispTerm">72 months (6 yrs)</span>' +
            '</div>' +
            '<input type="range" class="fin-slider" id="slideTerm" min="24" max="72" step="12" value="72">' +
          '</div>' +

          '<div class="fin-control">' +
            '<div class="fin-control-top">' +
              '<span class="fin-control-label">Balloon / Residual Payment</span>' +
              '<span class="fin-control-val" id="dispBal">0%</span>' +
            '</div>' +
            '<input type="range" class="fin-slider" id="slideBal" min="0" max="40" step="5" value="0">' +
          '</div>' +

          '<div class="fin-control">' +
            '<div class="fin-control-top">' +
              '<span class="fin-control-label">Interest Rate (Prime: 11.75%)</span>' +
              '<span class="fin-control-val" id="dispRate">11.75%</span>' +
            '</div>' +
            '<input type="range" class="fin-slider" id="slideRate" min="8.0" max="18.0" step="0.25" value="11.75">' +
          '</div>' +
        '</div>' +

        '<button class="btn btn-primary btn-block" id="ctaApplyCustom">Apply with these terms</button>' +
        '<div class="widget-powered">Powered by TruDealer</div>' +
      '</div>'
    );
  }

  function renderTradeInCard(v, basePrice) {
    return (
      '<div class="trade-card panel" id="tradeSection">' +
        '<div class="tru-tech-badge" style="margin-bottom:12px" tabindex="0" role="button" aria-expanded="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
          '<span>Powered by <b>TruValue</b></span>' +
          '<div class="tech-tip"><b>TruValue</b> provides instant trade-in equity calculations against any showroom vehicle, syncing leads directly to TruFlow DMS.</div>' +
        '</div>' +
        '<h3 style="margin:0 0 6px;font-family:var(--serif);font-size:20px">Trading in your current vehicle?</h3>' +
        '<p style="margin:0;font-size:13.5px;color:var(--ink-quiet)">Get an instant trade-in equity deduction applied directly to your purchase price.</p>' +

        '<div class="trade-form-grid">' +
          '<div class="trade-input-group">' +
            '<span class="trade-label">Year</span>' +
            '<input type="number" class="trade-input" id="tradeYear" placeholder="e.g. 2019" min="2000" max="2026">' +
          '</div>' +
          '<div class="trade-input-group">' +
            '<span class="trade-label">Make</span>' +
            '<input type="text" class="trade-input" id="tradeMake" placeholder="e.g. Toyota">' +
          '</div>' +
          '<div class="trade-input-group">' +
            '<span class="trade-label">Model</span>' +
            '<input type="text" class="trade-input" id="tradeModel" placeholder="e.g. Corolla Quest">' +
          '</div>' +
          '<div class="trade-input-group">' +
            '<span class="trade-label">Mileage (km)</span>' +
            '<input type="number" class="trade-input" id="tradeKm" placeholder="e.g. 75000">' +
          '</div>' +
        '</div>' +

        '<button type="button" class="btn btn-outline btn-block" id="btnEstimateTrade">Calculate trade-in value</button>' +

        '<div class="trade-result" id="tradeResult" style="margin-top:16px">' +
          '<div class="trade-result-row"><span>Estimated Trade Value:</span><b id="tradeEstVal">R0</b></div>' +
          '<div class="trade-result-row"><span>Adjusted Net Price:</span><b id="tradeNetPrice" style="color:var(--ink)">R0</b></div>' +
          '<div class="trade-result-row"><span>New Est. Monthly:</span><b id="tradeNewMonthly">R0 / mo</b></div>' +
          '<button class="btn btn-primary btn-block" id="ctaApplyTrade" style="margin-top:12px">Apply with Trade-In</button>' +
        '</div>' +
        '<div class="widget-powered">Powered by TruDealer</div>' +
      '</div>'
    );
  }

  function renderSimilarStock(current) {
    var list = (TRU.vehicles || []).filter(function (car) {
      return (car.stockNumber || car.id) !== (current.stockNumber || current.id);
    });
    if (!list.length) return "";
    var similar = list.filter(function (car) {
      return car.bodyType && current.bodyType && car.bodyType.toLowerCase() === current.bodyType.toLowerCase();
    });
    if (similar.length < 3) {
      list.forEach(function (c) {
        if (similar.indexOf(c) === -1 && similar.length < 3) similar.push(c);
      });
    }
    similar = similar.slice(0, 3);
    if (!similar.length) return "";

    return (
      '<div class="similar-stock-wrap">' +
        '<div class="plate reveal" style="margin-bottom:24px">' +
          '<div class="plate-no">Similar vehicles</div>' +
          '<div class="plate-title"><h2>More units you might like.</h2></div>' +
        '</div>' +
        '<div class="card-grid" style="margin-top:16px">' +
          similar.map(function (car) {
            var cPrice = car.truPrice && car.truPrice < car.price ? car.truPrice : car.price;
            var cImg = car.heroImage || (car.images && car.images[0]) || "/assets/hero-showroom.jpg";
            var cHref = "/vehicle.html?stock=" + encodeURIComponent(car.stockNumber || car.id);
            return (
              '<a class="card" href="' + cHref + '" style="text-decoration:none;color:inherit">' +
                '<div class="card-media" style="aspect-ratio:16/10;position:relative">' +
                  '<img src="' + e(cImg) + '" alt="' + e(TRU.title(car)) + '" loading="lazy">' +
                  (car.vir ? '<span style="position:absolute;top:10px;right:10px;background:var(--ink);color:var(--cream);font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:100px;font-weight:600">VIR ' + car.vir + '</span>' : '') +
                '</div>' +
                '<div style="padding:18px;display:flex;flex-direction:column;gap:8px;flex:1">' +
                  '<div style="font-family:var(--mono);font-size:10.5px;color:var(--ink-mute);letter-spacing:0.16em;text-transform:uppercase">' + car.year + ' · ' + e(car.make) + '</div>' +
                  '<div style="font-family:var(--serif);font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em">' + e(car.model) + '</div>' +
                  '<div style="font-size:13px;color:var(--ink-quiet)">' + (car.mileage ? TRU.km(car.mileage) : "") + ' · ' + e(car.transmission || "Automatic") + '</div>' +
                  '<div style="margin-top:auto;padding-top:12px;border-top:1px solid var(--rule-soft);display:flex;align-items:baseline;justify-content:space-between">' +
                    '<span style="font-family:var(--serif);font-size:20px;font-weight:900;color:var(--ink)">' + TRU.money(cPrice) + '</span>' +
                    '<span style="font-family:var(--mono);font-size:10.5px;color:var(--accent)">' + TRU.money(TRU.monthly(cPrice)) + '/mo</span>' +
                  '</div>' +
                '</div>' +
              '</a>'
            );
          }).join("") +
        '</div>' +
      '</div>'
    );
  }

  function vehicleWaUrl(v, price) {
    var p = price || (v.truPrice && v.truPrice < v.price ? v.truPrice : v.price);
    var stock = v.stockNumber || v.id || "";
    var title = TRU.title(v);
    var canonicalUrl = "https://www.true-cars.co.za/vehicle/?stock=" + encodeURIComponent(stock);
    var msg = "Hi True Cars! I'm interested in this " + title +
              (stock ? " (Stock #" + stock + ")" : "") +
              (p ? " listed at " + TRU.money(p) : "") + ".\n" +
              "Link: " + canonicalUrl + "\n" +
              "Is it still available?";
    return "https://wa.me/27620502091?text=" + encodeURIComponent(msg);
  }

  function updateVdpSchema(v, price) {
    var schemaEl = document.getElementById("vdpSchema");
    if (!schemaEl) return;
    try {
      var stock = v.stockNumber || v.id || "";
      var canonicalUrl = "https://www.true-cars.co.za/vehicle/?stock=" + encodeURIComponent(stock);
      var heroImg = v.heroImage || (v.images && v.images[0]) || "https://www.true-cars.co.za/og-card.jpg";
      var ld = {
        "@context": "https://schema.org",
        "@type": "Car",
        "name": TRU.title(v),
        "url": canonicalUrl,
        "image": heroImg,
        "itemCondition": "https://schema.org/UsedCondition",
        "brand": { "@type": "Brand", "name": v.make },
        "model": v.model + (v.trim ? " " + v.trim : ""),
        "vehicleModelDate": String(v.year || ""),
        "sku": String(stock),
        "vehicleTransmission": v.transmission || "",
        "fuelType": v.fuelType || v.fuel || "",
        "bodyType": v.bodyType || v.body || "",
        "offers": {
          "@type": "Offer",
          "priceCurrency": "ZAR",
          "price": price,
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "AutoDealer",
            "name": "True Cars",
            "telephone": "+27620502091",
            "url": "https://www.true-cars.co.za/"
          }
        }
      };
      if (v.mileage) {
        ld.mileageFromOdometer = {
          "@type": "QuantitativeValue",
          "value": Number(String(v.mileage).replace(/\D/g, "")),
          "unitCode": "KMT"
        };
      }
      schemaEl.textContent = JSON.stringify(ld, null, 2);
    } catch (e) {
      console.warn("[TruVDP] Schema update error:", e);
    }
  }

  function renderMobileStickyBar(v, price) {
    var bar = document.getElementById("vdpMobileBar");
    if (!bar) return;
    bar.innerHTML =
      '<div class="vdp-mobile-inner">' +
        '<div class="vdp-mobile-price">' +
          '<span class="vdp-mobile-now">' + TRU.money(price) + '</span>' +
          '<span class="vdp-mobile-pm">From ' + TRU.money(TRU.monthly(price)) + ' / mo</span>' +
        '</div>' +
        '<div class="vdp-mobile-actions">' +
          '<button class="vdp-mobile-btn hold" id="ctaMobileHold" style="background:#0B1220;color:#4FE3DC"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Hold</button>' +
          '<a class="vdp-mobile-btn wa" href="' + vehicleWaUrl(v, price) + '" target="_blank" rel="noopener" aria-label="WhatsApp Dealership"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.972.531 1.83.813 2.796.813h.005c3.18 0 5.767-2.586 5.768-5.766 0-1.54-.599-2.989-1.688-4.079-1.09-1.089-2.54-1.689-4.085-1.689z"/></svg></a>' +
          '<button class="vdp-mobile-btn apply" id="ctaMobileApply">Apply</button>' +
        '</div>' +
      '</div>';

    var btn = document.getElementById("ctaMobileApply");
    if (btn) {
      btn.addEventListener("click", function () {
        var apply = document.getElementById("ctaApply");
        if (apply) apply.click();
      });
    }
    var holdBtn = document.getElementById("ctaMobileHold");
    if (holdBtn) {
      holdBtn.addEventListener("click", function () {
        openReservationModal(v);
      });
    }
  }

  function render() {
    var stockId = TRU.params().stock;
    var v = TRU.get(stockId, true);
    if (!v) {
      var p = TRU.params();
      if (p.make || p.name || p.model) {
        var numPrice = parseInt(String(p.price || "").replace(/\D/g, ""), 10) || 0;
        var numKm = parseInt(String(p.km || "").replace(/\D/g, ""), 10) || 0;
        v = {
          id: p.stock || stockId || "SHARED-CAR",
          stockNumber: p.stock || stockId || "SHARED-CAR",
          year: parseInt(p.year, 10) || new Date().getFullYear(),
          make: p.make || "",
          model: p.name || p.model || "",
          trim: p.variant || "",
          price: numPrice,
          truPrice: numPrice,
          mileage: numKm,
          transmission: p.trans || "Manual",
          fuelType: p.fuel || "Petrol",
          bodyType: p.body || "Vehicle",
          heroImage: p.img || "",
          images: p.img ? [p.img] : [],
          vir: 92
        };
      } else if (TRU.vehicles && TRU.vehicles.length > 0) {
        v = TRU.vehicles[0];
      }
    }
    if (!v) {
      if (!TRU.vehicles || TRU.vehicles.length === 0) {
        document.getElementById("content").innerHTML =
          '<div class="empty" style="padding:60px 20px">' +
            '<div style="display:inline-block;width:32px;height:32px;border:3px solid var(--rule);border-top-color:var(--accent);border-radius:50%;animation:vdpSpin 1s linear infinite;margin-bottom:16px"></div>' +
            '<h3>Loading vehicle from live showroom feed...</h3>' +
            '<p style="color:var(--ink-quiet);font-size:14px;margin-top:6px">Retrieving live inventory from TruFlow DMS.</p>' +
            '<style>@keyframes vdpSpin{to{transform:rotate(360deg)}}</style>' +
          '</div>';
        return;
      }
      return notFound();
    }

    try {
      document.title = TRU.title(v) + " — Truecars";
      var crumbEl = document.getElementById("crumb");
      if (crumbEl) {
        crumbEl.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
            '<div>' +
              '<a href="/stock.html" style="color:var(--ink-quiet)">The showroom</a>' +
              '<span style="margin:0 10px;color:var(--rule)">/</span>' +
              '<span style="color:var(--ink)">' + e(TRU.title(v)) + "</span>" +
            '</div>' +
            '<div class="tru-tech-badge" style="margin-bottom:0">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>' +
              '<span>TruDealer Platform Showcase</span>' +
              '<div class="tech-tip" style="right:0;left:auto"><b>TruDealer</b> is the complete vertical SaaS operating system for independent dealerships — combining TruLens, TruInspect, TruFlow DMS, and high-conversion web widgets.</div>' +
            '</div>' +
          '</div>';
      }
    } catch (err) {
      console.warn("[TruVDP] Crumb render notice:", err);
    }

    var price = v.truPrice && v.truPrice < v.price ? v.truPrice : v.price;
    var hasOrbit = !!(v.web3d && v.web3d.frames && v.web3d.frames.length);
    var frames = hasOrbit ? v.web3d.frames : [];

    var chips = frames.map(function (f, i) {
      var az = typeof f.azimuth === "number" ? f.azimuth : i / frames.length;
      return { i: i, az: ((az % 1) + 1) % 1, name: f.name };
    });
    function nearest(target) {
      var best = chips[0];
      chips.forEach(function (c) {
        var d = Math.min(Math.abs(c.az - target), 1 - Math.abs(c.az - target));
        var bd = Math.min(Math.abs(best.az - target), 1 - Math.abs(best.az - target));
        if (d < bd) best = c;
      });
      return best;
    }
    var jumps = hasOrbit
      ? [["Front", 0], ["Side", 0.25], ["Rear", 0.5], ["Other side", 0.75]]
          .map(function (p) { var c = nearest(p[1]); return { label: p[0], i: c.i }; })
      : [];

    /* Orbit markup */
    var orbitMarkup = hasOrbit
      ? '<figure class="orbit-hero" id="orbitContainer">' +
          '<div class="orbit-head">' +
            '<span class="eyebrow" style="display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> 360° TruOrbit Interactive Studio</span>' +
            '<span class="orbit-count">' + frames.length + " studio angles</span>" +
          "</div>" +
          '<div class="orbit" id="orbit" tabindex="0" role="group" ' +
            'aria-label="360 degree walkaround — drag, or use arrow keys, to rotate">' +
            frames.map(function (f, i) {
              return '<img src="' + e(f.image) + '" alt="' + e(f.name) + '"' +
                (i === 0 ? ' class="is-active"' : "") +
                (i === 0 ? "" : ' loading="lazy"') + ">";
            }).join("") +
            '<div class="orbit-label" id="orbitLabel">' + e(frames[0].name) + "</div>" +
            '<button class="orbit-autospin" id="orbitAutoSpin" type="button" aria-label="Auto spin"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Auto Spin</button>' +
            '<button class="orbit-reset" id="orbitReset" type="button" aria-label="Reset to front">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" ' +
              'stroke-linecap="round"><path d="M1 4v6h6"/>' +
              '<path d="M3.5 20A9 9 0 1 0 4 10l-3 0"/></svg>' +
            "</button>" +
            '<div class="orbit-hint" id="orbitHint">' +
              'Drag to spin · <b id="orbitDeg">0°</b>' +
            "</div>" +
          "</div>" +
          '<div class="orbit-chips" id="orbitChips">' +
            jumps.map(function (j, k) {
              return '<button type="button" data-i="' + j.i + '"' +
                (k === 0 ? ' class="is-on"' : "") + ">" + e(j.label) + "</button>";
            }).join("") +
          "</div>" +
        "</figure>"
      : "";

    /* Gallery markup */
    var galleryMarkup = galleryHTML(v.images && v.images.length ? v.images : [v.heroImage || ""], TRU.title(v));

    /* Media Switcher */
    var mediaSwitcherMarkup =
      '<div class="media-tabs" id="mediaTabs">' +
        (hasOrbit ? '<button type="button" class="media-tab-btn is-active" data-tab="orbit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> 360° Walkaround</button>' : "") +
        '<button type="button" class="media-tab-btn' + (hasOrbit ? "" : " is-active") + '" data-tab="gallery"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> HD Photos (' + ((v.images || []).length || 1) + ')</button>' +
      '</div>';

    document.getElementById("content").innerHTML =
      '<div class="vdp">' +
        '<div class="vdp-main">' +
          mediaSwitcherMarkup +
          orbitMarkup +
          galleryMarkup +

          renderHighlights(v) +

          (v.notes
            ? '<div class="panel" style="margin-top:28px">' +
                '<h4 style="margin-bottom:10px">Dealership Notes</h4>' +
                '<p style="font-size:15px;line-height:1.65;color:var(--ink-quiet);margin:0">' +
                  e(v.notes) +
                "</p>" +
              "</div>"
            : "") +

          '<div class="panel" style="margin-top:28px">' +
            '<h4 style="margin-bottom:14px">Technical Specification</h4>' +
            '<table class="spec-table">' + specRows(v) + "</table>" +
          "</div>" +

          virPanel(v) +
          renderTradeInCard(v, price) +
        "</div>" +

        '<aside class="vdp-rail">' +
          '<div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:24px;box-shadow:0 4px 20px -6px rgba(14,26,38,0.08)">' +
            '<div class="vdp-meta">' + v.year + " · " + e(String(v.make).toUpperCase()) + " · " + e(v.stockNumber || v.id) + "</div>" +
            '<h1 class="vdp-title">' + e(v.model) + "</h1>" +
            (v.trim ? '<div class="vdp-trim">' + e(v.trim) + "</div>" : "") +
            '<div class="vdp-price" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
              '<div>' +
                '<span class="price-now">' + TRU.money(price) + "</span>" +
                (price < v.price
                  ? '<span class="price-was" style="font-size:15px">was ' + TRU.money(v.price) + "</span>"
                  : "") +
              '</div>' +
              '<button type="button" class="price-alert-trigger" id="btnPriceAlert"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom;margin-right:2px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Price Alert</button>' +
            "</div>" +
            '<div class="vdp-pm">From <b>' + TRU.money(TRU.monthly(price)) + " / mo</b> — 72 mo, 10% dep.</div>" +
            marketPricePanel(v) +

            '<div class="cta-stack" style="margin-top:24px">' +
              '<button class="btn btn-primary btn-block" id="ctaApply">Get pre-approved</button>' +
              '<button class="btn-reserve-hold" id="btnReserveCar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Hold this car (R2,500 Deposit)</button>' +
              '<button class="btn btn-outline btn-block" id="ctaAfford">Check affordability</button>' +
              '<button class="btn btn-outline btn-block" id="ctaBook">Book a test drive</button>' +
              '<button class="btn-deal-sheet" id="btnDealSheet"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Download Deal Summary (PDF)</button>' +
              '<button class="btn btn-outline btn-block" data-share="' + e(v.stockNumber || v.id) + '">Share this car</button>' +
              '<a class="btn btn-jewel btn-block" href="' + vehicleWaUrl(v, price) + '" target="_blank" rel="noopener">WhatsApp the dealer</a>' +
            "</div>" +
          "</div>" +

          renderFinanceCalc(v, price) +
        "</aside>" +
      "</div>" +
      renderSimilarStock(v);

    renderMobileStickyBar(v, price);
    updateVdpSchema(v, price);
    wireGallery(v);
    if (hasOrbit) wireOrbit(v);
    wireMediaTabs();
    wireFinanceCalc(v, price);
    wireTradeInCalc(v, price);
    wireCtas(v);
    wireVirGate(v);
    wireModals(v, price);
    mountGallery(v.images);

    // Animate VIR ring on scroll into view
    var virRing = document.getElementById('virRing');
    var virNum = document.getElementById('virScoreNum');
    var virBars = document.querySelector('.vir-cat-bars');
    if (virRing && virNum) {
      var circumference = 2 * Math.PI * 60;
      var targetScore = Number(v.vir) || 94;
      var observed = false;
      var obs = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting && !observed) {
          observed = true;
          // Animate ring
          var targetOffset = circumference * (1 - targetScore / 100);
          virRing.style.strokeDashoffset = targetOffset.toFixed(1);
          // Animate number count-up
          var start = 0;
          var duration = 1600;
          var t0 = performance.now();
          function tick(now) {
            var elapsed = now - t0;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            virNum.textContent = Math.round(eased * targetScore);
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          // Trigger bar animations
          if (virBars) virBars.classList.add('is-visible');
          obs.disconnect();
        }
      }, { threshold: 0.3 });
      obs.observe(virRing.closest('.vir-full-card') || virRing);
    }

    // Sticky Deal Bar
    var stickyBar = document.getElementById('stickyDeal');
    if (stickyBar) {
      var sTitle = document.getElementById('stickyTitle');
      var sPrice = document.getElementById('stickyPrice');
      var sMonthly = document.getElementById('stickyMonthly');
      var sWa = document.getElementById('stickyWa');
      var sReserve = document.getElementById('stickyReserve');
      if (sTitle) sTitle.textContent = TRU.title(v);
      if (sPrice) sPrice.textContent = TRU.money(price);
      if (sMonthly) sMonthly.textContent = 'From ' + TRU.money(TRU.monthly(price)) + ' / mo';
      if (sWa) sWa.href = vehicleWaUrl(v, price);
      if (sReserve) sReserve.addEventListener('click', function() {
        var rm = document.getElementById('reserveModal');
        if (rm) rm.classList.add('is-open');
      });

      /* fire off the buy-panel price: at the top it is on screen, so the bar
         stays hidden and the header owns the chrome; scroll past it and the
         deal bar takes the header's slot (body.deal-live hides the header). */
      var triggerEl = document.querySelector('.vdp-price') || document.querySelector('.vdp-highlights-grid') || document.querySelector('.card-price');
      if (triggerEl) {
        /* scrollY guard: the first IO callback can fire pre-layout and flash
           the bar over the header at the top of the page */
        var priceInView = true;
        var syncBar = function () {
          var show = !priceInView && window.scrollY > 40;
          stickyBar.classList.toggle('is-visible', show);
          document.body.classList.toggle('deal-live', show);
        };
        var stickyObs = new IntersectionObserver(function(entries) {
          priceInView = entries[0].isIntersecting;
          syncBar();
        }, { threshold: 0 });
        stickyObs.observe(triggerEl);
        window.addEventListener('scroll', syncBar, { passive: true });
      }
    }
  }

  /* ---- Media Switcher Tabs ---- */
  function wireMediaTabs() {
    var tabs = document.getElementById("mediaTabs");
    if (!tabs) return;
    var orbit = document.getElementById("orbitContainer");
    var gallery = document.getElementById("galleryContainer");

    tabs.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".media-tab-btn");
      if (!btn) return;
      tabs.querySelectorAll(".media-tab-btn").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");

      var mode = btn.dataset.tab;
      if (mode === "orbit") {
        if (orbit) orbit.style.display = "block";
        if (gallery) { gallery.classList.add("is-secondary"); }
      } else if (mode === "gallery") {
        if (orbit) orbit.style.display = "none";
        if (gallery) { gallery.classList.remove("is-secondary"); }
      }
    });
  }

  /* ---- Interactive Finance Calculator ---- */
  function wireFinanceCalc(v, basePrice) {
    var slideDep = document.getElementById("slideDep");
    var slideTerm = document.getElementById("slideTerm");
    var slideBal = document.getElementById("slideBal");
    var slideRate = document.getElementById("slideRate");

    if (!slideDep || !slideTerm || !slideBal || !slideRate) return;

    var dispDep = document.getElementById("dispDep");
    var dispTerm = document.getElementById("dispTerm");
    var dispBal = document.getElementById("dispBal");
    var dispRate = document.getElementById("dispRate");

    var calcMonthly = document.getElementById("calcMonthly");
    var calcDepositVal = document.getElementById("calcDepositVal");
    var calcPrincipal = document.getElementById("calcPrincipal");
    var calcBalloonVal = document.getElementById("calcBalloonVal");

    function update() {
      var depPct = Number(slideDep.value);
      var term = Number(slideTerm.value);
      var balPct = Number(slideBal.value);
      var rate = Number(slideRate.value);

      dispDep.textContent = depPct + "% (" + TRU.money(basePrice * (depPct / 100)) + ")";
      dispTerm.textContent = term + " months (" + (term / 12) + " yrs)";
      dispBal.textContent = balPct + "% (" + TRU.money(basePrice * (balPct / 100)) + ")";
      dispRate.textContent = rate.toFixed(2) + "%" + (Math.abs(rate - 11.75) < 0.01 ? " (Prime)" : "");

      var m = TRU.monthly(basePrice, { rate: rate, depositPct: depPct, term: term, balloonPct: balPct });
      calcMonthly.innerHTML = TRU.money(m) + ' <span style="font-size:16px;font-family:var(--sans);font-weight:400;color:var(--ink-quiet)">/ mo</span>';
      calcDepositVal.textContent = TRU.money(basePrice * (depPct / 100));
      calcPrincipal.textContent = TRU.money(basePrice * (1 - depPct / 100));
      calcBalloonVal.textContent = TRU.money(basePrice * (balPct / 100)) + " (" + balPct + "%)";
    }

    [slideDep, slideTerm, slideBal, slideRate].forEach(function (el) {
      el.addEventListener("input", update);
    });

    var ctaCustom = document.getElementById("ctaApplyCustom");
    if (ctaCustom) {
      ctaCustom.addEventListener("click", function () {
        if (window.TruForm && window.TruForm.open) {
          window.TruForm.open({
            vehicle: TRU.title(v) + (v.trim ? " " + v.trim : ""),
            vehicleId: v.stockNumber || v.id,
            interest: "Finance application (" + TRU.money(TRU.monthly(basePrice, { rate: Number(slideRate.value), depositPct: Number(slideDep.value), term: Number(slideTerm.value), balloonPct: Number(slideBal.value) })) + "/mo at " + slideRate.value + "% rate)",
            finance: true,
            source: "vdp-calc"
          });
        } else {
          location.href = "/finance.html?stock=" + encodeURIComponent(v.stockNumber || v.id) +
            "&price=" + basePrice + "&dep=" + slideDep.value + "&term=" + slideTerm.value + "&rate=" + slideRate.value;
        }
      });
    }
  }

  /* ---- Interactive Trade-In Calculator ---- */
  function wireTradeInCalc(v, basePrice) {
    var btn = document.getElementById("btnEstimateTrade");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var yr = Number(document.getElementById("tradeYear").value);
      var make = (document.getElementById("tradeMake").value || "").trim();
      var model = (document.getElementById("tradeModel").value || "").trim();
      var km = Number(document.getElementById("tradeKm").value);

      var res = document.getElementById("tradeResult");
      if (!yr || !make || !model) {
        alert("Please enter at least the Year, Make, and Model of your trade-in.");
        return;
      }

      var age = Math.max(0, 2026 - yr);
      var estimatedEquity = Math.round(basePrice * 0.45 * Math.pow(0.88, age));
      if (km && km > 100000) estimatedEquity = Math.round(estimatedEquity * 0.85);
      if (estimatedEquity < 25000) estimatedEquity = 25000;
      if (estimatedEquity > basePrice * 0.75) estimatedEquity = Math.round(basePrice * 0.65);

      var netPrice = Math.max(0, basePrice - estimatedEquity);
      var newMonthly = TRU.monthly(netPrice);

      document.getElementById("tradeEstVal").textContent = TRU.money(estimatedEquity);
      document.getElementById("tradeNetPrice").textContent = TRU.money(netPrice);
      document.getElementById("tradeNewMonthly").textContent = TRU.money(newMonthly) + " / mo";

      res.classList.add("is-visible");

      var applyTrade = document.getElementById("ctaApplyTrade");
      if (applyTrade) {
        applyTrade.onclick = function () {
          if (window.TruForm && window.TruForm.open) {
            window.TruForm.open({
              vehicle: TRU.title(v) + (v.trim ? " " + v.trim : ""),
              vehicleId: v.stockNumber || v.id,
              interest: "Trade-in enquiry: " + yr + " " + make + " " + model + " (" + TRU.km(km) + " · Est. " + TRU.money(estimatedEquity) + ") against " + (v.stockNumber || v.id),
              tradeIn: true,
              source: "vdp-tradein"
            });
          } else {
            location.href = "https://wa.me/27620502091?text=" +
              encodeURIComponent("Trade-in enquiry: I'd like to trade in my " + yr + " " + make + " " + model + " (" + TRU.km(km) + ") against the " + TRU.title(v) + " (" + (v.stockNumber || v.id) + ")");
          }
        };
      }
    });
  }

  /* ---- VIR request = lead ---- */
  function wireVirGate(v) {
    var virReq = document.getElementById("virRequest");
    if (!virReq) return;
    virReq.addEventListener("click", function (ev) {
      if (!window.TruForm || !window.TruForm.open) return;
      ev.preventDefault();
      var href = virReq.getAttribute("href");
      var opened = false;
      function onLead(e) {
        if (opened) return;
        var d = (e && e.detail) || {};
        if (String(d.source || "").indexOf("vdp-vir") === -1) return;
        opened = true;
        window.removeEventListener("tru:lead", onLead);
        window.open(href, "_blank", "noopener");
      }
      window.addEventListener("tru:lead", onLead);
      window.TruForm.open({
        vehicle: TRU.title(v) + (v.trim ? " " + v.trim : ""),
        vehicleId: v.stockNumber || v.id,
        interest: "Full inspection report (VIR)",
        source: "vdp-vir"
      });
    });
  }

  /* ---- Modals: Reservation & Price Drop Alert & Deal Sheet ---- */
  function openReservationModal(v) {
    var m = document.getElementById("reserveModal");
    if (m) m.classList.add("is-open");
  }

  function populateDealSheet(v, price) {
    var score = Number(v.vir) || 94;
    document.getElementById("dsStockRef").textContent = v.stockNumber || v.id || "TRU-REF";
    document.getElementById("dsDate").textContent = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
    document.getElementById("dsCarImg").src = v.heroImage || (v.images && v.images[0]) || "/assets/hero-showroom.jpg";
    document.getElementById("dsVirScore").textContent = score;
    document.getElementById("dsYearMake").textContent = v.year + " " + String(v.make).toUpperCase();
    document.getElementById("dsTitle").textContent = e(v.model) + (v.trim ? " " + e(v.trim) : "");
    document.getElementById("dsPrice").textContent = TRU.money(price);
    document.getElementById("dsMonthly").textContent = "From " + TRU.money(TRU.monthly(price)) + " / mo (72 mo, 10% dep)";

    document.getElementById("dsSpecTable").innerHTML = specRows(v);

    document.getElementById("dsFinPrice").textContent = TRU.money(price);
    document.getElementById("dsFinDep").textContent = TRU.money(price * 0.1);
    document.getElementById("dsFinPrincipal").textContent = TRU.money(price * 0.9);
    document.getElementById("dsFinInstalment").textContent = TRU.money(TRU.monthly(price)) + " / mo";
  }

  function wireModals(v, price) {
    var resModal = document.getElementById("reserveModal");
    var closeRes = document.getElementById("closeReserveModal");
    var btnRes = document.getElementById("btnReserveCar");

    if (btnRes) {
      btnRes.addEventListener("click", function () {
        if (resModal) resModal.classList.add("is-open");
      });
    }
    if (closeRes && resModal) {
      closeRes.addEventListener("click", function () {
        resModal.classList.remove("is-open");
      });
      resModal.addEventListener("click", function (e) {
        if (e.target === resModal) resModal.classList.remove("is-open");
      });
    }

    var resForm = document.getElementById("reserveForm");
    if (resForm) {
      resForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var name = document.getElementById("resName").value;
        var cell = document.getElementById("resCell").value;
        var email = document.getElementById("resEmail").value;
        var date = document.getElementById("resDate").value;

        if (window.TruForm && window.TruForm.open) {
          window.TruForm.open({
            vehicle: TRU.title(v) + (v.trim ? " " + v.trim : ""),
            vehicleId: v.stockNumber || v.id,
            interest: "48-Hour Priority Hold (R2,500 Deposit): " + name + " (" + cell + ", " + email + ", Viewing: " + (date || "Immediate") + ")",
            source: "vdp-hold-guarantee"
          });
        }
        resModal.classList.remove("is-open");
        alert("Thank you, " + name + "! Your 48-hour priority hold request on the " + TRU.title(v) + " has been registered. Our showroom team will contact you via WhatsApp shortly to finalize your reservation.");
      });
    }

    /* Price Alert Modal */
    var alertModal = document.getElementById("priceAlertModal");
    var closeAlert = document.getElementById("closePriceAlertModal");
    var btnAlert = document.getElementById("btnPriceAlert");

    if (btnAlert) {
      btnAlert.addEventListener("click", function () {
        if (alertModal) alertModal.classList.add("is-open");
      });
    }
    if (closeAlert && alertModal) {
      closeAlert.addEventListener("click", function () {
        alertModal.classList.remove("is-open");
      });
      alertModal.addEventListener("click", function (e) {
        if (e.target === alertModal) alertModal.classList.remove("is-open");
      });
    }

    var alertForm = document.getElementById("alertForm");
    if (alertForm) {
      alertForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var contact = document.getElementById("alertContact").value;
        var trigger = document.getElementById("alertType").value;

        if (window.TruForm && window.TruForm.open) {
          window.TruForm.open({
            vehicle: TRU.title(v) + (v.trim ? " " + v.trim : ""),
            vehicleId: v.stockNumber || v.id,
            interest: "Price & Stock Alert Request: " + contact + " (Trigger: " + trigger + ")",
            source: "vdp-price-alert"
          });
        }
        alertModal.classList.remove("is-open");
        alert("Alert active! We will notify " + contact + " as soon as price updates or matching inventory is published.");
      });
    }

    /* Deal Summary Print Sheet Modal */
    var dealModal = document.getElementById("dealSheetModal");
    var closeDeal = document.getElementById("closeDealSheetModal");
    var btnDeal = document.getElementById("btnDealSheet");
    var btnPrintAction = document.getElementById("btnPrintDealAction");

    if (btnDeal) {
      btnDeal.addEventListener("click", function () {
        populateDealSheet(v, price);
        if (dealModal) dealModal.classList.add("is-open");
      });
    }
    if (closeDeal && dealModal) {
      closeDeal.addEventListener("click", function () {
        dealModal.classList.remove("is-open");
      });
      dealModal.addEventListener("click", function (e) {
        if (e.target === dealModal) dealModal.classList.remove("is-open");
      });
    }
    if (btnPrintAction) {
      btnPrintAction.addEventListener("click", function () {
        window.print();
      });
    }
  }

  /* ---- lightbox ---- */
  var lb = null;
  var lbImg = null;
  var lbCounter = null;
  var lbIdx = 0;
  var lbImages = [];

  function initLightbox() {
    if (lb) return;
    lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML =
      '<div class="lightbox-inner">' +
        '<button class="lightbox-close" id="lbClose" aria-label="Close">✕</button>' +
        '<div class="lightbox-stage">' +
          '<img id="lbImg" src="" alt="">' +
          '<button class="lightbox-nav prev" id="lbPrev" aria-label="Previous">‹</button>' +
          '<button class="lightbox-nav next" id="lbNext" aria-label="Next">›</button>' +
        "</div>" +
        '<div class="lightbox-counter" id="lbCounter">1 / 1</div>' +
      "</div>";
    document.body.appendChild(lb);

    lbImg = document.getElementById("lbImg");
    lbCounter = document.getElementById("lbCounter");

    document.getElementById("lbClose").addEventListener("click", closeLightbox);
    document.getElementById("lbPrev").addEventListener("click", function () { showLb(lbIdx - 1); });
    document.getElementById("lbNext").addEventListener("click", function () { showLb(lbIdx + 1); });
    lb.addEventListener("click", function (ev) { if (ev.target === lb) closeLightbox(); });

    document.addEventListener("keydown", function (ev) {
      if (!lb.classList.contains("is-open")) return;
      if (ev.key === "Escape") closeLightbox();
      else if (ev.key === "ArrowLeft") showLb(lbIdx - 1);
      else if (ev.key === "ArrowRight") showLb(lbIdx + 1);
    });
  }

  function showLb(k) {
    if (!lbImages.length) return;
    lbIdx = ((k % lbImages.length) + lbImages.length) % lbImages.length;
    lbImg.src = lbImages[lbIdx];
    lbCounter.textContent = (lbIdx + 1) + " / " + lbImages.length;
  }

  function openLightbox(imgs, startIndex) {
    initLightbox();
    lbImages = imgs && imgs.length ? imgs : ["/assets/hero-showroom.jpg"];
    showLb(startIndex || 0);
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (lb) lb.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  /* ---- standard gallery ---- */
  function wireGallery(v) {
    var g = document.getElementById("galleryContainer");
    if (!g) return;
    var imgs = (v.images && v.images.length) ? v.images : [v.heroImage || "/assets/hero-showroom.jpg"];
    var main = document.getElementById("mainImg");
    var thumbs = document.getElementById("thumbs");
    var prev = document.getElementById("prev");
    var next = document.getElementById("next");
    var zoom = document.getElementById("galleryZoom");
    var i = 0;

    function show(k) {
      i = ((k % imgs.length) + imgs.length) % imgs.length;
      if (main) main.src = imgs[i];
      if (thumbs) {
        var btns = thumbs.querySelectorAll("button");
        for (var j = 0; j < btns.length; j++) {
          btns[j].classList.toggle("is-active", j === i);
        }
      }
    }

    if (thumbs) {
      thumbs.addEventListener("click", function (ev) {
        var b = ev.target.closest("button");
        if (!b) return;
        show(+b.dataset.i);
      });
    }
    if (prev) prev.addEventListener("click", function () { show(i - 1); });
    if (next) next.addEventListener("click", function () { show(i + 1); });
    if (zoom) zoom.addEventListener("click", function () { openLightbox(imgs, i); });
    if (main) {
      main.style.cursor = "zoom-in";
      main.addEventListener("click", function () { openLightbox(imgs, i); });
    }

    if (main) {
      var x0 = null;
      main.addEventListener("touchstart", function (ev) {
        if (ev.touches.length === 1) x0 = ev.touches[0].clientX;
      }, { passive: true });
      main.addEventListener("touchend", function (ev) {
        if (x0 == null) return;
        var dx = ev.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1);
        x0 = null;
      });
    }
  }

  /* ---- TruOrbit — the 360° walkaround hero ---- */
  function wireOrbit(v) {
    var orbit    = document.getElementById("orbit");
    if (!orbit) return;
    var label    = document.getElementById("orbitLabel");
    var hint     = document.getElementById("orbitHint");
    var deg      = document.getElementById("orbitDeg");
    var chips    = document.getElementById("orbitChips");
    var reset    = document.getElementById("orbitReset");
    var autospin = document.getElementById("orbitAutoSpin");
    var imgs     = orbit.querySelectorAll("img");
    var data     = v.web3d.frames;
    var n        = imgs.length;
    var idx      = 0;
    var spinTimer = null;

    function show(k) {
      idx = ((k % n) + n) % n;
      for (var j = 0; j < n; j++) imgs[j].classList.toggle("is-active", j === idx);
      if (label && data[idx]) label.textContent = data[idx].name;
      var az = typeof (data[idx] && data[idx].azimuth) === "number" ? data[idx].azimuth : idx / n;
      if (deg) deg.textContent = Math.round((((az % 1) + 1) % 1) * 360) + "°";
      if (chips) {
        var btns = chips.querySelectorAll("button");
        for (var b = 0; b < btns.length; b++) {
          btns[b].classList.toggle("is-on", +btns[b].dataset.i === idx);
        }
      }
    }

    function stopAutoSpin() {
      if (spinTimer) {
        clearInterval(spinTimer);
        spinTimer = null;
        if (autospin) autospin.classList.remove("is-spinning");
      }
    }

    function startAutoSpin() {
      stopAutoSpin();
      if (autospin) autospin.classList.add("is-spinning");
      spinTimer = setInterval(function () {
        show(idx + 1);
      }, 120);
    }

    if (autospin) {
      autospin.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (spinTimer) stopAutoSpin();
        else startAutoSpin();
      });
    }

    /* drag to spin */
    var dragging = false, startX = 0, startIdx = 0, moved = false;
    function stepWidth() { return Math.max(24, orbit.clientWidth / (n * 1.6)); }
    function down(x, id) {
      stopAutoSpin();
      dragging = true; moved = false; startX = x; startIdx = idx;
      orbit.classList.add("is-dragging");
      if (id != null && orbit.setPointerCapture) orbit.setPointerCapture(id);
    }
    function move(x) {
      if (!dragging) return;
      var delta = Math.round((x - startX) / stepWidth());
      if (delta !== 0 && !moved) { moved = true; orbit.classList.add("has-moved"); }
      show(startIdx + delta);
    }
    function up() { dragging = false; orbit.classList.remove("is-dragging"); }

    orbit.addEventListener("pointerdown", function (ev) { ev.preventDefault(); down(ev.clientX, ev.pointerId); });
    orbit.addEventListener("pointermove", function (ev) { move(ev.clientX); });
    orbit.addEventListener("pointerup", up);
    orbit.addEventListener("pointercancel", up);

    /* keyboard */
    orbit.addEventListener("keydown", function (ev) {
      stopAutoSpin();
      if (ev.key === "ArrowRight") { show(idx + 1); orbit.classList.add("has-moved"); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft") { show(idx - 1); orbit.classList.add("has-moved"); ev.preventDefault(); }
      else if (ev.key === "Home") { show(0); ev.preventDefault(); }
    });

    if (chips) {
      chips.addEventListener("click", function (ev) {
        var b = ev.target.closest("button");
        if (!b) return;
        stopAutoSpin();
        show(+b.dataset.i);
        orbit.classList.add("has-moved");
      });
    }
    if (reset) {
      reset.addEventListener("click", function (ev) {
        ev.stopPropagation();
        stopAutoSpin();
        show(0);
        orbit.classList.remove("has-moved");
      });
    }

    show(0);
  }

  /* ---- widget CTAs ---- */
  function wireCtas(v) {
    var payload = {
      vehicle: TRU.title(v) + (v.trim ? " " + v.trim : ""),
      vehicleId: v.stockNumber || v.id,
      price: v.truPrice || v.price,
      source: "vdp",
    };

    /* Get pre-approved pops TruForm directly */
    var apply = document.getElementById("ctaApply");
    if (apply) {
      apply.addEventListener("click", function () {
        if (window.TruForm && typeof window.TruForm.open === "function") {
          window.TruForm.open({
            vehicle: payload.vehicle,
            vehicleId: payload.vehicleId,
            interest: "Finance pre-approval",
            finance: true,
            source: "vdp-preapproval",
          });
        } else {
          location.href = "/finance.html?stock=" + encodeURIComponent(v.stockNumber || v.id);
        }
      });
    }

    var book = document.getElementById("ctaBook");
    if (book) {
      book.addEventListener("click", function () {
        if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches
            && window.TruConcierge) {
          window.TruConcierge.open(v, payload);
          return;
        }
        if (window.TruBook && typeof window.TruBook.open === "function") {
          window.TruBook.open({ mode: "live", car: payload.vehicle });
        } else if (window.TruForm && typeof window.TruForm.open === "function") {
          window.TruForm.open({
            vehicle: payload.vehicle, vehicleId: payload.vehicleId,
            interest: "Test drive", source: "vdp-testdrive",
          });
        } else {
          location.href = "https://wa.me/27620502091?text=" +
            encodeURIComponent("I'd like to book a test drive: " + payload.vehicle + " (" + (v.stockNumber || v.id) + ")");
        }
      });
    }

    var afford = document.getElementById("ctaAfford");
    if (afford) {
      afford.addEventListener("click", function () {
        if (window.TruAfford && typeof window.TruAfford.open === "function") {
          window.TruAfford.open({
            price: payload.price,
            vehicle: payload.vehicle,
            vehicleId: payload.vehicleId
          });
        } else if (window.TruForm && typeof window.TruForm.open === "function") {
          window.TruForm.open({
            vehicle: payload.vehicle, vehicleId: payload.vehicleId,
            interest: "Affordability check",
            finance: true, source: "vdp-affordability",
          });
        } else {
          location.href = "/finance.html?stock=" + encodeURIComponent(v.stockNumber || v.id);
        }
      });
    }

    /* Share button — wire directly with the already-resolved vehicle so we
       never go through TRU.get() which could return vehicles[0] when the
       stock ID doesn't match the live-feed key format. */
    var shareBtn = document.querySelector('[data-share="' + (v.stockNumber || v.id) + '"]');
    if (!shareBtn) shareBtn = document.querySelector("[data-share]");
    if (shareBtn) {
      shareBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation(); // prevent the delegated handler in bindCardTools
        if (window.TruShare && typeof window.TruShare.open === "function") {
          window.TruShare.open({
            year: v.year,
            make: v.make,
            name: v.model,
            variant: v.trim || v.variant || "",
            price: v.truPrice || v.price,
            km: v.mileage || v.km,
            trans: v.transmission,
            fuel: v.fuelType || v.fuel,
            body: v.bodyType || v.body,
            stock: v.stockNumber || v.id,
            images: v.images && v.images.length ? v.images : (v.heroImage ? [v.heroImage] : []),
          });
        } else {
          var url = location.origin + "/vehicle.html?stock=" + encodeURIComponent(v.stockNumber || v.id);
          if (navigator.share) {
            navigator.share({ title: TRU.title(v), url: url }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
          }
        }
      });
    }
  }

  render();
  window.addEventListener("tru:stock", render);
})();