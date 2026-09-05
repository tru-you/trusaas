"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Phone, Mail, Sun, Moon, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Stock", href: "/vehicles" },
  { label: "Sell Your Vehicle", href: "/sell-your-vehicle" },
  { label: "About Us", href: "/about-us" },
  { label: "Testimonials", href: "/testimonials" },
] as const;

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Detect scroll for glass morphism effect on header
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load saved cars count
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("ycg-saved-cars") || "[]");
    setSavedCount(saved.length);
  }, []);

  return (
    <>
      {/* Top contact bar */}
      <div className="bg-[#060608] text-white/50 text-xs sm:text-sm border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="tel:0834659921" className="hover:text-brand transition-colors">
              083 465 9921
            </a>
            <span className="text-white/10 hidden sm:inline">|</span>
            <a href="tel:0410070393" className="hover:text-brand transition-colors hidden sm:inline">
              041 007 0393
            </a>
          </div>
          <p className="hidden md:block text-white/30 tracking-wide">17 Burt Drive, Newton Park · Mon–Fri 07:30–17:30 · Sat 08:00–13:00</p>
        </div>
      </div>

      {/* Main header — dark glass morphism */}
      <header className={cn(
        "sticky top-0 z-50 backdrop-blur-xl transition-all duration-300",
        scrolled
          ? "bg-[#0A0A0C]/90 border-b border-white/[0.06] shadow-lg shadow-black/20"
          : "bg-[#0A0A0C]/70 border-b border-white/[0.03]"
      )}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center shadow-md shadow-brand-glow">
              <span className="text-white font-display font-bold text-base">Y</span>
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-display font-bold text-white text-base">Your Car Guy</div>
              <div className="text-[9px] tracking-[0.2em] uppercase text-white/25">
                Newton Park
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all",
                  link.href === "/" && "text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side CTA */}
          <div className="flex items-center gap-2">
            {/* Saved cars badge */}
            {savedCount > 0 && (
              <button
                className="relative h-10 w-10 rounded-lg hover:bg-white/[0.04] transition-colors flex items-center justify-center text-white/40"
                aria-label={`${savedCount} saved cars`}
              >
                <Bookmark className="h-4.5 w-4.5" />
                <span className="absolute -top-1 -right-1 h-4.5 w-4.5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
                  {savedCount}
                </span>
              </button>
            )}

            <Link href="/vehicles">
              <Button className="btn-premium btn-brand h-10 px-5 rounded-xl text-sm">
                Browse Stock
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 lg:hidden text-white/60"
              onClick={() => setOpen(!open)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav panel */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[#0A0A0C] shadow-2xl p-6 animate-scale-in border-l border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="space-y-1 pt-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-4 py-3 text-base font-medium text-white/50 hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors",
                    link.href === "/" && "text-white",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 pt-6 border-t border-white/[0.06] space-y-3">
              <a
                href="tel:0834659921"
                className="flex items-center gap-3 text-white/40 hover:text-brand transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span className="text-sm">083 465 9921</span>
              </a>
              <a
                href="mailto:sales@yourcarguy.co.za"
                className="flex items-center gap-3 text-white/40 hover:text-brand transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span className="text-sm">sales@yourcarguy.co.za</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
