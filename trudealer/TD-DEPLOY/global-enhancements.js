/**
 * global-enhancements.js
 * Premium interaction layer for TruDealer & all demo sites.
 * Runs on every page automatically after injection.
 */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  /* ── 1. Scroll progress bar ──────────────────────────── */
  const bar = document.createElement('div');
  bar.className = 'ge-scroll-progress';
  document.body.appendChild(bar);
  let scrollTick = false;
  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? Math.min(window.scrollY / h, 1) : 0})`;
      scrollTick = false;
    });
  }, { passive: true });

  /* ── 2. Custom cursor glow ───────────────────────────── */
  if (!isTouch) {
    const glow = document.createElement('div');
    glow.className = 'global-cursor-glow';
    const dot = document.createElement('div');
    dot.className = 'global-cursor-dot';
    document.body.appendChild(glow);
    document.body.appendChild(dot);

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cy = my;
    let cursorActive = false;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx - 2}px, ${my - 2}px)`;
      if (!cursorActive) {
        cursorActive = true;
        glow.classList.add('active');
        dot.classList.add('active');
      }
    }, { passive: true });

    (function animateCursor() {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      glow.style.transform = `translate(${cx - 14}px, ${cy - 14}px)`;
      requestAnimationFrame(animateCursor);
    })();

    function attachHover(el) {
      el.addEventListener('mouseenter', () => glow.classList.add('hover'));
      el.addEventListener('mouseleave', () => glow.classList.remove('hover'));
    }

    // Attach to all interactive elements, now and future
    document.querySelectorAll('a, button, input, select, textarea, [role="button"]').forEach(attachHover);
    new MutationObserver((mutations) => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const targets = node.matches('a, button, input, select, textarea, [role="button"]')
          ? [node]
          : node.querySelectorAll('a, button, input, select, textarea, [role="button"]');
        targets.forEach(attachHover);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 3. Global scroll reveal (IntersectionObserver) ──── */
  if ('IntersectionObserver' in window && !reduce) {
    // Tag all likely card/section elements that aren't already animated
    const revealSelectors = [
      '.vcard', '.portal-card', '.prod-card', '.why-card-tcsa',
      '.case', '.step', '.module-card', '.wk', '.work-grid .wk',
      '.stat', '.stat rv', '.aiband-stat',
      'section > .wrap > h2:not(.hero-h):not(.hero-h1)',
      '.sec-head:not(.rv)', '.split-copy', '.split-media',
      '.delivery-split > div', '.budget-split > div',
      '.foot-col'
    ].join(', ');

    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          // stagger siblings slightly
          const siblings = [...(el.parentElement?.children || [])];
          const idx = siblings.indexOf(el);
          setTimeout(() => el.classList.add('ge-visible'), Math.min(idx * 60, 300));
          revealObs.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll(revealSelectors).forEach(el => {
      if (!el.classList.contains('rv') && !el.classList.contains('in') && !el.classList.contains('ge-reveal')) {
        el.classList.add('ge-reveal');
        revealObs.observe(el);
      }
    });
  }

  /* ── 4. 3D Card Tilt (desktop only) ─────────────────── */
  if (!isTouch && !reduce) {
    const tiltTargets = '.module-card, .case, .step, .portal-card, .prod-card, .why-card-tcsa';
    document.querySelectorAll(tiltTargets).forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 6}deg) translateY(-4px)`;

        // Dynamic glare overlay
        let glare = el.querySelector('.ge-glare');
        if (!glare) {
          glare = document.createElement('div');
          glare.className = 'ge-glare';
          glare.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:10;transition:opacity 0.3s;opacity:0;';
          el.style.position = 'relative';
          el.appendChild(glare);
        }
        const glareX = ((e.clientX - r.left) / r.width) * 100;
        const glareY = ((e.clientY - r.top) / r.height) * 100;
        glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.08) 0%, transparent 60%)`;
        glare.style.opacity = '1';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
        const glare = el.querySelector('.ge-glare');
        if (glare) glare.style.opacity = '0';
      });
    });
  }

  /* ── 5. Magnetic buttons ─────────────────────────────── */
  if (!isTouch && !reduce) {
    const magnetSelectors = '.btn-primary, .btn-grad, .btn-blue, .nav-cta, .book-float, .tc-launcher, .qs-go, .sp-go';
    document.querySelectorAll(magnetSelectors).forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18;
        const y = (e.clientY - r.top - r.height / 2) * 0.18;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('mouseleave', () => btn.style.transform = '');
    });
  }

  /* ── 6. Ambient floating particles (subtle, very few) ── */
  if (!reduce && !isTouch) {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'ge-particles';
    document.body.appendChild(particleContainer);

    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'ge-particle';
      const size = 1.5 + Math.random() * 2;
      p.style.cssText = [
        `left: ${Math.random() * 100}%`,
        `width: ${size}px`,
        `height: ${size}px`,
        `animation-duration: ${12 + Math.random() * 14}s`,
        `animation-delay: ${Math.random() * 10}s`,
        `--drift: ${(Math.random() - 0.5) * 80}px`,
        `opacity: ${0.3 + Math.random() * 0.5}`
      ].join(';');
      particleContainer.appendChild(p);
    }
  }

  /* ── 7. Section shimmer lines (hero sections only) ───── */
  if (!reduce) {
    document.querySelectorAll('.hero, .hero-scene, header.hero').forEach(hero => {
      if (hero.querySelector('.ge-shimmer-line')) return;
      const shimmer = document.createElement('div');
      shimmer.className = 'ge-shimmer-line';
      hero.style.position = hero.style.position || 'relative';
      hero.style.overflow = 'hidden';
      hero.appendChild(shimmer);
    });
  }

  /* ── 8. Vcard mouse-spotlight (demo grids) ───────────── */
  document.querySelectorAll('.vcard').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });

  /* ── 9. Glowing dividers between major sections ──────── */
  document.querySelectorAll('section + section, section + div.chapter').forEach(el => {
    if (el.previousElementSibling && !el.previousElementSibling.querySelector('.ge-glow-divider')) {
      const div = document.createElement('div');
      div.className = 'ge-glow-divider';
      el.parentElement.insertBefore(div, el);
    }
  });

  /* ── 10. Re-attach on dynamic content (stock grids) ──── */
  if ('IntersectionObserver' in window && !reduce) {
    const domObs = new MutationObserver(() => {
      document.querySelectorAll('.vcard:not(.ge-spotted)').forEach(card => {
        card.classList.add('ge-spotted');
        card.addEventListener('mousemove', (e) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
          card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
        });
        if (!isTouch) {
          card.addEventListener('mousemove', (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `perspective(800px) rotateY(${x * 5}deg) rotateX(${-y * 4}deg) translateY(-4px)`;
          });
          card.addEventListener('mouseleave', () => card.style.transform = '');
        }
      });
    });
    domObs.observe(document.body, { childList: true, subtree: true });
  }

})();
