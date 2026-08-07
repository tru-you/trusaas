import { useEffect, useState } from 'react';

/** Width at which DocHub's desktop-only surfaces appear. Matches the mobile
 *  breakpoint in ./pwa, but deliberately does not reuse `isMobileViewport()`:
 *  that also returns true for an INSTALLED app, so a TruFlow installed as a
 *  desktop PWA reported itself as mobile and lost DocHub entirely on a 27"
 *  monitor. Screen size is the only thing that matters here. */
const DESKTOP_MIN_WIDTH = 901;

function measure(): boolean {
  if (typeof window === 'undefined') return true; // SSR-safe: assume desktop
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches;
}

/** True when there is enough screen for DocHub's desktop-only surfaces.
 *
 *  DocHub gates on this so its tab, stage strip and settings panel never render
 *  on a phone — and, because the components behind them are lazy-loaded, so
 *  their chunks are never fetched there either. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(measure);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    // `change` on the query itself covers resize, rotation and zoom in one
    // signal, and fires only when the answer actually flips.
    mq.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isDesktop;
}
