import React from 'react';
import { Battery, Wifi, Signal, Sparkles, Monitor } from 'lucide-react';
import { isMobileViewport, isStandaloneDisplay, isDesktopManager } from '../lib/pwa';
import PwaInstallBanner from './PwaInstallBanner';

interface MobileDeviceProps {
  children: React.ReactNode;
}

/**
 * Three modes:
 * - Phone / tablet (field worker): full-bleed edge-to-edge app
 * - Desktop (manager): wide layout with manager chrome
 * - Neither triggers the old phone-mockup demo frame
 */
export default function MobileDevice({ children }: MobileDeviceProps) {
  const [time, setTime] = React.useState('');
  const [nativeMode, setNativeMode] = React.useState(() => isStandaloneDisplay() || isMobileViewport());
  const [desktopMode, setDesktopMode] = React.useState(() => isDesktopManager());

  React.useEffect(() => {
    const update = () => {
      setNativeMode(isStandaloneDisplay() || isMobileViewport());
      setDesktopMode(isDesktopManager());
    };
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

  // ── Phone / tablet (field worker): full screen ────────────────────
  if (nativeMode) {
    return (
      <div className="relative flex flex-col w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-neutral-950 text-[#E8EAE6] font-sans select-none overflow-hidden">
        <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {children}
          <PwaInstallBanner />
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0 bg-neutral-950" />
      </div>
    );
  }

  // ── Desktop (manager): wide layout ────────────────────────────────
  if (desktopMode) {
    const dealerName = (typeof localStorage !== 'undefined' && localStorage.getItem('trulens_dealer_name')) || 'TruInspect';
    return (
      <div className="ti-desktop flex flex-col w-full h-screen min-h-screen bg-neutral-950 text-[#E8EAE6] font-sans overflow-hidden">
        {/* Manager top bar */}
        <div className="ti-desktop-topbar flex items-center justify-between px-5 h-12 shrink-0 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm z-50">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-bold tracking-tight text-[#E8EAE6]">{dealerName}</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[.18em] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
              Manager
            </span>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-neutral-500">
            <span className="font-mono">{time}</span>
            <div className="flex items-center gap-1.5">
              <Monitor size={13} className="text-cyan-400" />
              <span className="text-neutral-400">Desktop</span>
            </div>
          </div>
        </div>

        {/* Content area — full width, the app views render here */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Fallback: phone-frame demo (unlikely — desktop without fine pointer) ──
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 md:p-8 select-none font-sans overflow-hidden">
      <div className="relative w-full max-w-[412px] md:max-w-[500px] lg:max-w-[550px] aspect-[9/19.5] bg-neutral-950 rounded-[52px] p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05),0_0_40px_10px_rgba(30,58,138,0.25)] border border-neutral-800 flex flex-col justify-stretch">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6.5 bg-neutral-950 rounded-full z-50 flex items-center justify-between px-4 border border-neutral-800 shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-blue-900 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-blue-500 opacity-60"></div>
          </div>
          <div className="w-12 h-1 bg-neutral-900 rounded-full"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
        </div>

        <div className="absolute top-6.5 left-1/2 -translate-x-1/2 w-32 h-6.5 rounded-full z-50 pointer-events-none bg-gradient-to-r from-blue-500/10 via-transparent to-cyan-500/10 opacity-30"></div>

        <div className="absolute top-28 -left-1 w-1 h-12 bg-neutral-800 rounded-r-md border-r border-neutral-700"></div>
        <div className="absolute top-44 -left-1 w-1 h-16 bg-neutral-800 rounded-r-md border-r border-neutral-700"></div>
        <div className="absolute top-64 -left-1 w-1 h-16 bg-neutral-800 rounded-r-md border-r border-neutral-700"></div>
        <div className="absolute top-36 -right-1 w-1 h-16 bg-neutral-800 rounded-l-md border-l border-neutral-700"></div>

        <div className="relative w-full h-full bg-neutral-950 rounded-[40px] overflow-hidden flex flex-col border border-neutral-800 shadow-2xl">
          <div className="h-12 bg-neutral-950 text-[#E8EAE6] px-7 flex items-center justify-between text-[13px] font-semibold tracking-wider z-40 shrink-0">
            <span className="text-neutral-200">{time}</span>
            <div className="flex items-center gap-2 text-neutral-300">
              <Signal size={12} className="text-neutral-400" />
              <span className="text-[13px] text-neutral-400 font-bold">5G</span>
              <Wifi size={12} className="text-indigo-400" />
              <Battery size={14} className="text-emerald-400 fill-emerald-500/20" />
            </div>
          </div>

          <div className="relative flex-1 w-full bg-neutral-950 overflow-hidden flex flex-col">
            {children}
            <PwaInstallBanner />
          </div>

          <div className="h-6 bg-neutral-950 flex items-center justify-center shrink-0 z-40">
            <div className="w-32 h-1 bg-neutral-700 rounded-full"></div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[13px] font-mono text-slate-500 flex items-center gap-2 max-w-md text-center">
        <Sparkles size={12} className="text-indigo-400 shrink-0" />
        Desktop preview · On a phone, open this URL and install TruInspect to Home Screen
      </p>
    </div>
  );
}
