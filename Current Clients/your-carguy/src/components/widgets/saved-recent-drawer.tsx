"use client";

import Link from "next/link";
import Image from "next/image";
import { X, Car, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Vehicle } from "@/data/mock-stock";
import { formatPrice } from "@/lib/utils";

interface SavedRecentDrawerProps {
  mode: "saved" | "recent";
  vehicles?: Vehicle[];
  onClose?: () => void;
}

export default function SavedRecentDrawer({ 
  mode, 
  vehicles = [], 
  onClose 
}: SavedRecentDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const items = mode === "saved" ? vehicles : vehicles;
  const title = mode === "saved" ? "Saved Cars" : "Recently Viewed";
  const icon = mode === "saved" ? "♡" : "↻";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Check localStorage for active state
  useEffect(() => {
    const stored = localStorage.getItem(`ycg-drawer-${mode}`);
    setIsOpen(stored === "true");
  }, [mode]);

  const open = () => {
    setIsOpen(true);
    localStorage.setItem(`ycg-drawer-${mode}`, "true");
  };

  const close = () => {
    setIsOpen(false);
    localStorage.setItem(`ycg-drawer-${mode}`, "false");
    onClose?.();
  };

  return (
    <>
      {/* Trigger button — shown in header */}
      <button
        onClick={open}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-muted text-brand text-sm font-medium hover:bg-brand/10 transition-colors"
        aria-label={`${title}`}
      >
        <span>{icon}</span>
        <span>{items.length}</span>
      </button>

      {/* Slide-out drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[55]" onClick={close}>
          <div 
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-surface shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display font-bold text-lg">{title}</h2>
              <button onClick={close} className="h-8 w-8 rounded-full hover:bg-black/5 flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto h-[calc(100%-64px)]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Car className="h-12 w-12 text-ink-subtle mb-3" />
                  <p className="text-ink-muted text-sm">No {mode} cars yet</p>
                  <Link href="/vehicles" onClick={close} className="mt-3 text-sm text-brand font-medium hover:underline">
                    Browse stock
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border-faint">
                  {items.map((v) => (
                    <Link
                      key={v.stockNo}
                      href={`/vehicle/${v.stockNo}`}
                      onClick={close}
                      className="flex items-center gap-3 p-3 hover:bg-surface-alt transition-colors"
                    >
                      <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0">
                        <Image src={v.images[0]} alt="" fill className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{v.fullName.split(" ").slice(0, 4).join(" ")}</p>
                        <p className="text-xs text-ink-muted">{formatPrice(v.price)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-muted shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
