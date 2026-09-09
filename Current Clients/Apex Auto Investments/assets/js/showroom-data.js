// assets/js/showroom-data.js — Stock Hydration Engine for Apex Auto Investments

(function() {
  'use strict';

  const SITE_CONFIG = {
    dealerSlug: 'apex-wholesale-investments',
    primaryApi: 'https://flow.tru-saas.com/api/public/stock?dealer=apex-wholesale-investments',
    fallbackApis: [
      'https://premium.tru-saas.com/api/public/stock?dealer=apex-wholesale-investments',
      'https://lens.tru-saas.com/api/public/stock?dealer=apex-wholesale-investments'
    ]
  };

  window.TRU_STOCK = window.TRU_STOCK || [];
  window.TRU_STOCK_LOADED = false;

  function normaliseVehicle(v) {
    if (!v) return null;
    const price = parseInt(String(v.price || v.retailPrice || 0).replace(/\D/g, ''), 10) || 0;
    const truPrice = parseInt(String(v.truPrice || v.marketValue || price).replace(/\D/g, ''), 10) || price;
    const mileage = parseInt(String(v.mileage || v.km || 0).replace(/\D/g, ''), 10) || 0;
    const images = Array.isArray(v.images) && v.images.length ? v.images : (v.heroImage ? [v.heroImage] : ['/assets/img/placeholder.jpg']);

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
      virScore: parseInt(v.virScore || v.vir || 92, 10),
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
        if (Array.isArray(rawList)) {
          const list = rawList.map(normaliseVehicle).filter(Boolean);
          window.TRU_STOCK = list;
          window.TRU_STOCK_LOADED = true;
          window.dispatchEvent(new CustomEvent('tru:stock', { detail: { stock: list, source: url } }));
          return list;
        }
      } catch (err) {
        console.warn('[TruDealer Stock] Failed fetching from ' + url, err);
      }
    }
    // If all endpoints fail or return empty
    window.TRU_STOCK = [];
    window.TRU_STOCK_LOADED = true;
    window.dispatchEvent(new CustomEvent('tru:stock', { detail: { stock: [], source: 'holding' } }));
    return [];
  }

  // Initial fetch on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchStock);
  } else {
    fetchStock();
  }
})();
