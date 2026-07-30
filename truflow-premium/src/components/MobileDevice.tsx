import React from 'react';
import { isMobileViewport, isStandaloneDisplay } from '../lib/pwa';
import PwaInstallBanner from './PwaInstallBanner';

interface MobileDeviceProps {
  children: React.ReactNode;
}

export default function MobileDevice({ children }: MobileDeviceProps) {
  const [nativeMode, setNativeMode] = React.useState(() => isStandaloneDisplay() || isMobileViewport());

  React.useEffect(() => {
    const update = () => setNativeMode(isStandaloneDisplay() || isMobileViewport());
    update();
    window.addEventListener('resize', update);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      mq.removeEventListener?.('change', update);
    };
  }, []);

  if (nativeMode) {
    return (
      <div className="relative flex flex-col w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-neutral-950 text-[#E8EAE6] font-sans select-none overflow-hidden">
        <div className="relative flex-1 min-h-0 w-full overflow-y-auto flex flex-col">
          {children}
          <PwaInstallBanner />
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0 bg-neutral-950" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full min-h-screen bg-neutral-950 text-[#E8EAE6] font-sans select-none">
      {children}
      <PwaInstallBanner />
    </div>
  );
}
