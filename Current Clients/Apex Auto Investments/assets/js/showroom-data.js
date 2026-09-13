// assets/js/showroom-data.js — Stock Hydration Engine & TruShowroom Bridge for Apex Auto Investments

(function() {
  'use strict';

  var TRU = (window.TruShowroom = window.TruShowroom || {});

  const SITE_CONFIG = {
    dealerSlug: 'apex-auto',
    primaryApi: 'https://premium.trudealers.com/api/public/stock?dealer=apex-auto',
    fallbackApis: [
      'https://premium.trudealers.com/api/public/stock?dealer=apex-wholesale-investments'
    ]
  };

  /* Finance calculations matching TruRepay standard */
  TRU.FINANCE = { rate: 11.75, depositPct: 10, term: 72, balloonPct: 0 };

  TRU.monthly = function(price, opts) {
    var o = opts || {};
    var rate = o.rate != null ? o.rate : TRU.FINANCE.rate;
    var term = o.term != null ? o.term : TRU.FINANCE.term;
    var depPct = o.depositPct != null ? o.depositPct : TRU.FINANCE.depositPct;
    var balPct = o.balloonPct != null ? o.balloonPct : TRU.FINANCE.balloonPct;

    var principal = price - price * (depPct / 100);
    var balloon = price * (balPct / 100);
    if (!(principal > 0) || !(term > 0)) return 0;
    var r = rate / 100 / 12;
    if (r <= 0) return (principal - balloon) / term;
    var pv = principal - balloon / Math.pow(1 + r, term);
    return Math.round((pv * r) / (1 - Math.pow(1 + r, -term)));
  };

  TRU.money = function(n) {
    return 'R ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  TRU.km = function(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  };

  TRU.title = function(v) {
    if (!v) return '';
    return [v.year, v.make, v.model].filter(Boolean).join(' ');
  };

  TRU.esc = function(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  TRU.get = function(id, fallbackFirst) {
    var list = TRU.vehicles || window.TRU_STOCK || [];
    var target = String(id || '').trim();
    if (target) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].stockNumber === target || list[i].id === target) {
          return list[i];
        }
      }
    }
    return fallbackFirst && list.length ? list[0] : null;
  };

  TRU.sort = function(list, sortKey) {
    var copy = (list || []).slice();
    if (sortKey === 'price-asc') return copy.sort(function(a, b) { return (a.truPrice || a.price) - (b.truPrice || b.price); });
    if (sortKey === 'price-desc') return copy.sort(function(a, b) { return (b.truPrice || b.price) - (a.truPrice || a.price); });
    if (sortKey === 'year-desc') return copy.sort(function(a, b) { return b.year - a.year; });
    if (sortKey === 'km-asc') return copy.sort(function(a, b) { return a.mileage - b.mileage; });
    return copy;
  };

  TRU.params = function() {
    var q = new URLSearchParams(window.location.search);
    var res = {};
    q.forEach(function(val, key) { res[key] = val; });
    return res;
  };

  TRU.setParams = function(obj, push) {
    var url = new URL(window.location.href);
    Object.keys(obj || {}).forEach(function(k) {
      if (obj[k] == null) url.searchParams.delete(k);
      else url.searchParams.set(k, obj[k]);
    });
    if (push && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', url.toString());
    }
  };

  window.TRU_STOCK = [];
  TRU.vehicles = [];
  window.TRU_STOCK_LOADED = false;

  function normaliseVehicle(v) {
    if (!v) return null;
    const price = parseInt(String(v.price || v.retailPrice || 0).replace(/\D/g, ''), 10) || 0;
    const truPrice = parseInt(String(v.truPrice || v.marketValue || price).replace(/\D/g, ''), 10) || price;
    const mileage = parseInt(String(v.mileage || v.km || 0).replace(/\D/g, ''), 10) || 0;
    const images = Array.isArray(v.images) && v.images.length ? v.images : (v.heroImage ? [v.heroImage] : ['audi.jpg']);

    return {
      id: String(v.id || v.stockNumber || Math.random().toString(36).substring(2, 9)),
      stockNumber: String(v.stockNumber || v.id || 'APX-001'),
      year: parseInt(v.year, 10) || new Date().getFullYear(),
      make: String(v.make || '').trim(),
      model: String(v.model || v.name || '').trim(),
      variant: String(v.variant || v.trim || '').trim(),
      price: price,
      truPrice: truPrice,
      mileage: mileage,
      transmission: String(v.transmission || 'Manual').trim(),
      fuelType: String(v.fuelType || v.fuel || 'Petrol').trim(),
      bodyType: String(v.bodyType || v.body || 'Vehicle').trim(),
      colour: String(v.colour || v.color || 'White').trim(),
      heroImage: images[0],
      images: images,
      virScore: parseInt(v.virScore || v.vir || 94, 10),
      dmsSyncedAt: v.dmsSyncedAt || new Date().toISOString()
    };
  }

  async function fetchStock() {
    const endpoints = [SITE_CONFIG.primaryApi, ...SITE_CONFIG.fallbackApis];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) continue;
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.vehicles || data.stock || []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const list = rawList.map(normaliseVehicle).filter(Boolean);
          window.TRU_STOCK = list;
          TRU.vehicles = list;
          window.TRU_STOCK_LOADED = true;
          window.dispatchEvent(new CustomEvent('tru:stock', { detail: { stock: list, source: url, isPreview: false } }));
          return list;
        }
      } catch (err) {
        console.warn('[TruDealer Stock] Failed fetching from ' + url, err);
      }
    }

    // Default holding state when 0 live cars are in the feed
    window.TRU_STOCK = [];
    TRU.vehicles = [];
    window.TRU_STOCK_LOADED = true;
    window.dispatchEvent(new CustomEvent('tru:stock', { detail: { stock: [], source: 'holding', isPreview: false } }));
    return [];
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchStock);
  } else {
    fetchStock();
  }
})();
