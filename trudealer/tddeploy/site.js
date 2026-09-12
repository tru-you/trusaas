(function() {
  'use strict';

  // 1. THEME TOGGLE — single source of truth. Key: 'td-theme', default: dark.
  // Icon convention: dark mode shows sun (tap for light), light mode shows moon (tap for dark).
  const SUN_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const MOON_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function initTheme() {
    const root = document.documentElement;
    let theme = localStorage.getItem('td-theme') || 'dark';

    const blobs = document.querySelectorAll('.ambient-blob');
    const toggles = document.querySelectorAll('.theme-toggle');

    function applyTheme(t) {
      theme = t;
      root.setAttribute('data-theme', t);
      localStorage.setItem('td-theme', t);
      blobs.forEach(b => b.style.display = t === 'dark' ? 'block' : 'none');
      toggles.forEach(btn => {
        btn.innerHTML = t === 'dark' ? SUN_ICON : MOON_ICON;
        btn.setAttribute('aria-label', t === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      });
    }

    applyTheme(theme);

    toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(theme === 'dark' ? 'light' : 'dark');
      });
    });
  }

  // 8. AMBIENT BLOBS
  function injectBlobs() {
    for (let i = 0; i < 3; i++) {
      const blob = document.createElement('div');
      blob.className = `ambient-blob blob-${i+1}`;
      document.body.appendChild(blob);
    }
  }

  // 2. NAVBAR
  function initNav() {
    const nav = document.getElementById('mainNav');
    const burger = document.getElementById('navBurger') || document.querySelector('.nav-burger');
    const mobile = document.getElementById('navMobile') || document.querySelector('.nav-mobile');
    
    if (!nav) return;
    
    let lastY = 0, ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y > 80 && y > lastY) {
            nav.style.transform = 'translateY(-120%)';
          } else {
            nav.style.transform = 'translateY(0)';
          }
          if (y > 80) {
            nav.classList.add('scrolled');
          } else {
            nav.classList.remove('scrolled');
          }
          lastY = y;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    if (burger && !burger.dataset.navBound) {
      burger.dataset.navBound = 'true';
      burger.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = nav.classList.toggle('open');
        burger.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
      });
    }

    if (mobile) {
      mobile.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          nav.classList.remove('open');
          if(burger) burger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        });
      });
    }

    document.addEventListener('click', e => {
      if (nav.classList.contains('open') && !nav.contains(e.target)) {
        nav.classList.remove('open');
        if(burger) burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        if(burger) burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  // 3. WHATSAPP FAB
  function initWAFab() {
    const fab = document.getElementById('waFab');
    const toggle = document.getElementById('waFabToggle');
    if (!fab || !toggle) return;
    
    const menu = fab.querySelector('.wa-fab-menu');
    function setOpen(open) {
      fab.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (menu) menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      setOpen(!fab.classList.contains('open'));
    });
    document.addEventListener('click', e => {
      if (!fab.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') setOpen(false);
    });
    fab.querySelectorAll('.wa-fab-opt').forEach(a => {
      a.addEventListener('click', () => setOpen(false));
    });
  }

  // 4. TRUCHAT WIDGET
  function initTruChat() {
    window.tcOpen = () => document.getElementById('tc')?.classList.add('open');
    window.tcClose = () => document.getElementById('tc')?.classList.remove('open');

    const chatHistory = [
      { role: 'system', content: 'You are TruChat, the AI assistant for TruDealer (trudealer.tru-saas.com), an all-in-one vertical SaaS platform for independent car dealerships in South Africa. You are knowledgeable, direct, and concise (1-3 sentences max). Answer questions about pricing (TruStart R1,599/mo, TruPro R3,599/mo), TruShowroom custom sites, TruLens 28-shot photo studio, TruInspect 35-point VIR condition inspections, TruFlow DMS & F&I invoicing, and 13+ platform syndication. Offer WhatsApp demo handoff when helpful.' }
    ];

    const localBrain = {
      pricing: 'TruDealer packages start at R 1,599/mo for TruStart (single lot, unlimited listings, capture studio, inspections, mobile stock app, 24/7 AI chat, branded website) and R 3,599/mo for TruPro (full cloud DMS, F&I calculators, live market price scraper, deal jackets, OTPs, SARS tax invoicing). <a href="packages.html" style="color:var(--accent);text-decoration:underline;">View full packages breakdown →</a>',
      golive: "Ten working days from scope call to live on your domain. Day 1 we scope, days 2–7 we build or reskin to your brand, day 10 you're live with your stock loaded. If we miss the deadline we don't invoice.",
      start: "Depends on your bottleneck. Lot of stale stock? TruLens 28-shot guided studio. Losing leads after hours? TruChat 24/7 AI. Buyers ghosting on finance? TruShowroom finance sliders. <a href='https://wa.me/447476995694' target='_blank' style='color:var(--accent);text-decoration:underline;'>WhatsApp TruDealer Support</a> to discuss your floor.",
      showroom: "Every TruShowroom is custom-designed from the ground up with 100 Web Vitals speed. If you have an existing site, we can faithfully reskin your brand onto TruDealer with zero downtime.",
      dms: "TruFlow DMS includes full vehicle cost tracking, reconditioning expense logging, bank interest & balloon calculations, OTP deal jackets, and compliant SARS tax invoices generated in two clicks.",
      inspect: "TruInspect provides a 35-point condition checklist, interactive damage pin tagger, TransUnion verification checks, and dispute-proof PDF reports signed with digital inspector e-signatures.",
      lens: "TruLens uses on-screen ghost wireframes to guide lot staff through 28 photos across 3 phases in under 90 seconds, with automated TruOrbit 360° spin generation and free market price scraping.",
      demo: "Best move — <a href='https://wa.me/447476995694' target='_blank' style='color:var(--accent);text-decoration:underline;'>tap here to WhatsApp our team</a> or book a walkthrough on our site.",
      default: "Great question! TruDealer gives you custom storefronts, 28-shot photo studio, digital condition reports, full DMS invoicing, and 24/7 AI chat. <a href='https://wa.me/447476995694' target='_blank' style='color:var(--accent);text-decoration:underline;'>Chat with TruDealer on WhatsApp</a> for immediate answers."
    };

    function getLocalFallback(q) {
      const s = q.toLowerCase();
      if (/price|cost|how much|monthly|fee|package|tier/i.test(s)) return localBrain.pricing;
      if (/live|deploy|launch|ship|day|time|setup/i.test(s)) return localBrain.golive;
      if (/showroom|website|site|template|reskin/i.test(s)) return localBrain.showroom;
      if (/dms|flow|invoice|f&i|finance|tax|otp/i.test(s)) return localBrain.dms;
      if (/inspect|vir|damage|condition|report/i.test(s)) return localBrain.inspect;
      if (/lens|photo|shoot|360|orbit|camera/i.test(s)) return localBrain.lens;
      if (/start|begin|first|which|module/i.test(s)) return localBrain.start;
      if (/demo|walkthrough|book|call|test/i.test(s)) return localBrain.demo;
      return localBrain.default;
    }

    window.tcAsk = async function(q) {
      const body = document.getElementById('tc-body');
      if (!body || !q || !q.trim()) return;
      const trimmed = q.trim();

      const u = document.createElement('div');
      u.className = 'tc-bub u';
      u.textContent = trimmed;
      body.appendChild(u);
      body.scrollTop = body.scrollHeight;

      chatHistory.push({ role: 'user', content: trimmed });

      const typing = document.createElement('div');
      typing.className = 'tc-bub a tc-typing';
      typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;

      let replyText = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        
        // Try local Netlify serverless function first
        let res = await fetch('/.netlify/functions/truchat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistory.slice(-8),
            dealerName: 'TruDealer'
          }),
          signal: controller.signal
        }).catch(() => null);

        // Fallback to chat.tru-saas.com if netlify function isn't available
        if (!res || !res.ok) {
          res = await fetch('https://chat.tru-saas.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app: 'website',
              messages: chatHistory.slice(-6),
              dealerName: 'TruDealer'
            }),
            signal: controller.signal
          }).catch(() => null);
        }
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const data = await res.json();
          if (data && (data.reply || data.message || data.text)) {
            replyText = data.reply || data.message || data.text;
          }
        }
      } catch (err) {}

      if (!replyText) {
        replyText = getLocalFallback(trimmed);
      }

      chatHistory.push({ role: 'assistant', content: replyText.replace(/<[^>]*>?/gm, '') });

      if (typing.parentNode) typing.parentNode.removeChild(typing);

      const a = document.createElement('div');
      a.className = 'tc-bub a';
      a.innerHTML = replyText;
      body.appendChild(a);
      body.scrollTop = body.scrollHeight;
    };
    
    const tcForm = document.getElementById('tc-form');
    if (tcForm) {
      tcForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('tc-input');
        if (input && input.value) {
          window.tcAsk(input.value);
          input.value = '';
        }
      });
    }

    const quickReplies = document.querySelectorAll('.tc-quick-reply');
    quickReplies.forEach(btn => {
      btn.addEventListener('click', function() {
        window.tcAsk(this.textContent);
      });
    });
  }

  // 5. BACK TO TOP
  function initBTT() {
    const btt = document.getElementById('btt');
    if (!btt) return;
    
    const onScroll = () => {
      btt.classList.toggle('visible', window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // 6. SCROLL PROGRESS BAR
  function initScrollProgress() {
    const bar = document.querySelector('.scroll-prog-fill') || document.getElementById('prog');
    if (!bar) return;
    
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0) {
        const pct = window.scrollY / h;
        bar.style.transform = `scaleX(${pct})`;
        bar.style.width = Math.min(pct * 100, 100) + '%';
      }
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // 7. REVEAL ON SCROLL
  function initReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    if (typeof IntersectionObserver !== 'undefined') {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            e.target.classList.add('visible');
            obs.unobserve(e.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

      document.querySelectorAll('.rv, .rv-scale, .rv-left, .rv-right, .reveal').forEach(el => {
        obs.observe(el);
      });
    } else {
      document.querySelectorAll('.rv, .rv-scale, .rv-left, .rv-right, .reveal').forEach(el => {
        el.classList.add('in');
        el.classList.add('visible');
      });
    }
  }

  // 9. STICKY BOTTOM MOBILE BAR
  function initMobileSticky() {
    const msb = document.getElementById('mobileStickyBar') || document.querySelector('.mobile-sticky-bar');
    if (!msb) return;

    const hero = document.querySelector('.hero');
    const heroBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : 500;

    const onScroll = () => {
      if (window.innerWidth < 768 && window.scrollY > heroBottom) {
        msb.classList.add('visible');
      } else {
        msb.classList.remove('visible');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  // 10. NAV ACTIVE STATE
  function initNavActive() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
      const href = a.getAttribute('href');
      // If href is an anchor, skip this exact match
      if (href && href.startsWith('#')) return;
      if (href && href === path) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  // 11. MOBILE BOTTOM BAR POPOUT PANELS
  function initPopouts() {
    const chatBtn = document.getElementById('chatBtn');
    const chatPanel = document.getElementById('chatPanel');
    const chatClose = document.getElementById('chatClose');
    const enquireBtn = document.getElementById('enquireBtn');
    const enquirePanel = document.getElementById('enquirePanel');
    const enquireClose = document.getElementById('enquireClose');

    function openPanel(panel) {
      document.querySelectorAll('.popout-panel').forEach(p => p.classList.remove('active'));
      panel.classList.add('active');
    }
    function closeAllPanels() {
      document.querySelectorAll('.popout-panel').forEach(p => p.classList.remove('active'));
    }

    if (chatBtn && chatPanel) {
      chatBtn.addEventListener('click', () => {
        if (chatPanel.classList.contains('active')) { closeAllPanels(); } else { openPanel(chatPanel); }
      });
    }
    if (chatClose) chatClose.addEventListener('click', closeAllPanels);
    if (enquireBtn && enquirePanel) {
      enquireBtn.addEventListener('click', () => {
        if (enquirePanel.classList.contains('active')) { closeAllPanels(); } else { openPanel(enquirePanel); }
      });
    }
    if (enquireClose) enquireClose.addEventListener('click', closeAllPanels);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.popout-panel') && !e.target.closest('.bar-btn')) closeAllPanels();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllPanels();
    });
  }

  // 12. DEALERASSIST INTERACTIVE SIMULATOR
  function initDealerAssistSim() {
    const container = document.getElementById('assistSimPrompts');
    if (!container) return;
    const btns = container.querySelectorAll('.assist-prompt-btn');
    const textEl = document.getElementById('assistSimText');
    const delEl = document.getElementById('assistSimDelivery');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const response = btn.getAttribute('data-res');
        const delivery = btn.getAttribute('data-del');
        if (textEl && response) {
          textEl.innerHTML = response;
        }
        if (delEl && delivery) {
          delEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>' + delivery + '</span>';
        }
      });
    });
  }

  // 13. HORIZONTAL DRAG & WHEEL SCROLL FOR STRIPS
  function initHorizontalScrolls() {
    const scrollers = document.querySelectorAll('.vertical-strip, .mod-tabs-nav');
    scrollers.forEach(el => {
      let isDown = false;
      let startX;
      let scrollLeft;

      el.addEventListener('mousedown', (e) => {
        if (e.target.closest('a') && Math.abs(e.movementX || 0) < 2) return;
        isDown = true;
        el.classList.add('dragging');
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
      });
      el.addEventListener('mouseleave', () => {
        isDown = false;
        el.classList.remove('dragging');
      });
      el.addEventListener('mouseup', () => {
        isDown = false;
        el.classList.remove('dragging');
      });
      el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5;
        el.scrollLeft = scrollLeft - walk;
      });

      el.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
          if ((e.deltaY > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth) ||
              (e.deltaY < 0 && el.scrollLeft > 0)) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }
        }
      }, { passive: false });
    });
  }

  // 13. BEFORE / AFTER COMPARISON MOBILE TABS
  function initBeforeAfterTabs() {
    const tabBtns = document.querySelectorAll('.cds-tab-btn');
    if (!tabBtns.length) return;

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-cds-target');
        tabBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        const colBefore = document.getElementById('cdsColBefore') || document.querySelector('.cds-col.before');
        const colAfter = document.getElementById('cdsColAfter') || document.querySelector('.cds-col.after');

        if (target === 'before') {
          if (colBefore) colBefore.classList.add('active');
          if (colAfter) colAfter.classList.remove('active');
        } else {
          if (colAfter) colAfter.classList.add('active');
          if (colBefore) colBefore.classList.remove('active');
        }
      });
    });
  }

  // Init all on DOM ready or immediately if already loaded
  function start() {
    injectBlobs();
    initTheme();
    initNav();
    initWAFab();
    initTruChat();
    initBTT();
    initScrollProgress();
    initReveal();
    initMobileSticky();
    initNavActive();
    initPopouts();
    initDealerAssistSim();
    initHorizontalScrolls();
    initBeforeAfterTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();

