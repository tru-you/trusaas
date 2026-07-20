/** Pointer-driven glass / 3D tilt for Flow cards & panels */

const SELECTOR = ".card, .v-card, .pipeline-card, .stat-card, .glass-panel, .glass-nav-item";

function onMove(e: PointerEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.(SELECTOR) as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 100;
  const y = ((e.clientY - r.top) / Math.max(r.height, 1)) * 100;
  el.style.setProperty("--mx", `${x}%`);
  el.style.setProperty("--my", `${y}%`);

  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  const rx = (py * -6).toFixed(2);
  const ry = (px * 8).toFixed(2);
  if (el.classList.contains("v-card") || el.classList.contains("stat-card") || el.classList.contains("tilt-3d")) {
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--tz", "12px");
  }
}

/** Call once from App after mount */
export function initGlassMotion(root: Document | HTMLElement = document) {
  const host = root instanceof Document ? root.body : root;
  if (!host || (host as any).__glassMotion) return () => {};
  (host as any).__glassMotion = true;

  const move = (e: PointerEvent) => onMove(e);

  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener(
    "pointerout",
    (e) => {
      const related = (e as PointerEvent).relatedTarget as Node | null;
      const card = (e.target as HTMLElement)?.closest?.(SELECTOR) as HTMLElement | null;
      if (card && related && !card.contains(related)) {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--tz", "0px");
      }
    },
    { passive: true }
  );

  return () => {
    host.removeEventListener("pointermove", move);
    (host as any).__glassMotion = false;
  };
}
