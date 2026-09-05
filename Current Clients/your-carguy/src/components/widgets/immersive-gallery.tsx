"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImmersiveGalleryProps {
  images: string[];
  altPrefix?: string;
}

export default function ImmersiveGallery({ 
  images,
  altPrefix = "Vehicle photo"
}: ImmersiveGalleryProps) {
  const [idx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(images.length - 1, i + 1));

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen]);

  // Touch swipe support
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  if (images.length === 0) return null;

  return (
    <>
      {/* Thumbnail row */}
      <div className="flex gap-1.5 p-3 overflow-x-auto no-scrollbar border-b border-border">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setLightboxOpen(true)}
            className={cn(
              "shrink-0 relative aspect-video w-20 rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
              i === idx ? "border-brand scale-105" : "border-transparent opacity-60 hover:opacity-100",
            )}
          >
            <Image src={img} alt={`${altPrefix} thumbnail ${i + 1}`} fill className="object-cover" />
          </button>
        ))}
      </div>

      {/* Main image area */}
      <div
        className="relative aspect-[4/3] sm:aspect-[16/9] bg-surface-alt group"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={images[idx]}
          alt={`${altPrefix} ${idx + 1}`}
          fill
          className="object-cover"
          priority
        />

        {/* Nav arrows — appear on hover (desktop) or always visible (mobile) */}
        {idx > 0 && (
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < images.length - 1 && (
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Open lightbox button */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
          aria-label="View full size"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Counter badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-xs font-medium text-white">{idx + 1} / {images.length}</span>
        </div>
      </div>

      {/* Full-screen lightbox overlay */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Lightbox header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <span className="text-sm text-white font-medium">{idx + 1} / {images.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
              className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Close lightbox"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lightbox image with pinch-zoom feel */}
          <div
            className="flex-1 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[idx]}
              alt={`${altPrefix} full size`}
              width={1400}
              height={900}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Lightbox navigation */}
          {idx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {idx < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Thumbnail strip at bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-xl bg-black/60 backdrop-blur-sm overflow-x-auto max-w-[80vw]">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={cn(
                  "shrink-0 relative aspect-video w-16 rounded-md overflow-hidden border-2 transition-all",
                  i === idx ? "border-white" : "border-transparent opacity-50",
                )}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
