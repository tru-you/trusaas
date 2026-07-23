import React from 'react';
import { Smartphone, Battery, Wifi, Signal, Sparkles } from 'lucide-react';

interface MobileDeviceProps {
  children: React.ReactNode;
}

export default function MobileDevice({ children }: MobileDeviceProps) {
  // Get current local time format for phone top bar
  const [time, setTime] = React.useState('');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 md:p-8 select-none font-sans overflow-hidden">
      {/* Outer Glow Wrapper */}
      <div className="relative w-full max-w-[412px] md:max-w-[500px] lg:max-w-[550px] aspect-[9/19.5] bg-neutral-950 rounded-[52px] p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05),0_0_40px_10px_rgba(30,58,138,0.25)] border border-neutral-800 flex flex-col justify-stretch">
        
        {/* Speaker & Sensor Notch / Dynamic Island */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6.5 bg-neutral-950 rounded-full z-50 flex items-center justify-between px-3.5 border border-neutral-800 shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-blue-900 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-blue-500 opacity-60"></div>
          </div>
          <div className="w-12 h-1 bg-neutral-900 rounded-full"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-900"></div>
        </div>

        {/* Dynamic Island Highlight Pill */}
        <div className="absolute top-6.5 left-1/2 -translate-x-1/2 w-32 h-6.5 rounded-full z-50 hover:scale-105 transition-transform duration-300 pointer-events-none bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-30"></div>

        {/* Physical Volume Buttons */}
        <div className="absolute top-28 -left-1 w-1 h-12 bg-neutral-800 rounded-r-md border-r border-neutral-700"></div>
        <div className="absolute top-44 -left-1 w-1 h-16 bg-neutral-800 rounded-r-md border-r border-neutral-700"></div>
        <div className="absolute top-64 -left-1 w-1 h-16 bg-neutral-800 rounded-r-md border-r border-neutral-700"></div>
        
        {/* Physical Power Button */}
        <div className="absolute top-36 -right-1 w-1 h-16 bg-neutral-800 rounded-l-md border-l border-neutral-700"></div>

        {/* Screen Bezel container */}
        <div className="relative w-full h-full bg-neutral-950 rounded-[40px] overflow-hidden flex flex-col border border-neutral-800 shadow-2xl">
          
          {/* Status Bar */}
          <div className="h-12 bg-neutral-950 text-white px-7 flex items-center justify-between text-[13px] font-semibold tracking-wider z-40 shrink-0">
            {/* Clock */}
            <span className="text-neutral-200">{time}</span>
            
            {/* Status Icons */}
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Signal size={12} className="text-neutral-400" />
              <span className="text-[13px] text-neutral-400 font-bold">5G</span>
              <Wifi size={12} className="text-indigo-400" />
              <Battery size={14} className="text-emerald-400 fill-emerald-500/20" />
            </div>
          </div>

          {/* Main App Canvas */}
          <div className="relative flex-1 w-full bg-neutral-950 overflow-hidden flex flex-col">
            {children}
          </div>

          {/* Bottom Virtual Home Indicator Bar */}
          <div className="h-6 bg-neutral-950 flex items-center justify-center shrink-0 z-40">
            <div className="w-32 h-1 bg-neutral-700 rounded-full hover:bg-neutral-500 transition-colors duration-300 cursor-pointer"></div>
          </div>
        </div>
      </div>
      
      {/* Visual Support Info */}
      <p className="mt-4 text-xs font-mono text-slate-500 flex items-center gap-1.5">
        <Sparkles size={12} className="text-indigo-400 animate-pulse" />
        Car Dealer Photography Studio Pro • Interactive Device Viewport
      </p>
    </div>
  );
}
