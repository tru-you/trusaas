// assets/js/index-page.js — Homepage Logic Controller for Apex Auto Investments (Flagship Matched)

(function() {
  'use strict';

  var currentCategory = 'all';

  function formatMoney(n) {
    return 'R ' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatKm(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  }

  function renderHero(v) {
    if (!v) return;
    var heroImgEl = document.getElementById('heroImg');
    var targetSrc = v.heroImage || (v.images && v.images[0]);
    if (heroImgEl && targetSrc) {
      var curSrc = heroImgEl.getAttribute('src') || heroImgEl.src || '';
      if (curSrc !== targetSrc && !curSrc.endsWith(targetSrc)) {
        var imgLoader = new Image();
        imgLoader.onload = function() {
          if (heroImgEl) heroImgEl.src = targetSrc;
        };
        imgLoader.src = targetSrc;
      }
    }

    var titleEl = document.getElementById('heroTitle');
    if (titleEl) {
      titleEl.innerHTML = (v.make || 'QUALITY') + ' <em>' + (v.model || 'PRE-OWNED') + '.</em>';
    }

    var priceEl = document.getElementById('heroPrice');
    if (priceEl) priceEl.textContent = formatMoney(v.price);

    var kmEl = document.getElementById('heroKm');
    if (kmEl) kmEl.textContent = v.mileage ? formatKm(v.mileage) : 'Low Mileage';

    var eyebrowEl = document.getElementById('heroEyebrow');
    if (eyebrowEl) eyebrowEl.textContent = 'Featured · VIR® ' + (v.virScore || 92);

    var ctaEl = document.getElementById('heroCta');
    if (ctaEl) {
      ctaEl.href = 'vehicle.html?stock=' + encodeURIComponent(v.stockNumber || v.id) +
        '&make=' + encodeURIComponent(v.make) +
        '&name=' + encodeURIComponent(v.model) +
        '&year=' + encodeURIComponent(v.year) +
        '&price=' + encodeURIComponent(v.price) +
        '&km=' + encodeURIComponent(v.mileage) +
        '&img=' + encodeURIComponent(targetSrc);
    }

    var deltaWrap = document.getElementById('heroDeltaWrap');
    var deltaEl = document.getElementById('heroDelta');
    if (v.truPrice && v.truPrice > v.price) {
      var under = v.truPrice - v.price;
      if (deltaEl) deltaEl.textContent = 'R' + Math.round(under / 1000) + 'k under TruPrice';
      if (deltaWrap) deltaWrap.style.display = 'inline-flex';
    } else if (deltaWrap) {
      deltaWrap.style.display = 'none';
    }
  }

  function renderVehicleCard(v) {
    const estRepay = (p) => 'R ' + Math.round((p * 0.9 * 0.02) + 200).toLocaleString() + ' / mo';

    const card = document.createElement('a');
    card.href = 'vehicle.html?stock=' + encodeURIComponent(v.stockNumber || v.id) +
      '&make=' + encodeURIComponent(v.make) +
      '&name=' + encodeURIComponent(v.model) +
      '&year=' + encodeURIComponent(v.year) +
      '&price=' + encodeURIComponent(v.price) +
      '&km=' + encodeURIComponent(v.mileage) +
      '&trans=' + encodeURIComponent(v.transmission) +
      '&fuel=' + encodeURIComponent(v.fuelType) +
      '&body=' + encodeURIComponent(v.bodyType) +
      '&img=' + encodeURIComponent(v.heroImage);

    card.className = 'card';
    card.innerHTML = `
      <div class="card-media">
        <img src="${v.heroImage}" alt="${v.year} ${v.make} ${v.model}" class="card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80'">
        <div class="card-vir-badge">
          <span>VIR®</span>
          <span class="card-vir-score">${v.virScore || 92} / 100</span>
        </div>
        <div class="card-body-tag">${v.bodyType || 'Vehicle'}</div>
      </div>
      <div class="card-content">
        <div class="card-year-make">${v.year} · ${v.make}</div>
        <h3 class="card-title">${v.make} ${v.model} ${v.variant || ''}</h3>
        <div class="card-specs">
          <div class="spec-item">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            <span>${formatKm(v.mileage)}</span>
          </div>
          <div class="spec-item">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            <span>${v.transmission || 'Manual'}</span>
          </div>
          <div class="spec-item">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11C16.17 7 15.19 7.5 14.5 8.36 13.62 9.47 13.5 11 14.15 12.27L12 14.42l-1.42-1.42c.39-.62.59-1.34.59-2.08 0-2.21-1.79-4-4-4S3.17 8.71 3.17 10.92c0 .74.2 1.46.59 2.08L2 14.77l1.41 1.41 1.77-1.77c.62.39 1.34.59 2.08.59 2.21 0 4-1.79 4-4 0-.74-.2-1.46-.59-2.08L12.83 6.7c.61-.41 1.34-.63 2.09-.63.92 0 1.8.36 2.45 1.01l.01.01 2.39 2.39z"/></svg>
            <span>${v.fuelType || 'Petrol'}</span>
          </div>
        </div>
        <div class="card-footer">
          <div>
            <div class="card-price">${formatMoney(v.price)}</div>
            <div class="card-repay">Est. ${estRepay(v.price)}</div>
          </div>
          <div class="card-actions">
            <span class="btn btn-primary btn-sm">View Details</span>
          </div>
        </div>
      </div>
    `;
    return card;
  }

  function filterByCategory(list, cat) {
    if (cat === 'under250') {
      return list.filter(function(v) { return v.price <= 250000; });
    }
    if (cat === 'suv') {
      return list.filter(function(v) {
        var b = (v.bodyType || '').toLowerCase();
        return b.includes('suv') || b.includes('bakkie') || b.includes('crossover') || b.includes('cab');
      });
    }
    if (cat === 'lowkm') {
      return list.filter(function(v) { return v.mileage && v.mileage <= 60000; });
    }
    return list;
  }

  function updateHomepageUI(stock) {
    const grid = document.getElementById('featuredGrid');
    const holding = document.getElementById('holdingState');
    const railCount = document.getElementById('railCount');

    if (railCount) railCount.textContent = stock.length || '0';

    if (!stock || stock.length === 0) {
      if (grid) grid.style.display = 'none';
      if (holding) holding.style.display = 'block';
      return;
    }

    if (holding) holding.style.display = 'none';

    renderHero(stock[0]);

    if (grid) {
      grid.style.display = 'grid';
      grid.innerHTML = '';
      var filtered = filterByCategory(stock, currentCategory);
      var displayStock = filtered.slice(0, 6);
      displayStock.forEach((v, idx) => {
        var card = renderVehicleCard(v);
        card.classList.add('rv');
        if (idx % 3 === 1) card.classList.add('d1');
        if (idx % 3 === 2) card.classList.add('d2');
        grid.appendChild(card);
      });

      var fillTile = document.createElement('a');
      fillTile.className = 'card-filler rv';
      fillTile.href = 'stock.html';
      fillTile.innerHTML = '<span>See every unit on our Burt Drive floor &rarr;</span>';
      grid.appendChild(fillTile);

      // Trigger reveal observer for dynamic cards
      if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function(entries, observer) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.08 });
        grid.querySelectorAll('.rv').forEach(function(el) { obs.observe(el); });
      } else {
        grid.querySelectorAll('.rv').forEach(function(el) { el.classList.add('in'); });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    var tabBtns = document.querySelectorAll('.collection-tab');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        tabBtns.forEach(function(b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        currentCategory = btn.dataset.cat;
        updateHomepageUI(window.TRU_STOCK || []);
      });
    });
  });

  window.addEventListener('tru:stock', function(e) {
    const stock = e.detail && e.detail.stock ? e.detail.stock : [];
    updateHomepageUI(stock);
  });

  if (window.TRU_STOCK_LOADED) {
    updateHomepageUI(window.TRU_STOCK);
  }
})();
