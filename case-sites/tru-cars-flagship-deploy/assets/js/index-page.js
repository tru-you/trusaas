(function () {
  var TRU = window.TruShowroom;
  var currentCategory = "all";

  function render() {
    var all = TRU.vehicles || [];
    var facets = TRU.facets();
    var sorted = TRU.sort(all, "price-asc");

    /* hero */
    var hero = all[0];
    if (hero) {
      var heroPrice = hero.truPrice && hero.truPrice < hero.price ? hero.truPrice : hero.price;
      document.getElementById("heroImg").src =
        hero.heroImage || (hero.images && hero.images[0]) || "/assets/hero-showroom.jpg";
      document.getElementById("heroTitle").innerHTML =
        TRU.esc(hero.make) + " <em>" + TRU.esc(hero.model) + ".</em>";
      document.getElementById("heroPrice").textContent = TRU.money(heroPrice);
      document.getElementById("heroKm").textContent = hero.mileage ? TRU.km(hero.mileage) : "Low mileage";
      document.getElementById("heroCta").href =
        "/vehicle.html?stock=" + encodeURIComponent(hero.stockNumber || hero.id);

      var eyebrow = "Featured";
      if (hero.vir) eyebrow += " · VIR " + hero.vir;
      document.getElementById("heroEyebrow").textContent = eyebrow;

      if (hero.truPrice && hero.truPrice < hero.price) {
        var under = hero.price - hero.truPrice;
        document.getElementById("heroDelta").textContent =
          "R" + Math.round(under / 1000) + "k under market";
        document.getElementById("heroDeltaWrap").hidden = false;
      }
    }

    
    if (document.getElementById("railCount")) document.getElementById("railCount").textContent = all.length;
    if (document.getElementById("railInspected")) document.getElementById("railInspected").textContent = all.filter(function(v){return v.vir;}).length;
    if (document.getElementById("railOrbit")) document.getElementById("railOrbit").textContent = all.filter(function(v){return v.web3d;}).length;
  

    /* search-rail selects */
    var fill = function (id, list) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var keep = sel.querySelector("option") ? sel.querySelector("option").outerHTML : "";
      sel.innerHTML = keep + list.map(function (f) {
        return '<option value="' + TRU.esc(f.value) + '">' + TRU.esc(f.value) + "</option>";
      }).join("");
    };
    fill("fMake", facets.make);
    fill("fBody", facets.bodyType);

    /* body tiles */
    var bodyTiles = document.getElementById("bodyTiles");
    if (bodyTiles) {
      bodyTiles.innerHTML =
        facets.bodyType.map(function (f) {
          return '<a class="tile" href="/stock.html?bodyType=' + encodeURIComponent(f.value) + '">' +
            TRU.bodyIcon(f.value) +
            "<b>" + TRU.esc(f.value) + "</b><span>" + f.count + (f.count === 1 ? " car" : " cars") + "</span></a>";
        }).join("") +
        '<a class="tile" href="/stock.html">' +
          '<svg viewBox="0 0 48 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 6h36M6 11h36M6 16h36"/></svg>' +
          "<b>View all</b><span>" + all.length + " cars</span></a>";
    }

    /* budget chips */
    var budgetChips = document.getElementById("budgetChips");
    if (budgetChips) {
      var bands = [
        { label: "Under R150k",     max: 150000 },
        { label: "R150k — R250k",   min: 150000, max: 250000 },
        { label: "R250k — R400k",   min: 250000, max: 400000 },
        { label: "R400k and above", min: 400000 },
      ];
      budgetChips.innerHTML = bands
        .map(function (b) {
          var n = TRU.filter({ minPrice: b.min, maxPrice: b.max }).length;
          if (!n) return "";
          var q = [];
          if (b.min) q.push("minPrice=" + b.min);
          if (b.max) q.push("maxPrice=" + b.max);
          return '<a class="chip" href="/stock.html?' + q.join("&") + '">' +
            b.label + " <b>" + n + "</b></a>";
        }).join("");
    }

    renderFeaturedGrid(sorted);
  }

  function filterByCategory(list, cat) {
    if (cat === "under250") {
      return list.filter(function (c) {
        var p = c.truPrice && c.truPrice < c.price ? c.truPrice : c.price;
        return p <= 250000;
      });
    }
    if (cat === "luxury") {
      return list.filter(function (c) {
        var p = c.truPrice && c.truPrice < c.price ? c.truPrice : c.price;
        var make = (c.make || "").toLowerCase();
        return p >= 350000 || make.includes("bmw") || make.includes("mercedes") || make.includes("audi");
      });
    }
    if (cat === "suv") {
      return list.filter(function (c) {
        var b = (c.bodyType || "").toLowerCase();
        return b.includes("suv") || b.includes("crossover") || b.includes("4x4");
      });
    }
    if (cat === "lowkm") {
      return list.filter(function (c) {
        return c.mileage && c.mileage <= 60000;
      });
    }
    return list;
  }

  function renderFeaturedGrid(list) {
    var filtered = filterByCategory(list, currentCategory);
    var grid = document.getElementById("featured");
    if (!grid) return;

    var featured = filtered.slice(0, 9);
    grid.innerHTML = featured.length ? featured.map(function (v, i) {
      var isFeature = (i % 5 === 0);
      var callouts = ["Just arrived", "Editor’s pick", "Top spec"];
      return TRU.cardHtml(v, {
        feature: isFeature,
        callout: isFeature ? callouts[Math.floor(i / 5) % callouts.length] : null
      });
    }).join("") : '<div class="empty" style="grid-column:1/-1"><h3>No vehicles in this collection right now.</h3><p>Try switching categories or view the full showroom.</p></div>';

    /* backfill: span-2 feature cards can leave a hole in the last row —
       a CTA tile takes the leftover cells (or a full-width band when the
       math lands clean) so no row ends empty and the CTA always lives */
    if (featured.length) {
      var cells = 0;
      grid.querySelectorAll(".card").forEach(function (c) {
        cells += c.classList.contains("is-feature") ? 2 : 1;
      });
      var rem = cells % 3;
      var fill = document.createElement("a");
      fill.className = "card-filler";
      fill.href = "/stock.html";
      fill.style.gridColumn = rem === 0 ? "1 / -1" : "span " + (3 - rem);
      fill.innerHTML = "<span>See every unit on the floor</span>";
      grid.appendChild(fill);
    }

    TRU.staggerCards(grid);
  }

  // Setup collection tab clicks
  var tabBtns = document.querySelectorAll(".collection-tab");
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabBtns.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      currentCategory = btn.dataset.cat;
      var all = TRU.vehicles || [];
      renderFeaturedGrid(TRU.sort(all, "price-asc"));
    });
  });

  render();
  window.addEventListener("tru:stock", render);

  /* ---- glassmorphic FABs ---- */
  var fEnq = document.getElementById("fabEnquiry");
  if (fEnq) {
    fEnq.addEventListener("click", function () {
      if (window.TruForm && window.TruForm.open) {
        window.TruForm.open({ interest: "General enquiry", source: "glass-fab" });
      } else {
        location.href = "https://wa.me/27620502091";
      }
    });
  }
  var fFin = document.getElementById("fabFinance");
  if (fFin) {
    fFin.addEventListener("click", function () {
      if (window.TruAfford && window.TruAfford.open) {
        window.TruAfford.open();
      } else {
        location.href = "/finance.html";
      }
    });
  }
})();