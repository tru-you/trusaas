// assets/js/showroom.js — Chrome Injection & Theme Switcher for Sahara Warm Minimalism

(function() {
  'use strict';

  const SITE_CONFIG = {
    dealer: "Apex Auto Investments",
    legalName: "Apex Wholesale Investments",
    tagline: "Pre-Owned Excellence, Wholesale Value",
    phone: "+27 72 604 7878",
    phoneDisplay: "+27 72 604 7878 | +27 76 852 2968",
    whatsapp: "27726047878",
    email: "info@apexinvest.co.za",
    address: "17b Burt Drive, Newton Park, Gqeberha, 6045",
    hours: "Mon–Fri 08:00–17:30 · Sat 08:30–13:00",
    facebook: "https://www.facebook.com/profile.php?id=61577491113199"
  };

  // Light / Dark Theme Controller
  function initTheme() {
    const saved = localStorage.getItem('apex_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('apex_theme', next);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode';
    window.dispatchEvent(new CustomEvent('apex:themeChange', { detail: { theme: next } }));
  }

  function renderTopbar() {
    const el = document.getElementById('site-topbar');
    if (!el) return;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    el.innerHTML = `
      <div class="topbar">
        <div class="container">
          <div class="topbar-items">
            <div class="topbar-item">
              <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span>${SITE_CONFIG.address}</span>
            </div>
            <div class="topbar-item">
              <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              <span>${SITE_CONFIG.hours}</span>
            </div>
          </div>
          <div class="topbar-items">
            <div class="topbar-item">
              <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              <a href="tel:${SITE_CONFIG.phone.replace(/\D/g,'')}" class="topbar-link">${SITE_CONFIG.phoneDisplay}</a>
            </div>
            <button type="button" id="themeToggleBtn" class="theme-toggle">
              ${currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      </div>
    `;

    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.onclick = toggleTheme;
  }

  function renderHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    const currentPath = window.location.pathname;

    el.innerHTML = `
      <header class="header">
        <div class="container">
          <div class="header-inner">
            <a href="index.html" class="logo-wrap">
              <div class="logo-brand">Apex <span>Auto</span></div>
              <div class="logo-tag">Wholesale Floor</div>
            </a>
            <ul class="nav-menu">
              <li><a href="index.html" class="nav-link ${currentPath === '/' || currentPath.endsWith('index.html') ? 'active' : ''}">Home</a></li>
              <li><a href="stock.html" class="nav-link ${currentPath.includes('stock') ? 'active' : ''}">Wholesale Stock</a></li>
              <li><a href="index.html#finance" class="nav-link">Finance Calculator</a></li>
              <li><a href="index.html#sell" class="nav-link">Sell / Trade-In</a></li>
              <li><a href="index.html#why" class="nav-link">Why Us</a></li>
              <li><a href="index.html#visit" class="nav-link">Visit Us</a></li>
            </ul>
            <div class="header-ctas">
              <a href="https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi Apex Auto! I'm interested in your pre-owned inventory.")}" target="_blank" rel="noopener" class="btn btn-wa btn-sm">
                <span>WhatsApp Us</span>
              </a>
              <a href="index.html#finance" class="btn btn-primary btn-sm">Apply For Finance</a>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  function renderSocialProofTicker() {
    const el = document.getElementById('social-proof-ticker');
    if (!el) return;
    el.innerHTML = `
      <div class="proof-ticker">
        <div class="proof-ticker-track">
          <span>114-Point VIR® Scored Stock</span>
          <span>&middot;</span>
          <span>ABSA & WesBank Approved Finance</span>
          <span>&middot;</span>
          <span>Same-Day Trade-In Settlements</span>
          <span>&middot;</span>
          <span>17b Burt Drive, Newton Park Gqeberha</span>
          <span>&middot;</span>
          <span>Zero Hidden Administration Fees</span>
          <span>&middot;</span>
          <span>114-Point VIR® Scored Stock</span>
          <span>&middot;</span>
          <span>ABSA & WesBank Approved Finance</span>
          <span>&middot;</span>
          <span>Same-Day Trade-In Settlements</span>
        </div>
      </div>
    `;
  }

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="footer-brand-title">Apex <span>Auto</span> Investments</div>
              <p class="footer-desc">
                Newton Park's trusted pre-owned vehicle specialists. Quality hand-picked cars, bakkies, and SUVs with verified inspection reports and multi-bank finance approval.
              </p>
              <div style="font-family: var(--font-sans); font-size: 0.84rem; color: rgba(250,245,238,0.7);">
                17b Burt Drive, Newton Park, Gqeberha (PE), 6045
              </div>
            </div>
            <div>
              <div class="footer-col-title">Navigation</div>
              <ul class="footer-links">
                <li><a href="index.html" class="footer-link">Home</a></li>
                <li><a href="stock.html" class="footer-link">Wholesale Stock</a></li>
                <li><a href="index.html#finance" class="footer-link">Finance Calculator</a></li>
                <li><a href="index.html#sell" class="footer-link">Sell / Trade-In</a></li>
                <li><a href="index.html#why" class="footer-link">Why Choose Apex</a></li>
              </ul>
            </div>
            <div>
              <div class="footer-col-title">Services</div>
              <ul class="footer-links">
                <li><a href="stock.html" class="footer-link">Vehicle Sales</a></li>
                <li><a href="index.html#finance" class="footer-link">Bank Asset Finance</a></li>
                <li><a href="index.html#sell" class="footer-link">Trade-In Appraisal</a></li>
                <li><a href="index.html#why" class="footer-link">114-Point VIR® Scored</a></li>
                <li><a href="https://wa.me/${SITE_CONFIG.whatsapp}" target="_blank" class="footer-link">WhatsApp Support</a></li>
              </ul>
            </div>
            <div>
              <div class="footer-col-title">Contact Us</div>
              <p style="font-size: 0.88rem; color: rgba(250,245,238,0.8); margin-bottom: 12px;">
                Davrin: +27 72 604 7878<br>
                Curt: +27 76 852 2968<br>
                Email: info@apexinvest.co.za
              </p>
              <a href="${SITE_CONFIG.facebook}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="color:#fff; border-color:rgba(255,255,255,0.2);">
                Follow Us on Facebook
              </a>
            </div>
          </div>
          <div class="footer-bottom">
            <div>&copy; ${new Date().getFullYear()} Apex Auto Investments (Pty) Ltd. All rights reserved.</div>
            <div>
              Powered by <a href="https://tru-saas.com" target="_blank" class="footer-trudealer">Tru<span>Dealer</span>™ Engine</a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  function renderMobileBar() {
    let el = document.getElementById('site-mbar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'site-mbar';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="mbar">
        <a href="tel:27726047878" class="btn btn-outline btn-sm" style="padding: 10px 4px; font-size:0.8rem; color:#fff; border-color:rgba(255,255,255,0.2);">Call Us</a>
        <a href="https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi Apex Auto! I'm looking for a car.")}" target="_blank" class="btn btn-wa btn-sm" style="padding: 10px 4px; font-size:0.8rem;">WhatsApp</a>
        <a href="stock.html" class="btn btn-primary btn-sm" style="padding: 10px 4px; font-size:0.8rem;">View Stock</a>
      </div>
    `;
  }

  // ── Site-Wide Effects: Scroll Progress Bar ──
  function initScrollProgress() {
    let bar = document.getElementById('scroll-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'scroll-progress';
      bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--color-primary),var(--color-gold));z-index:10000;width:0%;transition:width 0.1s ease-out;pointer-events:none;';
      document.body.appendChild(bar);
    }

    function updateProgress() {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const progress = total > 0 ? (window.scrollY / total) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, progress)) + '%';
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  // ── Site-Wide Effects: Header Elevation & Scroll Listener ──
  function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;

    function handleScroll() {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // ── Site-Wide Effects: Scroll Reveal Observer (TrueCars Flagship) ──
  function initScrollReveals() {
    // Automatically tag key section components for reveal if untagged
    const targetSelectors = [
      '.section-header',
      '.cat-tile',
      '.search-rail-inner',
      '.holding-box',
      '#finance',
      '#sell',
      '#why',
      '#visit'
    ];

    targetSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach((el, idx) => {
        if (!el.classList.contains('rv') && !el.classList.contains('rv-scale') && !el.classList.contains('rv-left') && !el.classList.contains('rv-right')) {
          el.classList.add('rv');
          if (idx % 3 === 1) el.classList.add('d1');
          if (idx % 3 === 2) el.classList.add('d2');
        }
      });
    });

    const revealElements = document.querySelectorAll('.rv, .rv-scale, .rv-left, .rv-right');
    if (!revealElements.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.08
      });

      revealElements.forEach(el => observer.observe(el));
    } else {
      // Fallback if IntersectionObserver is unsupported
      revealElements.forEach(el => el.classList.add('in'));
    }
  }

  // ── Bespoke Interactive Dealership Map Engine ──
  function initApexInteractiveMap() {
    const mapEl = document.getElementById('apex-map');
    if (!mapEl || typeof window.L === 'undefined') return;

    // 17b Burt Drive, Newton Park, Gqeberha (PE) coordinates
    const lat = -33.9485;
    const lng = 25.5685;

    const lightTileUrl = 'https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png';
    const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    const getActiveTileUrl = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      return theme === 'dark' ? darkTileUrl : lightTileUrl;
    };

    let activeTileLayer = null;

    const map = L.map('apex-map', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false
    });

    activeTileLayer = L.tileLayer(getActiveTileUrl(), {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Custom Marker Pin with Animated Wave Ring
    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin-wrapper',
      html: `
        <div class="map-custom-pin">
          <div class="pin-ring"></div>
          <div class="pin-body">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    marker.bindPopup(`
      <div style="font-family:var(--font-sans); padding:6px; text-align:center; min-width:180px;">
        <strong style="color:var(--color-primary); font-family:var(--font-serif); font-size:1.15rem; display:block;">Apex Auto Investments</strong>
        <span style="font-size:0.85rem; color:#444; display:block; margin:4px 0 8px;">17b Burt Drive, Newton Park</span>
        <a href="https://maps.google.com/?q=17b+Burt+Drive+Newton+Park+Gqeberha" target="_blank" style="display:inline-block; padding:4px 10px; background:#C2652A; color:#fff; font-size:0.75rem; font-weight:700; border-radius:4px; text-decoration:none;">Open Map &rarr;</a>
      </div>
    `);

    // Sync tile theme when user toggles theme
    window.addEventListener('apex:themeChange', function(e) {
      if (activeTileLayer) {
        map.removeLayer(activeTileLayer);
      }
      activeTileLayer = L.tileLayer(getActiveTileUrl(), { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    });
  }

  initTheme();

  document.addEventListener('DOMContentLoaded', function() {
    renderTopbar();
    renderHeader();
    renderSocialProofTicker();
    renderFooter();
    renderMobileBar();

    initScrollProgress();
    initHeaderScroll();

    initApexInteractiveMap();

    // Small delay to allow dynamic DOM sections to render before observing
    setTimeout(initScrollReveals, 120);
  });
})();

