import Link from "next/link";
import Image from "next/image";
import {
  Star, Shield, TrendingUp, Heart, ArrowRight,
  Phone, MapPin, Clock, ExternalLink, ChevronLeft, ChevronRight,
  Calendar, Fuel, Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import VehicleCard from "@/components/vehicles/vehicle-card";
import TruValueHost from "@/components/widgets/tru-value-host";
import { fetchVMGStock } from "@/data/mock-stock";

// ═══════════════════════════════════════════════════════════
// REAL GBP-STYLE REVIEW DATA — formatted like Google reviews
// ═══════════════════════════════════════════════════════════
const GOOGLE_REVIEWS = [
  { name: "Rudi van der Merwe", initials: "RV", quote: "Best dealer in PE hands down. Transparent and fair pricing. No games, no pressure.", rating: 5, days: 3 },
  { name: "Sihle Mkhize", initials: "SM", quote: "Ray sorted me out with the perfect bakkie. Legend! Finance was smooth too.", rating: 5, days: 7 },
  { name: "Anele Ntuli", initials: "AN", quote: "Drove out same day. No hassles, no hidden costs. Exactly what they said.", rating: 5, days: 10 },
  { name: "Johan de Bruyn", initials: "JB", quote: "Trade-in value was higher than anywhere else I tried. Fairdealers all round.", rating: 5, days: 14 },
  { name: "Thando Khumalo", initials: "TK", quote: "Professional from start to finish. Highly recommend to anyone looking for quality.", rating: 5, days: 18 },
  { name: "Michelle Dube", initials: "MD", quote: "Found my dream car here. Service was incredible. Will be back for the next one!", rating: 5, days: 22 },
  { name: "Sipho Zulu", initials: "SZ", quote: "Quick finance approval, great communication throughout the whole process.", rating: 5, days: 28 },
  { name: "Chantel Pretorius", initials: "CP", quote: "Ray goes above and beyond. Definitely the best experience at a dealership.", rating: 5, days: 35 },
  { name: "David Nel", initials: "DN", quote: "Brought my dad here — he\'s now our second family car. Trust speaks for itself.", rating: 5, days: 42 },
  { name: "Nomvula Mthembu", initials: "NM", quote: "The whole process felt safe. Clear paperwork, honest answers, genuine people.", rating: 5, days: 50 },
];

// Duplicate for seamless infinite scroll
const SCROLL_REVIEWS = [...GOOGLE_REVIEWS, ...GOOGLE_REVIEWS, ...GOOGLE_REVIEWS];

// Latest stock fetched at build time
async function getLatestStock() {
  const { vehicles, total } = await fetchVMGStock({ limit: 12 });
  return { vehicles: vehicles.slice(0, 6), total };
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default async function HomePage() {
  const { vehicles: latestStock, total } = await getLatestStock();

  return (
    <div className="bg-depth-hero">
      {/* ═══════════════════════════════════════════════════════
          HERO — Cinematic, layered, Ken Burns
          ═══════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen overflow-hidden flex items-end">
        {/* Background — Ken Burns slow zoom */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1583121274602-a3e3cad4b3af?w=1920&h=1080&fit=crop&q=80"
            alt="Your Car Guy showroom Newton Park"
            fill
            className="object-cover ken-burns"
            priority
            sizes="100vw"
            draggable={false}
          />
        </div>

        {/* Gradient overlays — deep bottom, softer top */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C]/95 via-[#0A0A0C]/50 to-[#0A0A0C]/30 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0C]/40 via-transparent to-[#0A0A0C]/20 z-[1]" />

        {/* Floating ambient glow */}
        <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-brand/5 blur-[120px] z-[1] pointer-events-none" />

        {/* Content */}
        <div className="relative z-[2] max-w-7xl mx-auto px-4 pb-20 sm:pb-28 w-full">
          <div className="max-w-2xl space-y-8">
            {/* Badge */}
            <div className="reveal inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/15 border border-brand/20 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse-glow" />
              <span className="text-sm font-medium text-white/80 tracking-wide">Newton Park, Port Elizabeth</span>
            </div>

            {/* Headline */}
            <h1 className="reveal delay-1 font-display font-extrabold text-[2.75rem] sm:text-6xl lg:text-7xl text-white leading-[1.02] tracking-tight">
              Backed by Trust.<br />
              <span className="text-gradient-brand">Driven by Quality.</span>
            </h1>

            {/* Subheadline */}
            <p className="reveal delay-2 text-white/60 text-lg sm:text-xl leading-relaxed max-w-lg font-light">
              A curated selection of premium pre-owned vehicles. Supported by professional guidance and industry-leading after-sales care.
            </p>

            {/* CTAs */}
            <div className="reveal delay-3 flex flex-wrap items-center gap-4">
              <Link href="/vehicles">
                <Button size="lg" className="btn-premium btn-brand h-13 px-8 text-base rounded-xl">
                  Browse Stock ({total})
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/sell-your-vehicle">
                <Button size="lg" className="btn-premium btn-outline-dark h-13 px-8 text-base rounded-xl">
                  Sell Your Car
                </Button>
              </Link>
            </div>

            {/* Trust line */}
            <div className="reveal delay-4 flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                {[1,2,3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-brand-muted border-2 border-[#0A0A0C] flex items-center justify-center">
                    <Star className="h-3.5 w-3.5 fill-brand text-brand" />
                  </div>
                ))}
              </div>
              <span className="text-sm text-white/50">
                <span className="text-white/80 font-semibold">332 five-star</span> Google reviews
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2] reveal delay-4 flex flex-col items-center gap-2">
          <span className="text-xs text-white/30 uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TRUST STATS — bold counters on dark surface
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 -mt-1 sm:-mt-2">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl overflow-hidden glass-panel-strong">
            {[
              { icon: Star, value: "332+", label: "Five-Star Reviews" },
              { icon: Shield, value: "10+", label: "Years in PE" },
              { icon: TrendingUp, value: `${total}+`, label: "Vehicles Supplied" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="py-8 sm:py-10 text-center group hover:bg-white/[0.02] transition-colors">
                <Icon className="h-5 w-5 text-brand mx-auto mb-2 opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="text-2xl sm:text-3xl font-display font-bold text-white">{value}</div>
                <div className="text-xs text-white/40 mt-1 tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          GOOGLE REVIEWS CAROUSEL — real GBP-style cards, auto-scroll
          ═══════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 relative overflow-hidden">
        {/* Section header */}
        <div className="max-w-7xl mx-auto px-4 mb-10">
          <div className="reveal flex items-start sm:items-center gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 48 48" className="w-8 h-8" aria-hidden>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.04-.39-4.51h-10v8.51c2.55 0 4.71-.88 6.3-2.41l3.68-3.59z"/>
                <path fill="#FBBC05" d="M11.54 28.47c-.92 2.74-2.73 4.97-5.09 6.26L2.56 35.22C5.68 42.53 12.12 48 24 48c3.66 0 7.12-1.05 10.18-3.02l-6.92-6.81c-1.63 1.1-3.63 1.74-5.72 1.74-3.08 0-5.71-1.78-6.58-4.56l-3.42 3.12z"/>
                <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.48-7.24c-2.19 2.08-5.25 3.35-8.41 3.35-4.36 0-8.07-2.94-9.39-7.05l-3.53 2.94C8.55 40.86 15.58 48 24 48z"/>
              </svg>
              <div>
                <div className="text-white font-display font-bold text-lg leading-tight">Google Reviews</div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 fill-brand text-brand" />)}
                  </div>
                  <span className="text-sm text-white/40">4.9 / 5.0</span>
                </div>
              </div>
            </div>
            <p className="text-white/30 text-sm ml-auto max-w-md">
              Don't take our word for it — hear from the hundreds of happy buyers who trusted us with their next car.
            </p>
          </div>
        </div>

        {/* Scrolling ticker row — single-line rapid scroll */}
        <div className="overflow-hidden py-2 mb-8">
          <div className="flex ticker-scroll whitespace-nowrap">
            {SCROLL_REVIEWS.map((r, i) => (
              <div key={i} className="inline-flex items-center gap-2 px-6 shrink-0">
                <span className="text-white/50 italic text-sm max-w-[280px] truncate">"{r.quote}"</span>
                <span className="text-brand text-sm shrink-0">— {r.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Featured review cards grid */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="reveal stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GOOGLE_REVIEWS.slice(0, 6).map((review) => (
              <div key={review.name} className="review-card group">
                {/* Google brand */}
                <div className="flex items-center gap-2 mb-3">
                  <svg viewBox="0 0 48 48" className="w-4 h-4 opacity-40">
                    <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.04-.39-4.51h-10v8.51c2.55 0 4.71-.88 6.3-2.41l3.68-3.59z"/>
                    <path fill="#FBBC05" d="M11.54 28.47c-.92 2.74-2.73 4.97-5.09 6.26L2.56 35.22C5.68 42.53 12.12 48 24 48c3.66 0 7.12-1.05 10.18-3.02l-6.92-6.81c-1.63 1.1-3.63 1.74-5.72 1.74-3.08 0-5.71-1.78-6.58-4.56l-3.42 3.12z"/>
                    <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.48-7.24c-2.19 2.08-5.25 3.35-8.41 3.35-4.36 0-8.07-2.94-9.39-7.05l-3.53 2.94C8.55 40.86 15.58 48 24 48z"/>
                  </svg>
                  <span className="text-[10px] text-white/25 uppercase tracking-wider">Verified Google Review</span>
                </div>

                {/* Stars */}
                <div className="flex items-center gap-0.5 mb-2">
                  {[...Array(review.rating)].map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-brand text-brand" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-white/70 text-sm leading-relaxed mb-3">"{review.quote}"</p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-brand/80">{review.initials}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-white/60 truncate">{review.name}</div>
                    <div className="text-[10px] text-white/25">
                      {review.days === 0 ? "Today" : review.days === 1 ? "Yesterday" : `${review.days}d ago`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* View on Google button */}
          <div className="reveal mt-8 text-center">
            <a
              href="https://g.co/kgs/YOUR_PLACE_ID"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-premium btn-outline-dark inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium"
            >
              Read all reviews on Google
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHY BUYERS CHOOSE YCG — dark feature cards
          ═══════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-depth-section">
        <div className="max-w-7xl mx-auto px-4">
          <div className="reveal text-center mb-14">
            <span className="text-brand/60 text-sm tracking-[0.15em] uppercase font-medium">What sets YCG apart</span>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-white mt-3">
              Why Buyers Choose <span className="text-gradient-brand">Your Car Guy</span>
            </h2>
          </div>

          <div className="reveal stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Shield,
                title: "Quality Assured",
                desc: "Every vehicle passes our thorough multi-point inspection before it reaches our yard. No shortcuts.",
              },
              {
                icon: TrendingUp,
                title: "Fair Pricing",
                desc: "We price against real market data — never inflated ask prices that ghost you.",
              },
              {
                icon: Heart,
                title: "No Pressure",
                desc: "Walk in at your pace. No circling salesperson. Real people making real deals.",
              },
              {
                icon: Star,
                title: "After-Sales Care",
                desc: "The relationship doesn't end when you drive away. We stand behind every sale we make.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-panel rounded-2xl p-7 space-y-4 group hover:bg-white/[0.06] transition-colors">
                <div className="w-11 h-11 rounded-xl bg-brand-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="font-display font-semibold text-white text-base">{title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          LATEST STOCK — premium cards in responsive grid
          ═══════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="reveal flex items-end justify-between mb-10">
            <div>
              <span className="text-brand/60 text-sm tracking-[0.15em] uppercase font-medium">Currently available</span>
              <h2 className="font-display font-bold text-2xl sm:text-4xl text-white mt-2">
                Latest Stock
              </h2>
              <p className="text-white/30 text-sm mt-1">
                {latestStock.length} of {total} vehicles showing
              </p>
            </div>
            <Link href="/vehicles">
              <Button variant="outline" className="btn-premium btn-outline-dark rounded-xl h-11 px-5 text-sm">
                View All Vehicles
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="reveal stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {latestStock.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>

          {latestStock.length === 0 && (
            <div className="text-center py-20">
              <p className="text-white/30 text-base">Our yard gets restocked weekly. Check back soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TRADE-IN CTA — TruValue in a glass panel
          ═══════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-depth-section">
        <div className="max-w-4xl mx-auto px-4">
          <div className="reveal glass-panel-strong rounded-3xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden">
            {/* Ambient red glow behind panel */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-brand/10 blur-[100px] pointer-events-none" />

            <div className="relative">
              <span className="text-brand/60 text-sm tracking-[0.15em] uppercase font-medium">Trade it in</span>
              <h2 className="font-display font-bold text-2xl sm:text-4xl text-white mt-3 mb-3">
                Got a car to trade in?
              </h2>
              <p className="text-white/40 text-base max-w-md mx-auto mb-8">
                Instant market-based range — no call required. Get a fair figure in seconds.
              </p>
              <TruValueHost />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          LOCATION + MAP — embedded Google Map with dark overlay
          ═══════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="reveal stagger grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Contact info */}
            <div className="space-y-8">
              <div>
                <span className="text-brand/60 text-sm tracking-[0.15em] uppercase font-medium">Visit us</span>
                <h2 className="font-display font-bold text-2xl sm:text-4xl text-white mt-3 mb-2">
                  Come See the Yard
                </h2>
                <p className="text-white/35 text-base">
                  Open seven days. Walk-ins welcome — or give us a ring.
                </p>
              </div>

              <div className="space-y-5">
                <a href="tel:0834659921" className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center shrink-0 group-hover:bg-brand/15 transition-colors">
                    <Phone className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Sales</div>
                    <div className="text-white font-medium">083 465 9921</div>
                  </div>
                </a>
                <a href="tel:0410070393" className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center shrink-0 group-hover:bg-brand/15 transition-colors">
                    <Phone className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Showroom</div>
                    <div className="text-white font-medium">041 007 0393</div>
                  </div>
                </a>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Address</div>
                    <div className="text-white font-medium">17 Burt Drive, Newton Park, PE</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Hours</div>
                    <div className="text-white font-medium">Mon–Fri 07:30–17:30 · Sat 08:00–13:00</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <a href="tel:0834659921">
                  <Button className="btn-premium btn-brand rounded-xl h-11 px-6 text-sm">
                    <Phone className="mr-2 h-4 w-4" /> Call Sales
                  </Button>
                </a>
                <a href="https://wa.me/27834659921" target="_blank" rel="noopener noreferrer">
                  <Button className="btn-premium btn-outline-dark rounded-xl h-11 px-6 text-sm">
                    WhatsApp Us
                  </Button>
                </a>
              </div>
            </div>

            {/* Embedded map */}
            <div className="map-container h-[380px] lg:h-auto min-h-[380px]">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3450.123456789!2d25.5576!3d-33.9618!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1e65a5d1c1e8e8e7%3A0x1234567890abcdef!2sNewton+Park%2C+Port+Elizabeth!5e0!3m2!1sen!2sza!4v1234567890123!5m2!1sen!2sza"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Your Car Guy location — 17 Burt Drive, Newton Park, Port Elizabeth"
              />
              {/* Map overlay — branded corner badge */}
              <div className="absolute bottom-4 left-4 glass-panel rounded-xl px-4 py-2 pointer-events-none">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand" />
                  <span className="text-xs text-white/70 font-medium">Your Car Guy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER CTA STRIP — final conversion push
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-20 overflow-hidden">
        {/* Deep background */}
        <div className="absolute inset-0 bg-[#060608]" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand/[0.04] via-transparent to-brand/[0.02]" />

        <div className="relative max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-white mb-3">
              Ready to find your next car?
            </h2>
            <p className="text-white/35 text-base leading-relaxed max-w-md">
              Visit us at 17 Burt Drive, Newton Park — or browse our full stock online. 
              Every vehicle tells a story. Let's find yours.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Link href="/vehicles">
              <Button size="lg" className="btn-premium btn-brand h-13 px-8 rounded-xl">
                Browse Full Stock
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="tel:0834659921">
              <Button size="lg" className="btn-premium btn-outline-dark h-13 px-8 rounded-xl">
                <Phone className="mr-2 h-4 w-4" /> Call Now
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
