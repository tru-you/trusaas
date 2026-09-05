import type { Metadata } from "next";
import { Star, Quote } from "lucide-react";
import PageHeader from "@/components/shared/page-header";
import SocialProofTicker from "@/components/widgets/social-proof-ticker";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "332 five-star Google reviews from real Your Car Guy buyers in Port Elizabeth. Read what they say about buying from Ray's team.",
};

const REVIEWS = [
  { name: "Rudi V.", text: "Best dealer in PE hands down. Transparent and fair.", tag: "Purchase" },
  { name: "Sihle M.", text: "Ray sorted me out with the perfect bakkie. Legend!", tag: "Bakkie" },
  { name: "Anele N.", text: "Drove out same day. No hassles, no hidden costs.", tag: "Speed" },
  { name: "Johan B.", text: "Trade-in value was higher than anywhere else I tried.", tag: "Trade-in" },
  { name: "Thando K.", text: "Professional from start to finish. Highly recommend.", tag: "Service" },
  { name: "Michelle D.", text: "Found my dream car here. Service was incredible.", tag: "Purchase" },
  { name: "Sipho Z.", text: "Quick finance approval, great communication throughout.", tag: "Finance" },
  { name: "Chantel P.", text: "Ray goes above and beyond. Will definitely be back.", tag: "Service" },
  { name: "Bongani L.", text: "Honest pricing and quality vehicles. 5 stars!", tag: "Pricing" },
  { name: "Lindiwe S.", text: "The whole team is friendly and helpful. Love this place.", tag: "Service" },
  { name: "Francois W.", text: "Bought 3 cars from YCG now. Wouldn't go anywhere else.", tag: "Repeat buyer" },
  { name: "Noluthando G.", text: "Best experience I've ever had buying a car.", tag: "Purchase" },
  { name: "Mark H.", text: "No pressure sales. Just good people and great cars.", tag: "Experience" },
  { name: "Zandile T.", text: "Ray is the real deal. PE's number 1 for a reason.", tag: "Trust" },
  { name: "Pieter J.", text: "Excellent after-sales support too. Top class.", tag: "After-sales" },
  { name: "Ayanda F.", text: "Smooth process from test drive to keys in hand.", tag: "Process" },
];

export default function TestimonialsPage() {
  return (
    <>
      <PageHeader
        title="What Our Buyers Say"
        subtitle="Real reviews from real Port Elizabeth drivers"
      />

      {/* Rating hero */}
      <section className="px-4">
        <div className="max-w-3xl mx-auto bg-surface-deep rounded-2xl p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand/20 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex justify-center gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-7 w-7 fill-brand text-brand" />
              ))}
            </div>
            <div className="font-display font-extrabold text-5xl text-white">5.0</div>
            <p className="text-white/60 text-sm mt-2">
              Based on <span className="text-white font-semibold">332 Google reviews</span>
            </p>
            <a
              href="https://www.google.com/maps/place/?q=place_id:ChIJJ4jb_l_ReiYRlyglB9fe0jI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-5 text-sm text-brand font-medium hover:underline"
            >
              Read them on Google →
            </a>
          </div>
        </div>
      </section>

      {/* Review cards */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {REVIEWS.map((r) => (
              <figure
                key={r.name}
                className="break-inside-avoid bg-surface rounded-xl border border-border p-5 hover:border-brand/30 hover:shadow-md hover:shadow-brand-glow/10 transition-all"
              >
                <Quote className="h-5 w-5 text-brand/30 mb-2" />
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-brand text-brand" />
                  ))}
                </div>
                <blockquote className="text-sm text-ink-secondary leading-relaxed">
                  "{r.text}"
                </blockquote>
                <figcaption className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{r.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-muted bg-surface-alt px-2 py-0.5 rounded-full">
                    {r.tag}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <SocialProofTicker />
    </>
  );
}
