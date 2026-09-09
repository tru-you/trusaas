import React from 'react';
import { Phone, Mail, MapPin, Facebook, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-ink text-gray-400 border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-white/5">
          {/* About Brand */}
          <div className="lg:col-span-4 space-y-6">
            <a href="#top" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-brand-blue-deep border border-brand-brand-gold/20 flex items-center justify-center font-disp font-extrabold text-base text-white tracking-tighter">
                CC
              </div>
              <div className="leading-tight text-white">
                <span className="font-disp font-bold text-base sm:text-lg tracking-wide block">
                  CARS ON CALEDON
                </span>
                <span className="font-mono text-[9px] tracking-[0.24em] text-gray-400 block uppercase">
                  Quality Pre-Owned
                </span>
              </div>
            </a>
            <p className="text-sm leading-relaxed text-gray-400 max-w-sm">
              Independent, family-run, and absolutely uncompromising about what we place on the showroom floor. Premium inspection graded pre-owned vehicles and tailormade financial integrations.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
              <ShieldCheck className="w-4 h-4 text-brand-brand-gold" />
              <span>VIR™ Certified Independent Dealer</span>
            </div>
          </div>

          {/* Showroom Navigation Categories */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="font-mono text-xs tracking-widest text-white uppercase font-bold">
              Showroom
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#inventory" className="hover:text-white transition-colors">
                  All Showroom
                </a>
              </li>
              <li>
                <a href="#inventory" className="hover:text-white transition-colors">
                  Hatchbacks
                </a>
              </li>
              <li>
                <a href="#inventory" className="hover:text-white transition-colors">
                  SUVs &amp; Bakkies
                </a>
              </li>
              <li>
                <a href="#inventory" className="hover:text-white transition-colors">
                  Coupes &amp; Performance
                </a>
              </li>
            </ul>
          </div>

          {/* Dealership Services */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-mono text-xs tracking-widest text-white uppercase font-bold">
              Our Services
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#finance" className="hover:text-white transition-colors">
                  Vehicle Finance
                </a>
              </li>
              <li>
                <a href="#sell" className="hover:text-white transition-colors">
                  Trade-In Evaluation
                </a>
              </li>
              <li>
                <a href="#sell" className="hover:text-white transition-colors">
                  Park &amp; Sell (Zero Fees)
                </a>
              </li>
              <li>
                <a href="#why" className="hover:text-white transition-colors">
                  VIR™ Condition Audits
                </a>
              </li>
            </ul>
          </div>

          {/* Showroom Contacts & Directions */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-mono text-xs tracking-widest text-white uppercase font-bold">
              Contact &amp; Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                <a href="tel:+27618759389" className="hover:text-white transition-colors font-mono text-xs">
                  +27 61 875 9389
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                <a href="mailto:lance@carsoncaledon.co.za" className="hover:text-white transition-colors text-xs">
                  lance@carsoncaledon.co.za
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                <span className="text-xs">
                  257 Caledon Street, Kariega, Eastern Cape, 6229
                </span>
              </li>
              <li className="pt-2">
                <a
                  href="https://www.facebook.com/carsoncaledon/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Facebook className="w-3.5 h-3.5 fill-white" />
                  Follow us on Facebook
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright details */}
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <p className="font-mono text-[10.5px] text-gray-500">
            &copy; 2026 Cars on Caledon · All prices include VAT (E&amp;OE) · Kariega, South Africa.
          </p>
          <p className="font-mono text-[10.5px] text-gray-500">
            Website concept mockup · Powered by <strong className="text-sky-400">AUTOXLOO</strong> DMS.
          </p>
        </div>
      </div>
    </footer>
  );
}
