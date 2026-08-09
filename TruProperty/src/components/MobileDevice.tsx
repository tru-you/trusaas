import React from 'react';
import { Battery, Wifi, Signal, Sparkles } from 'lucide-react';
import { isMobileViewport, isStandaloneDisplay } from '../lib/pwa';
import PwaInstallBanner from './PwaInstallBanner';

interface MobileDeviceProps {
  children: React.ReactNode;
}

/**
 * Desktop: framed phone mock for demos.
 * Real phone / installed PWA: full-bleed edge-to-edge app (no fake bezel).
 */
export default function MobileDevice({ children }: MobileDeviceProps) {
  const [time, setTime] = React.useState('');
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

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Real phone / PWA: full screen ─────────────────────────────────
  if (nativeMode) {
    return (
      <div className="relative flex flex-col w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-white text-[#0A1420] font-sans select-none overflow-hidden">
        {/* A 40px strip used to sit here whenever the app was open in a browser
            rather than installed. It carried the wordmark and the words "Yard
            mode" — the wordmark is repeated in the header directly below it, and
            "Yard mode" is not a state the app can leave. On a 640px Android that
            was 6% of the screen spent saying the name of the app twice.

            The install prompt it sat above is PwaInstallBanner, which is still
            rendered below and says something actionable. */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {children}
          <PwaInstallBanner />
        </div>
        {/* Safe area home indicator padding on installed iOS */}
        <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0 bg-white" />
      </div>
    );
  }

  // ── Desktop demo: phone frame ─────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#E8ECF0] p-4 md:p-8 select-none font-sans overflow-hidden">
      <div className="relative w-full max-w-[412px] md:max-w-[500px] lg:max-w-[550px] aspect-[9/19.5] bg-neutral-950 rounded-[52px] p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05),0_0_40px_10px_rgba(30,58,138,0.25)] border border-[rgba(10,20,32,0.10)] flex flex-col justify-stretch">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6.5 bg-neutral-950 rounded-full z-50 flex items-center justify-between px-4 border border-[rgba(10,20,32,0.10)] shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-blue-900 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-blue-500 opacity-60"></div>
          </div>
          <div className="w-12 h-1 bg-neutral-900 rounded-full"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
        </div>

        <div className="absolute top-6.5 left-1/2 -translate-x-1/2 w-32 h-6.5 rounded-full z-50 pointer-events-none bg-gradient-to-r from-blue-500/10 via-transparent to-cyan-500/10 opacity-30"></div>

        <div className="absolute top-28 -left-1 w-1 h-12 bg-neutral-800 rounded-r-md border-r border-[rgba(10,20,32,0.15)]"></div>
        <div className="absolute top-44 -left-1 w-1 h-16 bg-neutral-800 rounded-r-md border-r border-[rgba(10,20,32,0.15)]"></div>
        <div className="absolute top-64 -left-1 w-1 h-16 bg-neutral-800 rounded-r-md border-r border-[rgba(10,20,32,0.15)]"></div>
        <div className="absolute top-36 -right-1 w-1 h-16 bg-neutral-800 rounded-l-md border-l border-[rgba(10,20,32,0.15)]"></div>

        <div className="relative w-full h-full bg-white rounded-[40px] overflow-hidden flex flex-col border border-[rgba(10,20,32,0.10)] shadow-2xl">
          <div className="h-12 bg-white text-[#0A1420] px-7 flex items-center justify-between text-[13px] font-semibold tracking-wider z-40 shrink-0">
            <span className="text-[rgba(10,20,32,0.85)]">{time}</span>
            <div className="flex items-center gap-2 text-[rgba(10,20,32,0.72)]">
              <Signal size={12} className="text-[rgba(10,20,32,0.55)]" />
              <span className="text-[13px] text-[rgba(10,20,32,0.55)] font-bold">5G</span>
              <Wifi size={12} className="text-[#0E9D98]" />
              <Battery size={14} className="text-emerald-400 fill-emerald-500/20" />
            </div>
          </div>

          <div className="relative flex-1 w-full bg-white overflow-hidden flex flex-col">
            {children}
            <PwaInstallBanner />
          </div>

          <div className="h-6 bg-white flex items-center justify-center shrink-0 z-40">
            <div className="w-32 h-1 bg-[rgba(10,20,32,0.20)] rounded-full"></div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[13px] font-mono text-[rgba(10,20,32,0.45)] flex items-center gap-2 max-w-md text-center">
        <Sparkles size={12} className="text-[#0E9D98] shrink-0" />
        Desktop preview · On a phone, open this URL and install Prop Inspect to Home Screen
      </p>
    </div>
  );
}
