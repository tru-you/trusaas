import React from 'react';
import { Battery, Wifi, Signal, Sparkles } from 'lucide-react';
import { isMobileViewport, isStandaloneDisplay } from '../lib/pwa';
import PwaInstallBanner from './PwaInstallBanner';
import QRCode from 'qrcode';
import trulensLogo from '../assets/images/trulens-wordmark.png';

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
  const [qrUrl, setQrUrl] = React.useState('');

  React.useEffect(() => {
    if (nativeMode) return;
    const url = window.location.href;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 250,
      color: {
        dark: '#06080D',
        light: '#ffffff',
      },
    })
      .then(setQrUrl)
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [nativeMode]);

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
      <div className="relative flex flex-col w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] bg-neutral-950 text-[#E8EAE6] font-sans select-none overflow-hidden">
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
        <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0 bg-neutral-950" />
      </div>
    );
  }

  // ── Desktop demo: phone frame ─────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 min-h-screen bg-[#06080D] text-[#E8EAE6] p-6 select-none font-sans overflow-y-auto relative">
      {/* Soft background glow highlights */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#4FE3DC]/[0.05] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-[#4FE3DC]/[0.03] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-[400px] aspect-[9/19.5] bg-neutral-950 rounded-[52px] p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05),0_0_40px_10px_rgba(30,58,138,0.25)] border border-neutral-800 flex flex-col justify-stretch z-10 shrink-0">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6.5 bg-neutral-950 rounded-full z-50 flex items-center justify-between px-4 border border-neutral-800 shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-blue-900 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-blue-500 opacity-60"></div>
          </div>
          <div className="w-12 h-1 bg-neutral-900 rounded-full"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
        </div>

        <div className="absolute top-6.5 left-1/2 -translate-x-1/2 w-32 h-6.5 rounded-full z-50 pointer-events-none bg-[#4FE3DC]/[0.04] opacity-30"></div>

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

          <div className="relative flex-1 w-full bg-[#06080D] overflow-hidden flex flex-col items-center justify-between p-6">
            {/* Mock camera view grid lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20 border border-neutral-800">
              <div className="border-r border-b border-neutral-800"></div>
              <div className="border-r border-b border-neutral-800"></div>
              <div className="border-b border-neutral-800"></div>
              <div className="border-r border-b border-neutral-800"></div>
              <div className="border-r border-b border-neutral-800"></div>
              <div className="border-b border-neutral-800"></div>
              <div className="border-r border-neutral-800"></div>
              <div className="border-r border-neutral-800"></div>
              <div></div>
            </div>

            {/* Simulated target overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 border border-[#4FE3DC]/40 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 border-t-2 border-l-2 border-[#4FE3DC] absolute top-[-2px] left-[-2px]"></div>
              <div className="w-4 h-4 border-t-2 border-r-2 border-[#4FE3DC] absolute top-[-2px] right-[-2px]"></div>
              <div className="w-4 h-4 border-b-2 border-l-2 border-[#4FE3DC] absolute bottom-[-2px] left-[-2px]"></div>
              <div className="w-4 h-4 border-b-2 border-r-2 border-[#4FE3DC] absolute bottom-[-2px] right-[-2px]"></div>
              <span className="text-[10px] text-[#4FE3DC] uppercase tracking-wider font-semibold bg-[#06080D]/80 px-2 py-0.5 rounded">Align Vehicle</span>
            </div>

            {/* Mock Header */}
            <div className="w-full relative z-10 flex justify-between items-center">
              <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-900/80 px-2 py-1 rounded border border-neutral-800">
                LENS v1.0
              </span>
              <span className="text-[10px] font-semibold text-[#4FE3DC] bg-[#4FE3DC]/10 px-2 py-1 rounded border border-[#4FE3DC]/20 tracking-wider">
                YARD MODE
              </span>
            </div>

            {/* Mock Shutter area */}
            <div className="w-full relative z-10 flex flex-col items-center gap-4">
              <span className="text-[12px] text-neutral-300 font-medium text-center bg-black/60 px-3 py-1.5 rounded-full border border-neutral-800 backdrop-blur-md max-w-[200px]">
                Scan QR to start capturing
              </span>
              <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center bg-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <div className="w-12 h-12 rounded-full bg-white/10"></div>
              </div>
            </div>
          </div>

          <div className="h-6 bg-neutral-950 flex items-center justify-center shrink-0 z-40">
            <div className="w-32 h-1 bg-neutral-700 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Side Control panel with QR Code */}
      <div className="w-full max-w-[360px] p-8 rounded-3xl border border-neutral-800 bg-[#0A0D14]/80 backdrop-blur-xl relative flex flex-col items-center text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden z-10">
        {/* Background soft pools of light to match Login screen style */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute top-[-20%] right-[-20%] w-48 h-48 bg-[#4FE3DC]/[0.06] blur-[60px] rounded-full" />
          <div className="absolute bottom-[-20%] left-[-20%] w-48 h-48 bg-[#4FE3DC]/[0.03] blur-[60px] rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center w-full">
          <img src="/icons/icon-512.png" alt="TruLens" className="h-16 w-16 object-contain mx-auto mb-6 drop-shadow-[0_4px_16px_rgba(79,227,220,0.35)]" />
          <h2 className="text-[20px] font-semibold text-[#E8EAE6] tracking-[-0.01em]">
            Scan with phone to open TruLens
          </h2>
          <p className="mt-2 text-[13px] text-[rgba(232,234,230,0.55)] leading-relaxed max-w-[260px]">
            Capture stock directly in the yard using your mobile camera.
          </p>

          {/* QR Code Container with subtle cyan border and glow */}
          <div className="my-6 p-4 rounded-2xl bg-white/5 border border-[#4FE3DC]/30 shadow-[0_0_20px_0_rgba(79,227,220,0.15)] flex items-center justify-center">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR Code to open TruLens"
                className="w-48 h-48 rounded-xl object-contain [filter:brightness(0.95)]"
              />
            ) : (
              <div className="w-48 h-48 rounded-xl bg-neutral-900 animate-pulse flex items-center justify-center">
                <span className="text-[12px] text-neutral-500 font-mono">Generating QR...</span>
              </div>
            )}
          </div>

          {/* Step list */}
          <ol className="text-left w-full space-y-3.5 text-[13px] text-[rgba(232,234,230,0.75)]">
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4FE3DC]/10 text-[#4FE3DC] text-[11px] font-bold shrink-0 mt-0.5">1</span>
              <span>Open camera on your mobile device.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4FE3DC]/10 text-[#4FE3DC] text-[11px] font-bold shrink-0 mt-0.5">2</span>
              <span>Scan the QR code above.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4FE3DC]/10 text-[#4FE3DC] text-[11px] font-bold shrink-0 mt-0.5">3</span>
              <span>Follow the link to launch TruLens.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4FE3DC]/10 text-[#4FE3DC] text-[11px] font-bold shrink-0 mt-0.5">4</span>
              <span>Start capturing professional vehicle photos.</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
