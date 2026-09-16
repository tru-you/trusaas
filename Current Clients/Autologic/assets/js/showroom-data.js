// assets/js/showroom-data.js — Stock Hydration Engine & TruShowroom Bridge for AutoLogic PE

(function() {
  'use strict';

  var TRU = (window.TruShowroom = window.TruShowroom || {});

  const SITE_CONFIG = {
    dealerSlug: 'autologic-pe',
    primaryApi: 'https://premium.trudealers.com/api/public/stock?dealer=autologic-pe',
    fallbackApis: [
      'https://premium.trudealers.com/api/public/stock?dealer=autologic-pe'
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

  const PREVIEW_STOCK = [
    normaliseVehicle({
      id: 'Tru1272',
      stockNumber: 'Tru1272',
      year: 2025,
      make: 'Audi',
      model: 'Q7',
      variant: '45 TDI Quattro Tip Competition',
      price: 1380377,
      truPrice: 1380377,
      mileage: 15800,
      transmission: 'Automatic',
      fuelType: 'Diesel',
      bodyType: 'SUV',
      colour: 'Midnight Black',
      heroImage: 'https://premium.trudealers.com/media/f3b14ea13fdd33795714845630615e61a641dd39eacaa6a8aed0d343fa416ca3.jpg',
      images: [
        'https://premium.trudealers.com/media/f3b14ea13fdd33795714845630615e61a641dd39eacaa6a8aed0d343fa416ca3.jpg',
        'https://premium.trudealers.com/media/96ce6b56aaf1abf8a3a359f8f4a43555c4cf035875cad7ebe31f3531491ccd1f.jpg',
        'https://premium.trudealers.com/media/29d49d1038b7899e62a211b6f06115d30888d8777943b18bb7508a9fb01789b6.jpg',
        'https://premium.trudealers.com/media/c1a3a10649118d4a20393627a0639543ebc7011a2d0fd2370ebca381f2b591fd.jpg',
        'https://premium.trudealers.com/media/77a1fbddb254693ece33b885ea7945aa903b6c503d7c6c57a79fc9edf7ac7036.jpg',
        'https://premium.trudealers.com/media/e3b239ee560c067e3a7ed3cab228f7ff1ae4be3e0ab26707f596b2676e6950bc.jpg',
        'https://premium.trudealers.com/media/70453a571064f93d736364abe949d0c77c1b977b24d6f6f9ed3ee2fec14a6bf1.jpg',
        'https://premium.trudealers.com/media/093514e447ae21b0033997a3e8bc95466e46297227183017b6701054f3cb35b4.jpg',
        'https://premium.trudealers.com/media/1a990e4563f8714a4e262c5308bdab272ee378c6883a45d2cf062fb325820650.jpg',
        'https://premium.trudealers.com/media/1d63ffb4f5e336a1ee2ef4d8e75a7895aa049b8ffb54f9c4de14b3d20fa3ec15.jpg',
        'https://premium.trudealers.com/media/1dec22c5385af4a1a2128a45158b1605e4e5e00f4e59bf741179f046bdd59c28.jpg',
        'https://premium.trudealers.com/media/34b136cba809da0b0f8cc610f47cc60b0464db8eb42cba0212f1a580fa542065.jpg',
        'https://premium.trudealers.com/media/b133aae0cff3bae05d8955e61de03663dbbd7aeec02e386f0e90bd93943dcd11.jpg',
        'https://premium.trudealers.com/media/44ad850e696eb52b05eee0ff41a82b82cb4fd1b6286a4f414e5320e63a45cb9a.jpg',
        'https://premium.trudealers.com/media/d130b9c33b5dcab105f0a4dda26bbca03aff288c4b90b62b6b722e1366496cab.jpg',
        'https://premium.trudealers.com/media/e1e6831fbb90d170102bf946441eba31eaba3893d71a26d7440678b304a43790.jpg',
        'https://premium.trudealers.com/media/1a7ba4f79f976340c63b22a6eeb3172ae643c29881dc3afe96294acf1cc0c6f9.jpg',
        'https://premium.trudealers.com/media/8d89b46ce47cdd2dfb1ae0c4c428c952acee2861e0ae2a281838397b8a2a95a4.jpg',
        'https://premium.trudealers.com/media/7f7613114322d6bcae09315d81f7d9d7e632b7e55e22dedadc09b82e599265f1.jpg',
        'https://premium.trudealers.com/media/5ae0254da85f4afa9cd55ff3a8e2326773fada97c483ee49123694bfd1702d59.jpg',
        'https://premium.trudealers.com/media/746f535abe3be98220a46bd2e39309348c15d80b702b2bdd0a28b373995d1687.jpg',
        'https://premium.trudealers.com/media/89192ddaf8663a9fab5c35f6b00224d271be5b1366e45701ba9d41eb38e8b526.jpg',
        'https://premium.trudealers.com/media/3825575aad5f95f183c0edd47bc632d501fe8322a6c16af065dd26a65580e551.jpg',
        'https://premium.trudealers.com/media/bb586fc72ab07a198c958c8a101f642eb23be5f8d81a0719ac29d25913862efc.jpg',
        'https://premium.trudealers.com/media/41ff5202b4cd729757e9473b7c5a348ff2224eac372c5a667c3f42c5eabfa510.jpg',
        'https://premium.trudealers.com/media/5c6b5d8801779d62fa43ad282148399a3a178d2931d693bc8b826f76d469f268.jpg'
      ],
      virScore: 89
    })
  ];

  window.TRU_STOCK = PREVIEW_STOCK;
  TRU.vehicles = PREVIEW_STOCK;
  window.TRU_STOCK_LOADED = true;

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

    window.TRU_STOCK = PREVIEW_STOCK;
    TRU.vehicles = PREVIEW_STOCK;
    window.TRU_STOCK_LOADED = true;
    window.dispatchEvent(new CustomEvent('tru:stock', { detail: { stock: PREVIEW_STOCK, source: 'mock-test', isPreview: false } }));
    return PREVIEW_STOCK;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchStock);
  } else {
    fetchStock();
  }
})();
