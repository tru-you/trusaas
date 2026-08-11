import { useEffect, useState } from 'react';

const DESKTOP_MIN_WIDTH = 768;

function measure(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches;
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(measure);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isDesktop;
}
