"use client";

import { Star } from "lucide-react";

interface SocialProofTickerProps {
  reviews?: {
    name: string;
    quote: string;
    rating: number;
  }[];
}

export default function SocialProofTicker({ 
  reviews = []
}: SocialProofTickerProps) {
  // Default YCG testimonials if none provided
  const testimonials = reviews.length > 0 
    ? reviews 
    : [
        { name: "Rudi V.", quote: "Best dealer in PE hands down. Transparent and fair.", rating: 5 },
        { name: "Sihle M.", quote: "Ray sorted me out with the perfect bakkie. Legend!", rating: 5 },
        { name: "Anele N.", quote: "Drove out same day. No hassles, no hidden costs.", rating: 5 },
        { name: "Johan B.", quote: "Trade-in value was higher than anywhere else I tried.", rating: 5 },
        { name: "Thando K.", quote: "Professional from start to finish. Highly recommend.", rating: 5 },
        { name: "Michelle D.", quote: "Found my dream car here. Service was incredible.", rating: 5 },
        { name: "Sipho Z.", quote: "Quick finance approval, great communication throughout.", rating: 5 },
        { name: "Chantel P.", quote: "Ray goes above and beyond. Will definitely be back.", rating: 5 },
      ];

  // Duplicate for seamless infinite scroll
  const doubled = [...testimonials, ...testimonials];

  return (
    <div className="bg-surface-deep overflow-hidden py-8 relative">
      {/* Gradient fade on edges */}
      <div className="absolute top-0 left-0 bottom-0 w-24 bg-gradient-to-r from-surface-deep to-transparent z-10" />
      <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-surface-deep to-transparent z-10" />
      
      {/* Ticker track */}
      <div className="flex animate-ticker-scroll whitespace-nowrap">
        {doubled.map((t, i) => (
          <div key={i} className="inline-flex items-center gap-3 px-8 shrink-0">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star key={j} className="h-3.5 w-3.5 fill-brand text-brand" />
              ))}
            </div>
            <span className="text-white/70 text-sm italic max-w-xs truncate">"{t.quote}"</span>
            <span className="text-white/40 text-xs shrink-0">— {t.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// CSS animation is already defined in globals.css under .ticker-scroll
// Keyframes: @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
