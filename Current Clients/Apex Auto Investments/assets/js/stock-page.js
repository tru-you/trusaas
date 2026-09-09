// assets/js/stock-page.js — SRP Controller for Apex Auto Investments

(function() {
  'use strict';

  var currentFilters = {
    search: '',
    make: '',
    body: '',
    price: '',
    trans: '',
    sort: 'price-asc'
  };

  function formatMoney(n) {
    return 'R ' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatKm(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  }

  function estRepay(p) {
    return 'R ' + Math.round((p * 0.9 * 0.02) + 200).toLocaleString() + ' / mo';
  }

  function parseQueryParams() {
    var params = new URLSearchParams(window.location.search);
    if (params.has('make')) currentFilters.make = params.get('make');
    if (params.has('body')) currentFilters.body = params.get('body');
    if (params.has('maxPrice')) currentFilters.price = '0-' + params.get('maxPrice');
    if (params.has('sort')) currentFilters.sort = params.get('sort');

    var makeSel = document.getElementById('srpMake');
    if (makeSel && currentFilters.make) makeSel.value = currentFilters.make;

    var bodySel = document.getElementById('srpBody');
    if (bodySel && currentFilters.body) bodySel.value = currentFilters.body;

    var priceSel = document.getElementById('srpPrice');
    if (priceSel && currentFilters.price) priceSel.value = currentFilters.price;
  }

  function populateMakeOptions(stock) {
    var sel = document.getElementById('srpMake');
    if (!sel) return;
    var makes = Array.from(new Set(stock.map(function(v) { return v.make; }).filter(Boolean))).sort();
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">All Makes</option>' + makes.map(function(m) {
      return '<option value="' + m + '"' + (m === currentVal ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
  }

  function filterStock(stock) {
    return stock.filter(function(v) {
      if (currentFilters.search) {
        var q = currentFilters.search.toLowerCase();
        var match = (v.make + ' ' + v.model + ' ' + v.variant + ' ' + v.year).toLowerCase().includes(q);
        if (!match) return false;
      }
      if (currentFilters.make && v.make !== currentFilters.make) return false;
      if (currentFilters.body && v.bodyType !== currentFilters.body) return false;
      if (currentFilters.trans && v.transmission !== currentFilters.trans) return false;
      if (currentFilters.price) {
        var parts = currentFilters.price.split('-');
        var min = parseInt(parts[0], 10) || 0;
        var max = parseInt(parts[1], 10) || Infinity;
        if (v.price < min || v.price > max) return false;
      }
      return true;
    });
  }

  function sortStock(list, sortKey) {
    var copy = list.slice();
    if (sortKey === 'price-asc') return copy.sort(function(a, b) { return a.price - b.price; });
    if (sortKey === 'price-desc') return copy.sort(function(a, b) { return b.price - a.price; });
    if (sortKey === 'year-desc') return copy.sort(function(a, b) { return b.year - a.year; });
    if (sortKey === 'km-asc') return copy.sort(function(a, b) { return a.mileage - b.mileage; });
    return copy;
  }

  function renderCard(v) {
    var card = document.createElement('a');
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

  function renderSRP() {
    var rawStock = window.TRU_STOCK || [];
    populateMakeOptions(rawStock);
    var filtered = filterStock(rawStock);
    var sorted = sortStock(filtered, currentFilters.sort);

    var countEl = document.getElementById('srpTotalCount');
    if (countEl) countEl.textContent = sorted.length;

    var grid = document.getElementById('srpGrid');
    var holding = document.getElementById('srpHolding');

    if (sorted.length === 0) {
      if (grid) grid.style.display = 'none';
      if (holding) holding.style.display = 'block';
    } else {
      if (holding) holding.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = '';
        sorted.forEach(function(v, idx) {
          var card = renderCard(v);
          card.classList.add('rv');
          if (idx % 3 === 1) card.classList.add('d1');
          if (idx % 3 === 2) card.classList.add('d2');
          grid.appendChild(card);
        });

        // Trigger reveal observer for SRP cards
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
  }

  function bindEvents() {
    parseQueryParams();

    var sSearch = document.getElementById('srpSearch');
    if (sSearch) sSearch.addEventListener('input', function(e) { currentFilters.search = e.target.value; renderSRP(); });

    var sMake = document.getElementById('srpMake');
    if (sMake) sMake.addEventListener('change', function(e) { currentFilters.make = e.target.value; renderSRP(); });

    var sBody = document.getElementById('srpBody');
    if (sBody) sBody.addEventListener('change', function(e) { currentFilters.body = e.target.value; renderSRP(); });

    var sPrice = document.getElementById('srpPrice');
    if (sPrice) sPrice.addEventListener('change', function(e) { currentFilters.price = e.target.value; renderSRP(); });

    var sTrans = document.getElementById('srpTrans');
    if (sTrans) sTrans.addEventListener('change', function(e) { currentFilters.trans = e.target.value; renderSRP(); });

    var sSort = document.getElementById('srpSort');
    if (sSort) sSort.addEventListener('change', function(e) { currentFilters.sort = e.target.value; renderSRP(); });

    var sReset = document.getElementById('srpReset');
    if (sReset) {
      sReset.addEventListener('click', function() {
        currentFilters = { search:'', make:'', body:'', price:'', trans:'', sort:'price-asc' };
        if (sSearch) sSearch.value = '';
        if (sMake) sMake.value = '';
        if (sBody) sBody.value = '';
        if (sPrice) sPrice.value = '';
        if (sTrans) sTrans.value = '';
        if (sSort) sSort.value = 'price-asc';
        renderSRP();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    bindEvents();
    if (window.TRU_STOCK_LOADED) renderSRP();
  });

  window.addEventListener('tru:stock', renderSRP);
})();
