/**
 * showroom.js — Shared JS for Your Car Guy flagship site
 * Handles: parallax, saved/recent drawer, dark mode, card tilt, heart bounce, skeleton loading, link prefetch
 */

// ── DARK MODE TOGGLE ─────────────────────────────────────
export function initDarkMode() {
  const stored = localStorage.getItem("ycg-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  
  document.documentElement.setAttribute("data-theme", theme);
  
  // Toggle button in header
  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;
  
  updateThemeIcon(theme);
  
  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ycg-theme", next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme: string) {
  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;
  toggleBtn.textContent = theme === "dark" ? "☀" : "🌙";
}

// ── PARALLAX SCROLL LOGIC ────────────────────────────────
let ticking = false;

export function initParallax() {
  const hero = document.querySelector<HTMLElement>("[data-parallax-hero]");
  if (!hero) return;
  
  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const heroHeight = hero.offsetHeight;
        
        if (scrollY < heroHeight) {
          // Hero image scales slightly as you scroll past
          const scale = 1 + scrollY * 0.0003;
          const translateY = scrollY * 0.3;
          hero.style.transform = `scale(${scale}) translateY(${-translateY}px)`;
          
          // Fade hero content out on scroll
          const heroContent = hero.querySelector<HTMLElement>("[data-hero-content]");
          if (heroContent) {
            heroContent.style.opacity = String(Math.max(0, 1 - scrollY / 400));
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  };
  
  window.addEventListener("scroll", handleScroll, { passive: true });
}

// ── SAVED/RECENT DRAWER (localStorage) ───────────────────
const SAVED_KEY = "ycg-saved-cars";
const RECENT_KEY = "ycg-recent-cars";

export function getSavedCars(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCarStockNo(stockNo: string): void {
  const saved = getSavedCars();
  const idx = saved.indexOf(stockNo);
  if (idx >= 0) {
    saved.splice(idx, 1);
  } else {
    saved.unshift(stockNo);
    if (saved.length > 20) saved.pop();
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
}

export function addRecentCarStockNo(stockNo: string): void {
  const recent = getRecentCars();
  const idx = recent.indexOf(stockNo);
  if (idx >= 0) recent.splice(idx, 1);
  recent.unshift(stockNo);
  if (recent.length > 10) recent.pop();
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export function getRecentCars(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function openSavedDrawer() {
  const drawer = document.getElementById("saved-drawer");
  if (!drawer) return;
  drawer.classList.remove("translate-x-full");
  drawer.classList.add("translate-x-0");
  document.body.style.overflow = "hidden";
}

export function closeSavedDrawer() {
  const drawer = document.getElementById("saved-drawer");
  if (!drawer) return;
  drawer.classList.add("translate-x-full");
  drawer.classList.remove("translate-x-0");
  document.body.style.overflow = "";
}

// ── VIEW TRANSITION NAME ON CARDS ────────────────────────
export function assignViewTransitionNames() {
  const cards = document.querySelectorAll('[data-vehicle-card]');
  cards.forEach((card, i) => {
    (card as HTMLElement).style.viewTransitionName = `vehicle-card-${i}`;
  });
}

// ── CARD TILT MICRO-INTERACTION ──────────────────────────
export function initCardTilt() {
  const cards = document.querySelectorAll<HTMLElement>("[data-tilt]");

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;

      card.style.transition = "transform 0.1s ease-out";
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transition = "transform 0.4s ease-out";
      card.style.transform = "perspective(800px) rotateX(0) rotateY(0) translateY(0)";
    });
  });
}

// ── HEART BOUNCE (on save/favorite click) ────────────────
export function triggerHeartBounce(el: HTMLElement) {
  el.classList.add("animate-heart-bounce");
  setTimeout(() => el.classList.remove("animate-heart-bounce"), 400);
}

// ── SKELETON LOADING STATES ──────────────────────────────
export function showSkeletons(containerId: string, count: number = 6) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear any existing cards
  container.innerHTML = "";
  
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "bg-surface-alt rounded-xl overflow-hidden border border-border animate-shimmer";
    skeleton.innerHTML = `
      <div class="aspect-[4/3] bg-white/50"></div>
      <div class="p-4 space-y-3">
        <div class="h-4 bg-white/50 rounded w-3/4"></div>
        <div class="grid grid-cols-2 gap-2">
          <div class="h-3 bg-white/50 rounded w-full"></div>
          <div class="h-3 bg-white/50 rounded w-full"></div>
          <div class="h-3 bg-white/50 rounded w-full"></div>
          <div class="h-3 bg-white/50 rounded w-full"></div>
        </div>
        <div class="h-6 bg-white/50 rounded w-1/3 mt-4"></div>
      </div>
    `;
    container.appendChild(skeleton);
  }
}

export function hideSkeletons(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(".animate-shimmer").forEach(el => el.remove());
}

// ── LINK PREFETCH ON NAV HOVER ───────────────────────────
export function initLinkPrefetch() {
  const stockLinks = document.querySelectorAll('a[href="/vehicles"]');
  const style = document.createElement("style");
  style.textContent = `link[rel="prefetch"], link[rel="preload"] { transition: opacity 0.3s ease; }`;
  document.head.appendChild(style);
  
  stockLinks.forEach((link) => {
    let prefetchDone = false;
    let timer: ReturnType<typeof setTimeout>;
    
    link.addEventListener("mouseenter", () => {
      if (prefetchDone) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const linkEl = document.createElement("link");
        linkEl.rel = "prefetch";
        linkEl.href = "/vehicles";
        document.head.appendChild(linkEl);
        prefetchDone = true;
      }, 200); // 200ms debounce before prefetching
    });
  });
}

// ── COUNTER ANIMATION ────────────────────────────────────
export function animateCounter(el: HTMLElement, target: number, duration: number = 1200) {
  const start = 0;
  const startTime = performance.now();
  
  function tick(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(start + (target - start) * eased);
    
    el.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  
  requestAnimationFrame(tick);
}

// ── INIT ALL ─────────────────────────────────────────────
export function initShowroom() {
  initDarkMode();
  initParallax();
  initCardTilt();
  initLinkPrefetch();
  assignViewTransitionNames();
}

// Auto-init on DOM ready
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initShowroom();
  });
}
