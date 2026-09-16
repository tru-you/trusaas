// assets/js/showroom.js — Chrome Injection & Theme Switcher for Sahara Warm Minimalism

(function() {
  'use strict';

  const SITE_CONFIG = {
    dealer: "AutoLogic PE",
    legalName: "AutoLogic PE",
    tagline: "The Logical Choice in Pre-Owned Vehicles",
    phone: "+27 82 603 9334",
    phoneDisplay: "+27 82 603 9334",
    whatsapp: "27826039334",
    email: "autologicpe@gmail.com",
    address: "Gqeberha (Port Elizabeth), Eastern Cape",
    hours: "Mon–Fri 08:00–17:30 · Sat 08:30–13:00",
    facebook: "https://www.facebook.com/profile.php?id=61577491113199",
    google: "https://maps.google.com/?q=17b+Burt+Drive+Newton+Park+Gqeberha",
    linkedin: "https://www.linkedin.com/company/autologic-pe"
  };

  // Light / Dark Theme Controller (Default: Dark Mode)
  function initTheme() {
    const saved = localStorage.getItem('autologic_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('autologic_theme', next);
    
    // Update all toggle switch instances
    document.querySelectorAll('.theme-toggle-switch').forEach(btn => {
      btn.setAttribute('aria-checked', next === 'dark' ? 'true' : 'false');
    });

    window.dispatchEvent(new CustomEvent('autologic:themeChange', { detail: { theme: next } }));
  }

  function renderTopbar() {
    const el = document.getElementById('site-topbar');
    if (!el) return;
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
          </div>
        </div>
      </div>
    `;
  }

  function renderHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    const currentPath = window.location.pathname;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    el.innerHTML = `
      <header class="header">
        <div class="container">
          <div class="header-inner">
            <a href="index.html" class="logo-wrap" style="display: flex; align-items: center; text-decoration: none;">
              <img src="assets/brand/logo.svg" alt="AutoLogic PE" class="brand-header-img" />
            </a>
            <ul class="nav-menu">
              <li><a href="index.html" class="nav-link ${currentPath === '/' || currentPath.endsWith('index.html') ? 'active' : ''}">Home</a></li>
              <li><a href="stock.html" class="nav-link ${currentPath.includes('stock') ? 'active' : ''}">Showroom</a></li>
              <li><a href="finance.html" class="nav-link ${currentPath.includes('finance') ? 'active' : ''}">Bank Finance</a></li>
              <li><a href="trade-in.html" class="nav-link ${currentPath.includes('trade-in') ? 'active' : ''}">Sell / Trade-In</a></li>
              <li><a href="index.html#why" class="nav-link">Why Us</a></li>
              <li><a href="index.html#visit" class="nav-link">Visit Us</a></li>
            </ul>
            <div class="header-ctas">
              <button type="button" id="headerThemeToggleBtn" class="theme-toggle-switch" aria-label="Toggle dark/light mode" role="switch" aria-checked="${currentTheme === 'dark' ? 'true' : 'false'}" title="Toggle Theme">
                <span class="theme-toggle-track">
                  <span class="theme-toggle-thumb"></span>
                </span>
              </button>
              <a href="https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi Charl! I'm interested in your pre-owned inventory.")}" target="_blank" rel="noopener" class="header-wa-btn" aria-label="Contact us on WhatsApp" title="WhatsApp Charl">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
              </a>
              <a href="finance.html" class="btn btn-primary btn-sm header-finance-btn">Apply For Finance</a>
              <button type="button" id="mobileNavToggle" class="mobile-nav-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobileNavDrawer">
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Glassmorphic Mobile Navigation Drawer -->
      <div id="mobileNavDrawer" class="mobile-nav-drawer" aria-hidden="true">
        <div class="mobile-nav-backdrop" id="mobileNavBackdrop"></div>
        <div class="mobile-nav-panel">
          <div class="mobile-nav-top">
            <img src="assets/brand/logo.svg" alt="AutoLogic PE" class="mobile-nav-logo" />
            <button type="button" id="mobileNavClose" class="mobile-nav-close" aria-label="Close navigation menu">&times;</button>
          </div>
          <div class="mobile-nav-links">
            <a href="index.html" class="mobile-nav-link ${currentPath === '/' || currentPath.endsWith('index.html') ? 'active' : ''}">
              <span>Home</span>
            </a>
            <a href="stock.html" class="mobile-nav-link ${currentPath.includes('stock') ? 'active' : ''}">
              <span>Showroom</span>
              <span class="mobile-nav-badge">Certified</span>
            </a>
            <a href="finance.html" class="mobile-nav-link ${currentPath.includes('finance') ? 'active' : ''}">
              <span>Bank Finance</span>
              <span class="mobile-nav-badge">4 Banks</span>
            </a>
            <a href="trade-in.html" class="mobile-nav-link ${currentPath.includes('trade-in') ? 'active' : ''}">
              <span>Sell / Trade-In</span>
              <span class="mobile-nav-badge">Instant</span>
            </a>
            <a href="index.html#why" class="mobile-nav-link">
              <span>Why Choose AutoLogic</span>
            </a>
            <a href="index.html#visit" class="mobile-nav-link">
              <span>Visit Showroom</span>
            </a>
            <a href="https://trudealers.com" target="_blank" rel="noopener" class="mobile-nav-link">
              <span>TruInspect VIR® Standard</span>
              <span class="mobile-nav-badge">Verified</span>
            </a>
          </div>
          <div class="mobile-nav-footer">
            <a href="finance.html" class="btn btn-primary" style="width: 100%; margin-bottom: 10px;">Apply For Finance</a>
            <a href="https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi AutoLogic PE! I would like to inquire about your pre-owned inventory.")}" target="_blank" rel="noopener" class="btn btn-wa" style="width: 100%; margin-bottom: 14px;">
              <span>WhatsApp Sales (Charl)</span>
            </a>
            <div class="mobile-nav-dealer-meta">
              <div>📍 Gqeberha, Eastern Cape, Gqeberha</div>
              <div>📞 072 604 7878 &middot; Certified Showroom</div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center; margin-top: 14px;">
              <a href="${SITE_CONFIG.google}" target="_blank" rel="noopener noreferrer" class="social-icon-btn" style="width: 42px; height: 42px;" aria-label="Google My Business" title="Google My Business">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.07 14.86c-2.73 0-4.95-2.22-4.95-4.95s2.22-4.95 4.95-4.95c1.33 0 2.45.49 3.32 1.3l-1.34 1.29c-.37-.35-.95-.76-1.98-.76-1.7 0-3.08 1.41-3.08 3.12s1.38 3.12 3.08 3.12c1.97 0 2.71-1.42 2.82-2.16h-2.82v-1.74h4.74c.05.27.08.55.08.9 0 2.88-1.93 4.93-4.8 4.93z"/></svg>
              </a>
              <a href="${SITE_CONFIG.facebook}" target="_blank" rel="noopener noreferrer" class="social-icon-btn" style="width: 42px; height: 42px;" aria-label="Facebook Page" title="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="${SITE_CONFIG.linkedin}" target="_blank" rel="noopener noreferrer" class="social-icon-btn" style="width: 42px; height: 42px;" aria-label="LinkedIn Profile" title="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    const themeBtn = document.getElementById('headerThemeToggleBtn');
    if (themeBtn) themeBtn.onclick = toggleTheme;

    // Wire mobile nav drawer handlers
    const navToggle = document.getElementById('mobileNavToggle');
    const navClose = document.getElementById('mobileNavClose');
    const navBackdrop = document.getElementById('mobileNavBackdrop');
    const navDrawer = document.getElementById('mobileNavDrawer');

    function openMobileNav() {
      if (!navDrawer) return;
      navDrawer.classList.add('is-open');
      navDrawer.setAttribute('aria-hidden', 'false');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileNav() {
      if (!navDrawer) return;
      navDrawer.classList.remove('is-open');
      navDrawer.setAttribute('aria-hidden', 'true');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (navToggle) navToggle.onclick = openMobileNav;
    if (navClose) navClose.onclick = closeMobileNav;
    if (navBackdrop) navBackdrop.onclick = closeMobileNav;

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navDrawer && navDrawer.classList.contains('is-open')) {
        closeMobileNav();
      }
    });
  }


  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="footer-brand-title" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <img src="assets/brand/logo.svg" alt="AutoLogic PE" class="brand-footer-img" />
              </div>
              <p class="footer-desc">
                Newton Park's trusted pre-owned vehicle specialists. Quality hand-picked cars, bakkies, and SUVs with TruInspect VIR® certified condition reports and multi-bank finance approval.
              </p>
              <div style="font-family: var(--font-sans); font-size: 0.84rem; color: rgba(250,245,238,0.7);">
                Gqeberha, Eastern Cape, Gqeberha (PE), 6045
              </div>
            </div>
            <div>
              <div class="footer-col-title">Navigation</div>
              <ul class="footer-links">
                <li><a href="index.html" class="footer-link">Home</a></li>
                <li><a href="stock.html" class="footer-link">Showroom</a></li>
                <li><a href="finance.html" class="footer-link">Bank Finance</a></li>
                <li><a href="trade-in.html" class="footer-link">Sell / Trade-In</a></li>
                <li><a href="index.html#why" class="footer-link">Why Choose AutoLogic</a></li>
              </ul>
            </div>
            <div>
              <div class="footer-col-title">Services & Standards</div>
              <ul class="footer-links">
                <li><a href="stock.html" class="footer-link">Vehicle Sales</a></li>
                <li><a href="finance.html" class="footer-link">Bank Asset Finance</a></li>
                <li><a href="trade-in.html" class="footer-link">Trade-In Appraisal</a></li>
                <li><a href="https://trudealers.com" target="_blank" rel="noopener" class="footer-link" style="color: var(--color-primary-light); font-weight: 700;">TruInspect VIR® Certified &rarr;</a></li>
                <li><a href="https://wa.me/${SITE_CONFIG.whatsapp}" target="_blank" class="footer-link">WhatsApp Support</a></li>
              </ul>
            </div>
            <div>
              <div class="footer-col-title">Contact & Social</div>
              <p style="font-size: 0.88rem; color: rgba(250,245,238,0.8); margin-bottom: 14px; line-height: 1.6;">
                Charl: +27 82 603 9334<br>
                Charl: +27 76 852 2968<br>
                Email: autologicpe@gmail.com
              </p>
              <div class="footer-social-links" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <a href="${SITE_CONFIG.google}" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="Visit AutoLogic PE on Google My Business" title="Google My Business">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.07 14.86c-2.73 0-4.95-2.22-4.95-4.95s2.22-4.95 4.95-4.95c1.33 0 2.45.49 3.32 1.3l-1.34 1.29c-.37-.35-.95-.76-1.98-.76-1.7 0-3.08 1.41-3.08 3.12s1.38 3.12 3.08 3.12c1.97 0 2.71-1.42 2.82-2.16h-2.82v-1.74h4.74c.05.27.08.55.08.9 0 2.88-1.93 4.93-4.8 4.93z"/>
                  </svg>
                </a>
                <a href="${SITE_CONFIG.facebook}" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="Follow AutoLogic PE on Facebook" title="Facebook">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="${SITE_CONFIG.linkedin}" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="Connect with AutoLogic PE on LinkedIn" title="LinkedIn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <div>&copy; ${new Date().getFullYear()} AutoLogic PE (Pty) Ltd. All rights reserved.</div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span>Powered by <a href="https://trudealers.com" target="_blank" rel="noopener" class="footer-trudealer">Tru<span>Dealer</span>™</a></span>
              <span>&middot;</span>
              <span>Vehicle Condition by <a href="https://trudealers.com" target="_blank" rel="noopener" style="color:var(--color-primary-light);text-decoration:none;font-weight:700;">TruInspect VIR®</a></span>
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
    const currentPath = window.location.pathname;
    const isStock = currentPath.includes('stock') || currentPath.includes('vehicle');
    const isFinance = currentPath.includes('finance');

    el.innerHTML = `
      <div class="mbar">
        <a href="stock.html" class="mbar-tab ${isStock ? 'active' : ''}">
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          <span>Showroom</span>
        </a>
        <button type="button" class="mbar-tab" id="mbar-chat-btn">
          <div class="mbar-ico-wrap">
            <img src="assets/brand/chat-icon.png" alt="AI" class="mbar-avatar" onerror="this.style.display='none';">
            <span class="mbar-pulse"></span>
          </div>
          <span>AI Chat</span>
        </button>
        <button type="button" class="mbar-tab ${isFinance ? 'active' : ''}" id="mbar-afford-btn">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
          <span>Afford</span>
        </button>
        <button type="button" class="mbar-tab" id="mbar-book-btn">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Book</span>
        </button>
        <a href="https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi AutoLogic PE! I'm inquiring from your mobile showroom.")}" target="_blank" rel="noopener" class="mbar-tab mbar-wa">
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          <span>WhatsApp</span>
        </a>
      </div>
    `;

    const chatBtn = document.getElementById('mbar-chat-btn');
    if (chatBtn) {
      chatBtn.onclick = function(e) {
        e.preventDefault();
        if (window.TruChat && window.TruChat.open) {
          window.TruChat.open();
        } else if (window.TruChatWidget && window.TruChatWidget.open) {
          window.TruChatWidget.open();
        } else {
          window.open(`https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi AutoLogic PE! I would like to speak with your team.")}`, '_blank');
        }
      };
    }

    const affordBtn = document.getElementById('mbar-afford-btn');
    if (affordBtn) {
      affordBtn.onclick = function(e) {
        e.preventDefault();
        if (window.TruAfford && typeof window.TruAfford.open === 'function') {
          window.TruAfford.open();
        } else if (window.TruRepay && typeof window.TruRepay.open === 'function') {
          window.TruRepay.open();
        } else {
          // Check if root host exists but needs event trigger
          const affordHost = document.getElementById('tru-afford-host') || document.getElementById('tru-afford-root');
          if (affordHost) {
            window.dispatchEvent(new CustomEvent('tru:afford:open'));
          } else {
            window.location.href = 'finance.html';
          }
        }
      };
    }

    const bookBtn = document.getElementById('mbar-book-btn');
    if (bookBtn) {
      bookBtn.onclick = function(e) {
        e.preventDefault();
        if (window.TruBook && window.TruBook.open) {
          window.TruBook.open({ mode: 'showroom' });
        } else if (window.TruForm && window.TruForm.open) {
          window.TruForm.open({ reason: 'Test drive' });
        } else {
          window.open(`https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Hi AutoLogic PE! I'd like to book a visit or test drive at Gqeberha.")}`, '_blank');
        }
      };
    }
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
  function initAutoLogicInteractiveMap() {
    const mapEl = document.getElementById('autologic-map');
    if (!mapEl || typeof window.L === 'undefined') return;

    // Gqeberha, Eastern Cape, Gqeberha (PE) coordinates
    const lat = -33.9485;
    const lng = 25.5685;

    // Standard OpenStreetMap / Carto Light Tile URLs
    const lightTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    const getActiveTileUrl = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      return theme === 'light' ? lightTileUrl : darkTileUrl;
    };

    // Determine if mobile/touch device to prevent scroll trapping
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);

    const map = L.map('autologic-map', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: !isTouchDevice,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      tap: false,
      attributionControl: false
    });

    activeTileLayer = L.tileLayer(getActiveTileUrl(), {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
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
        <strong style="color:var(--color-primary); font-family:var(--font-serif); font-size:1.15rem; display:block;">AutoLogic PE</strong>
        <span style="font-size:0.85rem; color:#444; display:block; margin:4px 0 8px;">Gqeberha, Eastern Cape</span>
        <a href="https://maps.google.com/?q=17b+Burt+Drive+Newton+Park+Gqeberha" target="_blank" style="display:inline-block; padding:4px 10px; background:#E31B23; color:#fff; font-size:0.75rem; font-weight:700; border-radius:4px; text-decoration:none;">Open Map &rarr;</a>
      </div>
    `);

    // Force size calculation once visible
    setTimeout(() => {
      try { map.invalidateSize(); } catch(e) {}
    }, 400);

    // Sync tile theme when user toggles theme
    window.addEventListener('autologic:themeChange', function(e) {
      if (activeTileLayer) {
        map.removeLayer(activeTileLayer);
      }
      activeTileLayer = L.tileLayer(getActiveTileUrl(), {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);
      try { map.invalidateSize(); } catch(err) {}
    });
  }

  initTheme();

  document.addEventListener('DOMContentLoaded', function() {
    renderTopbar();
    renderHeader();
    renderFooter();
    renderMobileBar();

    initScrollProgress();
    initHeaderScroll();

    initAutoLogicInteractiveMap();

    // Small delay to allow dynamic DOM sections to render before observing
    setTimeout(initScrollReveals, 120);
  });
})();

