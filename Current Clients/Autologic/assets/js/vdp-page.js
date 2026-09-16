// assets/js/vdp-page.js — Flagship VDP Controller, Lightbox & TruOrbit 360 Engine for AutoLogic PE

(function() {
  'use strict';

  var TRU = window.TruShowroom || {};

  function formatMoney(n) {
    return 'R ' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatKm(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  }

  function estRepay(p) {
    return 'R ' + Math.round((p * 0.9 * 0.02) + 200).toLocaleString() + ' / mo';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ---- Immersive Lightbox Modal (Flagship Sync) ---- */
  function openLightbox(images, startIdx) {
    if (!images || !images.length) return;
    var idx = startIdx || 0;
    var lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.innerHTML =
      '<button type="button" class="gallery-lightbox-close" aria-label="Close Lightbox">×</button>' +
      (images.length > 1 ? '<button type="button" class="gallery-lightbox-nav prev" aria-label="Previous image">‹</button>' : '') +
      '<img src="' + escapeHtml(images[idx]) + '" alt="Vehicle Photo ' + (idx + 1) + '">' +
      (images.length > 1 ? '<button type="button" class="gallery-lightbox-nav next" aria-label="Next image">›</button>' : '') +
      '<div class="gallery-lightbox-counter">' + (idx + 1) + ' / ' + images.length + '</div>';

    document.body.appendChild(lb);
    requestAnimationFrame(function() { lb.classList.add('is-open'); });

    var img = lb.querySelector('img');
    var counter = lb.querySelector('.gallery-lightbox-counter');

    function show(i) {
      idx = (i + images.length) % images.length;
      img.src = images[idx];
      if (counter) counter.textContent = (idx + 1) + ' / ' + images.length;
    }

    var prevBtn = lb.querySelector('.prev');
    var nextBtn = lb.querySelector('.next');
    if (prevBtn) prevBtn.addEventListener('click', function(e) { e.stopPropagation(); show(idx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function(e) { e.stopPropagation(); show(idx + 1); });

    var closeBtn = lb.querySelector('.gallery-lightbox-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    lb.addEventListener('click', function(ev) { if (ev.target === lb) close(); });

    document.addEventListener('keydown', onKey);
    function onKey(ev) {
      if (ev.key === 'Escape') close();
      if (ev.key === 'ArrowLeft' && images.length > 1) show(idx - 1);
      if (ev.key === 'ArrowRight' && images.length > 1) show(idx + 1);
    }
    function close() {
      lb.classList.remove('is-open');
      setTimeout(function() { lb.remove(); }, 300);
      document.removeEventListener('keydown', onKey);
    }
  }

  function mountGallery(images) {
    if (!images || !images.length) return;
    var heroImg = document.getElementById('vdpMainImg');
    var filmstrip = document.getElementById('vdpFilmstrip');
    var heroWrap = document.getElementById('galleryHero');
    var photoCount = document.getElementById('vdpPhotoCount');
    var tabGalleryLabel = document.getElementById('tabGalleryLabel');

    if (photoCount) photoCount.textContent = images.length + (images.length === 1 ? ' photo' : ' photos');
    if (tabGalleryLabel) tabGalleryLabel.textContent = 'HD Photos (' + images.length + ')';

    var currentIdx = 0;

    if (filmstrip) {
      if (images.length > 1) {
        filmstrip.style.display = 'flex';
        filmstrip.innerHTML = images.map(function(img, i) {
          return '<button type="button" class="vdp-filmstrip-thumb' + (i === 0 ? ' is-active' : '') + '" data-idx="' + i + '">' +
            '<img src="' + escapeHtml(img) + '" alt="Photo ' + (i + 1) + '" loading="lazy">' +
          '</button>';
        }).join('');

        filmstrip.onclick = function(ev) {
          var btn = ev.target.closest('.vdp-filmstrip-thumb');
          if (!btn) return;
          var idx = Number(btn.dataset.idx);
          currentIdx = idx;
          if (heroImg) heroImg.src = images[idx];
          filmstrip.querySelectorAll('.vdp-filmstrip-thumb').forEach(function(t, i) {
            t.classList.toggle('is-active', i === idx);
          });
        };
      } else {
        filmstrip.style.display = 'none';
      }
    }

    if (heroWrap) {
      heroWrap.onclick = function() { openLightbox(images, currentIdx); };
      heroWrap.onkeydown = function(ev) { if (ev.key === 'Enter') openLightbox(images, currentIdx); };
    }
  }

  function wireMediaTabs() {
    var tabs = document.getElementById('mediaTabs');
    if (!tabs) return;
    var orbit = document.getElementById('orbitContainer');
    var gallery = document.getElementById('galleryContainer');

    tabs.addEventListener('click', function(ev) {
      var btn = ev.target.closest('.media-tab-btn');
      if (!btn) return;
      tabs.querySelectorAll('.media-tab-btn').forEach(function(b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      var mode = btn.dataset.tab;
      if (mode === 'orbit') {
        if (orbit) orbit.style.display = 'block';
        if (gallery) gallery.style.display = 'none';
      } else if (mode === 'gallery') {
        if (orbit) orbit.style.display = 'none';
        if (gallery) gallery.style.display = 'block';
      }
    });
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

  function renderVDP(v) {
    if (!v) return;

    var fullTitle = v.year + ' ' + v.make + ' ' + v.model + ' ' + (v.variant || '');
    document.title = fullTitle + ' | AutoLogic PE';

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

    // Request Vehicle Inspection WhatsApp CTA
    var rptLink = document.getElementById('vdpFullReportBtn');
    if (rptLink) {
      var inspMsg = "Hi AutoLogic PE! I'd like to request the TruInspect VIR® condition report for the " + fullTitle + " (Stock #" + (v.stockNumber || v.id) + ").";
      rptLink.href = 'https://wa.me/27826039334?text=' + encodeURIComponent(inspMsg);
    }

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

    // Build/Mount Interactive 3D Orbit Player (Flagship TCSA.loadWeb3DForVehicle / mountWeb3D)
    var orbitContainer = document.getElementById('orbitContainer');
    if (orbitContainer && window.TCSA && window.TCSA.mountWeb3D) {
      window.TCSA.loadWeb3DForVehicle(orbitContainer, v);
    }

    // Mount Gallery & Lightbox
    var galleryImages = (v.images && v.images.length) ? v.images : (v.heroImage ? [v.heroImage] : ['audi.jpg']);
    mountGallery(galleryImages);
    wireMediaTabs();

    // WhatsApp CTA Buttons
    var waMsg = "Hi AutoLogic PE! I'm interested in this " + fullTitle + " (Stock #" + (v.stockNumber || v.id) + ") listed at " + formatMoney(v.price) + ". Link: " + window.location.href + " Is it still available?";
    var waHref = "https://wa.me/27826039334?text=" + encodeURIComponent(waMsg);

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

    // Authentic 1-car test stock from Truecars flagship (TruLens photographed & scored)
    var TRUECARS_TEST_VEHICLE = {
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
    };

    if (!vehicle && window.TRU_STOCK && window.TRU_STOCK.length) {
      vehicle = window.TRU_STOCK[0];
    }

    if (!vehicle) {
      vehicle = TRUECARS_TEST_VEHICLE;
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

