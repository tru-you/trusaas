// assets/js/vdp-page.js — Flagship VDP Controller & TruOrbit 360 Fetcher for Apex Auto Investments

(function() {
  'use strict';

  function formatMoney(n) {
    return 'R ' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatKm(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  }

  function estRepay(p) {
    return 'R ' + Math.round((p * 0.9 * 0.02) + 200).toLocaleString() + ' / mo';
  }

  function parseUrlVehicle() {
    var q = new URLSearchParams(window.location.search);
    if (!q.has('stock') && !q.has('name') && !q.has('make')) return null;

    var priceNum = parseInt(String(q.get('price') || '').replace(/\D/g, ''), 10) || 0;
    var kmNum = parseInt(String(q.get('km') || '').replace(/\D/g, ''), 10) || 0;
    var img = q.get('img') || '';

    return {
      id: q.get('stock') || 'APX-001',
      stockNumber: q.get('stock') || 'APX-001',
      year: parseInt(q.get('year'), 10) || new Date().getFullYear(),
      make: q.get('make') || 'Quality',
      model: q.get('name') || q.get('model') || 'Pre-Owned Vehicle',
      variant: q.get('variant') || '',
      price: priceNum,
      truPrice: priceNum,
      mileage: kmNum,
      transmission: q.get('trans') || 'Manual',
      fuelType: q.get('fuel') || 'Petrol',
      bodyType: q.get('body') || 'Vehicle',
      heroImage: img,
      images: img ? [img] : [],
      virScore: 92
    };
  }

  function findVehicleInStock(stockNumber) {
    var list = window.TRU_STOCK || [];
    return list.find(function(v) {
      return (v.stockNumber === stockNumber || v.id === stockNumber);
    });
  }

  function fetchTruOrbit(stockNumber, mainImgEl) {
    if (!stockNumber || !mainImgEl) return;
    var orbitUrl = 'https://lens.tru-saas.com/api/public/web3d/' + encodeURIComponent(stockNumber);

    fetch(orbitUrl)
      .then(function(res) { return res.ok ? res.json() : null; })
      .then(function(data) {
        if (data && data.package && Array.isArray(data.package.frames) && data.package.frames.length >= 6) {
          var frames = data.package.frames;
          var badge = document.getElementById('orbitBadge');
          if (badge) badge.style.display = 'flex';

          var currentIdx = 0;
          var container = document.getElementById('vdpGalleryContainer');
          if (!container) return;

          var isDragging = false;
          var startX = 0;

          container.addEventListener('pointerdown', function(e) {
            isDragging = true;
            startX = e.clientX;
            container.setPointerCapture(e.pointerId);
          });

          container.addEventListener('pointermove', function(e) {
            if (!isDragging) return;
            var dx = e.clientX - startX;
            if (Math.abs(dx) > 15) {
              var step = dx > 0 ? -1 : 1;
              currentIdx = (currentIdx + step + frames.length) % frames.length;
              var targetSrc = frames[currentIdx].image || frames[currentIdx].src;
              if (targetSrc) mainImgEl.src = targetSrc;
              startX = e.clientX;
            }
          });

          container.addEventListener('pointerup', function(e) {
            isDragging = false;
            try { container.releasePointerCapture(e.pointerId); } catch(err) {}
          });
        }
      })
      .catch(function() {});
  }

  function renderVDP(v) {
    if (!v) return;

    var fullTitle = v.year + ' ' + v.make + ' ' + v.model + ' ' + (v.variant || '');
    document.title = fullTitle + ' | Apex Auto Investments';

    var bc = document.getElementById('vdpBreadcrumbTitle');
    if (bc) bc.textContent = fullTitle;

    var tEl = document.getElementById('vdpTitle');
    if (tEl) tEl.textContent = fullTitle;

    var sEl = document.getElementById('vdpStockNo');
    if (sEl) sEl.textContent = 'Stock # ' + (v.stockNumber || v.id);

    var pEl = document.getElementById('vdpPrice');
    if (pEl) pEl.textContent = formatMoney(v.price);

    var rEl = document.getElementById('vdpRepay');
    if (rEl) rEl.textContent = 'Est. ' + estRepay(v.price);

    // Sticky Deal Bar
    if (document.getElementById('stickyTitle')) document.getElementById('stickyTitle').textContent = fullTitle;
    if (document.getElementById('stickyPrice')) document.getElementById('stickyPrice').textContent = formatMoney(v.price);

    // Full Report Link
    var rptLink = document.getElementById('vdpFullReportBtn');
    if (rptLink) rptLink.href = 'report.html?stock=' + encodeURIComponent(v.stockNumber || v.id) + '&title=' + encodeURIComponent(fullTitle);

    // Main Spec Tiles
    if (document.getElementById('spYear')) document.getElementById('spYear').textContent = v.year;
    if (document.getElementById('spKm')) document.getElementById('spKm').textContent = formatKm(v.mileage);
    if (document.getElementById('spTrans')) document.getElementById('spTrans').textContent = v.transmission;
    if (document.getElementById('spFuel')) document.getElementById('spFuel').textContent = v.fuelType;
    if (document.getElementById('spBody')) document.getElementById('spBody').textContent = v.bodyType;
    if (document.getElementById('spColor')) document.getElementById('spColor').textContent = v.colour || 'White';
    if (document.getElementById('spVir')) document.getElementById('spVir').textContent = (v.virScore || 92) + ' / 100';
    if (document.getElementById('virRingVal')) document.getElementById('virRingVal').textContent = v.virScore || 92;

    // Main Image
    var mImg = document.getElementById('vdpMainImg');
    if (mImg && v.heroImage) mImg.src = v.heroImage;

    // Fetch TruOrbit 360° Walkaround Package if available
    fetchTruOrbit(v.stockNumber || v.id, mImg);

    // Filmstrip Images
    var strip = document.getElementById('vdpFilmstrip');
    if (strip && Array.isArray(v.images) && v.images.length > 1) {
      strip.innerHTML = v.images.map(function(src, idx) {
        return '<img src="' + src + '" class="vdp-thumb ' + (idx === 0 ? 'is-active' : '') + '" onclick="document.getElementById(\'vdpMainImg\').src=\'' + src + '\'; document.querySelectorAll(\'.vdp-thumb\').forEach(function(t){t.classList.remove(\'is-active\');}); this.classList.add(\'is-active\');">';
      }).join('');
    } else if (strip) {
      strip.style.display = 'none';
    }

    // WhatsApp CTA Buttons
    var waMsg = "Hi Apex Auto! I'm interested in this " + fullTitle + " (Stock #" + (v.stockNumber || v.id) + ") listed at " + formatMoney(v.price) + ". Link: " + window.location.href + " Is it still available?";
    var waHref = "https://wa.me/27726047878?text=" + encodeURIComponent(waMsg);

    var waBtn = document.getElementById('vdpWaBtn');
    if (waBtn) waBtn.href = waHref;

    var stickyWa = document.getElementById('stickyWa');
    if (stickyWa) stickyWa.href = waHref;

    // Share Button
    var shareBtn = document.getElementById('vdpShareBtn');
    if (shareBtn) {
      shareBtn.onclick = function() {
        if (window.TruShare && window.TruShare.open) {
          window.TruShare.open(v);
        } else if (navigator.share) {
          navigator.share({ title: fullTitle, url: window.location.href }).catch(function(){});
        }
      };
    }
  }

  function init() {
    var q = new URLSearchParams(window.location.search);
    var stockId = q.get('stock');
    var vehicle = stockId ? findVehicleInStock(stockId) : null;

    if (!vehicle) {
      vehicle = parseUrlVehicle();
    }

    if (vehicle) {
      renderVDP(vehicle);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('tru:stock', function() {
    var q = new URLSearchParams(window.location.search);
    var stockId = q.get('stock');
    if (stockId) {
      var v = findVehicleInStock(stockId);
      if (v) renderVDP(v);
    }
  });
})();
