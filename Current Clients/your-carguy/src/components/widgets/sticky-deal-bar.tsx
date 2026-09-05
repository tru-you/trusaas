"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import type { Vehicle } from "@/data/mock-stock";
import { cn, formatPrice, formatNum } from "@/lib/utils";

interface StickyDealBarProps {
  vehicle: Vehicle;
}

export default function StickyDealBar({ vehicle }: StickyDealBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show after scrolling past hero (~400px)
  useEffect(() => {
    if (dismissed) return;
    
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissed]);

  const dismiss = () => {
    setDismissed(true);
    setVisible(false);
    localStorage.setItem(`ycg-deal-dismissed-${vehicle.stockNo}`, "true");
  };

  if (!visible && !dismissed) return null;
  if (dismissed) return null;

  const whatsappText = `Hi! I'm interested in your ${vehicle.fullName} (${formatPrice(vehicle.price)}). Is it still available?`;
  const whatsappUrl = `https://wa.me/27834659921?text=${encodeURIComponent(whatsappText)}`;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out",
      visible ? "translate-y-0 slide-down" : "-translate-y-full",
    )}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative bg-white/80 backdrop-blur-lg border-b border-border shadow-xl rounded-b-2xl overflow-hidden">
          {/* Animated gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand via-brand-dark to-brand opacity-80" />
          
          <div className="flex items-center gap-3 py-2.5 sm:py-3">
            {/* Vehicle thumbnail */}
            <Link href={`/vehicle/${vehicle.stockNo}`} className="shrink-0 relative w-12 h-8 sm:w-16 sm:h-10 rounded-lg overflow-hidden">
              <img src={vehicle.images[0]} alt="" className="w-full h-full object-cover" />
            </Link>
            
            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{vehicle.fullName.split(" ").slice(0, 4).join(" ")}</p>
              <p className="text-xs text-ink-muted truncate">{formatNum(vehicle.mileage)} km · {vehicle.year}</p>
            </div>
            
            {/* Price - mobile first */}
            <div className="text-right shrink-0 hidden sm:block">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">Our Price</div>
              <div className="text-base font-display font-bold text-brand">{formatPrice(vehicle.price)}</div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors"
              >
                WhatsApp
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={dismiss}
                className="h-8 w-8 rounded-full hover:bg-black/5 flex items-center justify-center text-ink-muted"
                aria-label="Dismiss deal bar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
