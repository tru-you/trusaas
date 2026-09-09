import React, { useState, useEffect } from 'react';
import { Phone, Clock, MapPin, Menu, X, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Utility Bar */}
      <div className="bg-ink text-gray-400 text-xs border-b border-white/10 py-2.5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-6 gap-y-1 font-mono tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5 text-white/90">
              <MapPin className="w-3.5 h-3.5 text-brand-brand-gold" />
              <span>257 Caledon Street, Kariega</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-blue" />
              <span>Mon–Fri 08:00–17:30 · Sat 08:00–13:00</span>
            </span>
          </div>
          <a
            href="tel:+27618759389"
            className="flex items-center gap-1.5 font-mono text-white hover:text-brand-brand-gold transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-brand-blue" />
            <span>+27 61 875 9389</span>
          </a>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-ink/90 backdrop-blur-md border-b border-white/10 shadow-lg'
            : 'bg-ink/40 backdrop-blur-sm border-b border-white/5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <a href="#top" className="flex items-center gap-3 group">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-brand-blue to-brand-blue-deep flex items-center justify-center font-disp font-extrabold text-base tracking-tighter text-white shadow-md shadow-brand-blue/20 group-hover:scale-105 transition-transform duration-300">
                CC
              </div>
              <div className="leading-tight">
                <span className="font-disp font-bold text-base sm:text-lg text-white tracking-wide block">
                  CARS ON CALEDON
                </span>
                <span className="font-mono text-[9px] tracking-[0.24em] text-gray-400 block uppercase">
                  Quality Pre-Owned
                </span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-300">
              <a href="#inventory" className="hover:text-white transition-colors relative py-2 group">
                Buy a Car
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-brand-gold transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a href="#sell" className="hover:text-white transition-colors relative py-2 group">
                Sell / Trade-In
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-blue transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a href="#finance" className="hover:text-white transition-colors relative py-2 group">
                Finance
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-blue transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a href="#why" className="hover:text-white transition-colors relative py-2 group">
                Why Us
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-blue transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a href="#visit" className="hover:text-white transition-colors relative py-2 group">
                Visit Us
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-blue transition-all duration-300 group-hover:w-full"></span>
              </a>
            </nav>

            {/* CTAs */}
            <div className="hidden lg:flex items-center gap-4">
              <a
                href="#finance"
                className="text-white hover:text-brand-blue transition-all text-xs font-semibold px-4 py-2 border border-white/20 hover:border-white rounded-full"
              >
                Apply for Finance
              </a>
              <a
                href="https://wa.me/27618759389"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-wa hover:bg-emerald-600 text-white font-semibold text-xs px-4 py-2 rounded-full hover:scale-105 transition-transform"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                WhatsApp Us
              </a>
            </div>

            {/* Burger Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden bg-ink-2 border-t border-white/10"
            >
              <div className="px-4 py-4 space-y-3">
                <a
                  href="#inventory"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Buy a Car
                </a>
                <a
                  href="#sell"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Sell / Trade-In
                </a>
                <a
                  href="#finance"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Finance
                </a>
                <a
                  href="#why"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Why Us
                </a>
                <a
                  href="#visit"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Visit Us
                </a>
                <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
                  <a
                    href="#finance"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center text-white text-xs font-semibold px-4 py-3 border border-white/20 rounded-full"
                  >
                    Apply for Finance
                  </a>
                  <a
                    href="https://wa.me/27618759389"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-wa hover:bg-emerald-600 text-white font-semibold text-xs px-4 py-3 rounded-full"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    WhatsApp Us
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
