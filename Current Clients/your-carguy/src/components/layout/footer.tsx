import Link from "next/link";
import { Phone, MapPin, Clock, Mail } from "lucide-react";

const FOOTER_LINKS = [
  { label: "Home", href: "/" },
  { label: "Browse Stock", href: "/vehicles" },
  { label: "Sell Your Car", href: "/sell-your-vehicle" },
  { label: "About Us", href: "/about-us" },
  { label: "Testimonials", href: "/testimonials" },
] as const;

export default function Footer() {
  return (
    <footer className="bg-[#060608] text-white/60 border-t border-white/[0.04]">
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {/* Brand */}
        <div className="space-y-5">
          <Link href="/" className="inline-block">
            <div className="font-display font-bold text-xl text-white mb-1">Your Car Guy</div>
          </Link>
          <p className="text-sm text-white/35 leading-relaxed max-w-xs">
            Backed by Trust. Driven by Quality. Newton Park's trusted destination for quality pre-owned vehicles.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <StarIcon className="w-3.5 h-3.5 fill-brand text-brand" />
            <span className="text-xs text-white/40 tracking-wide">{FOOTER_LINKS.length + 1} Five-Star Google Reviews</span>
          </div>
        </div>

        {/* Quick links */}
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-white/25 mb-5">Navigation</div>
          <ul className="space-y-3">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-white/40 hover:text-brand transition-colors inline-block"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <div className="text-xs tracking-[0.2em] uppercase text-white/25 mb-5">Get in Touch</div>
          <div className="space-y-3.5">
            <a href="tel:0834659921" className="flex items-center gap-3 text-sm text-white/40 hover:text-brand transition-colors">
              <Phone className="h-4 w-4 shrink-0 text-brand/60" />
              083 465 9921
            </a>
            <a href="tel:0410070393" className="flex items-center gap-3 text-sm text-white/40 hover:text-brand transition-colors">
              <Phone className="h-4 w-4 shrink-0 text-brand/60" />
              041 007 0393
            </a>
            <p className="flex items-start gap-3 text-sm text-white/35">
              <MapPin className="h-4 w-4 shrink-0 text-brand/60 mt-0.5" />
              17 Burt Drive, Newton Park, PE
            </p>
            <p className="flex items-center gap-3 text-sm text-white/35">
              <Clock className="h-4 w-4 shrink-0 text-brand/60" />
              Mon–Fri 07:30–17:30 · Sat 08:00–13:00
            </p>
            <a href="mailto:sales@yourcarguy.co.za" className="flex items-center gap-3 text-sm text-white/40 hover:text-brand transition-colors">
              <Mail className="h-4 w-4 shrink-0 text-brand/60" />
              sales@yourcarguy.co.za
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <p className="text-xs text-white/20">© {new Date().getFullYear()} Your Car Guy. All rights reserved.</p>
          <p className="text-xs text-white/20">
            Software & Management by TruDealer
          </p>
        </div>
      </div>
    </footer>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}
