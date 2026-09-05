"use client";

import { useState, useEffect } from "react";
import {
  Fuel, Calendar, Gauge, Settings, ArrowRight,
  MessageCircle, MapPin, Clock, Share2, Send, CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Vehicle } from "@/data/mock-stock";
import { formatPrice, formatNum } from "@/lib/utils"
import ImmersiveGallery from "@/components/widgets/immersive-gallery";
import StickyDealBar from "@/components/widgets/sticky-deal-bar";
import { VIRScoreDisplay } from "@/components/widgets/vir-gauge";
import MarketPricePanel from "@/components/widgets/market-price-panel";
import TruWidgetInline from "@/components/widgets/tru-widget-inline";
import TruTrigger from "@/components/widgets/tru-trigger";
import { saveCarStockNo, addRecentCarStockNo } from "@/lib/showroom";

// Mock data — swap with real API fetch later
const VEHICLE: Vehicle = {
  id: "v001",
  stockNo: "YC-RNG-001",
  year: 2020,
  make: "Ford",
  model: "Ranger",
  variant: "2.0D Bi-Turbo Wildtrak 4x4 A/T P/U D/C",
  fullName: "2020 FORD RANGER 2.0D BI-TURBO WILDTRAK 4X4 A/T P/U D/C",
  price: 489900,
  mileage: 83000,
  transmission: "Automatic",
  fuelType: "Diesel",
  engineSize: "1997cc",
  drivetrain: "4x4",
  bodyType: "Bakkie Double Cab",
  colour: "White",
  doors: 4,
  condition: "Excellent",
  images: [
    "https://images.unsplash.com/photo-1590362891981-f532a1c663f3?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1583121274602-a3e3cad4b3af?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1542361345-86e0b1aa23db?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1558618666-fcd2fc071e65?w=1200&h=800&fit=crop",
  ],
  dateAdded: "2026-06-15",
  daystInStock: 77,
};

export default function VehicleDetailPage() {
  const [saved, setSaved] = useState(false);
  const whatsappText = `Hi! I'm interested in your ${VEHICLE.fullName} (${formatPrice(VEHICLE.price)}). Is it still available?`;
  const whatsappUrl = `https://wa.me/27834659921?text=${encodeURIComponent(whatsappText)}`;

  // Track recent cars on view
  useEffect(() => {
    addRecentCarStockNo(VEHICLE.stockNo);
  }, []);

  const handleSave = () => {
    saveCarStockNo(VEHICLE.stockNo);
    setSaved(!saved);
  };

  return (
    <>
      {/* ── Sticky Deal Bar (slide-down on scroll) ───────── */}
      <StickyDealBar vehicle={VEHICLE} />

      {/* ── Immersive Photo Gallery (has its own lightbox) ── */}
      <div className="relative">
        <ImmersiveGallery images={VEHICLE.images} altPrefix={VEHICLE.fullName} />
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 pb-24 sm:pb-32">
        {/* Title + Price bar */}
        <div className="pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="brand" className="text-xs">{VEHICLE.year}</Badge>
                {VEHICLE.condition === "Excellent" && (
                  <Badge variant="outline" className="text-xs border-success/30 text-success">
                    Excellent Condition
                  </Badge>
                )}
              </div>
              <h1 className="font-display font-bold text-xl sm:text-2xl text-ink leading-tight">
                {VEHICLE.model}
              </h1>
              <p className="text-sm text-ink-muted mt-0.5">{VEHICLE.variant}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-ink-muted uppercase tracking-wider mb-0.5">Our Price</div>
              <div className="text-2xl sm:text-3xl font-display font-bold text-brand">{formatPrice(VEHICLE.price)}</div>
            </div>
          </div>

          {/* Spec chips row */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Fuel, label: VEHICLE.fuelType },
              { icon: Calendar, label: String(VEHICLE.year) },
              { icon: Gauge, label: `${formatNum(VEHICLE.mileage)} km` },
              { icon: Settings, label: VEHICLE.transmission },
              { icon: ArrowRight, label: VEHICLE.drivetrain },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-alt border border-border text-xs text-ink-secondary">
                <Icon className="h-3 w-3 text-ink-muted" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Two-column layout for desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left: Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* VIR Score + Market Price side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <VIRScoreDisplay score={87} title="Vehicle Inspection Report" />
              <MarketPricePanel
                dealerPrice={VEHICLE.price}
                marketAverage={475000}
                marketLow={445000}
                marketHigh={510000}
                listingsFound={23}
              />
            </div>
            {/* Full specs table */}
            <div>
              <h2 className="font-display font-semibold text-lg mb-4">Specifications</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {[
                  ["Year", String(VEHICLE.year)],
                  ["Make", VEHICLE.make],
                  ["Model", VEHICLE.model],
                  ["Variant", VEHICLE.variant.split(" ").slice(0, 3).join(" ")],
                  ["Body Type", VEHICLE.bodyType],
                  ["Colour", VEHICLE.colour],
                  ["Doors", String(VEHICLE.doors ?? "—")],
                  ["Engine", VEHICLE.engineSize ?? "—"],
                  ["Transmission", VEHICLE.transmission],
                  ["Fuel Type", VEHICLE.fuelType],
                  ["Drivetrain", VEHICLE.drivetrain ?? "—"],
                  ["Mileage", `${formatNum(VEHICLE.mileage)} km`],
                  ["VIN", VEHICLE.vin ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <dt className="text-[11px] text-ink-muted uppercase tracking-wider">{label}</dt>
                    <dd className="text-sm font-medium text-ink-secondary">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Description */}
            <div>
              <h2 className="font-display font-semibold text-lg mb-3">About This Vehicle</h2>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Well-maintained {VEHICLE.year} {VEHICLE.make} {VEHICLE.model} {VEHICLE.variant}. 
                Comes with full service history, verified mileage of {formatNum(VEHICLE.mileage)} km, 
                and an excellent condition report. Finance available through our banking partners. 
                Trade-in welcome — get a free instant estimate above.
              </p>
            </div>

            {/* Location */}
            <div className="bg-surface-alt rounded-xl p-4 border border-border">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Visit Us</h3>
                  <p className="text-sm text-ink-secondary mt-0.5">17 Burt Drive, Newton Park, Port Elizabeth</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-ink-muted">
                    <Clock className="h-3 w-3" />
                    Mon–Fri 07:30–17:30 · Sat 08:00–13:00
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Action column (sticky on desktop) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="lg:sticky lg:top-24 space-y-4">
              {/* Primary CTAs */}
              <div className="space-y-3">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full h-12 bg-brand hover:bg-brand-dark text-base shadow-lg shadow-brand-glow">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    WhatsApp Enquiry
                  </Button>
                </a>
                {/* Opens the real loader-mounted TruForm, pre-filled with this car. */}
                <TruTrigger action="form" vehicle={VEHICLE} variant="outline" size="default"
                  className="w-full h-12 text-base border-brand/30 hover:bg-brand-muted hover:border-brand">
                  <Send className="h-5 w-5 mr-2" />
                  Send an Enquiry
                </TruTrigger>
                {/* Opens the real TruBook test-drive scheduler. */}
                <TruTrigger action="book" vehicle={VEHICLE} variant="outline" size="default"
                  className="w-full h-12 text-base">
                  <CalendarCheck className="h-5 w-5 mr-2" />
                  Book Test Drive
                </TruTrigger>
                {/* Opens the real TruShare sheet for this vehicle. */}
                <TruTrigger action="share" vehicle={VEHICLE} variant="ghost" size="default"
                  className="w-full h-11 text-sm text-ink-muted">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share this car
                </TruTrigger>
              </div>

              <Separator />

              {/* Real TruRepay widget, inline, pre-priced for THIS vehicle. */}
              <TruWidgetInline
                widget="tru-repay"
                attrs={{
                  "data-price": VEHICLE.price,
                  "data-vehicle": `${VEHICLE.year} ${VEHICLE.make} ${VEHICLE.model}`,
                  "data-heading": "Monthly Instalment",
                }}
              />

              <Separator />

              {/* TruValue: what's your current car worth in part-exchange? */}
              <TruWidgetInline
                widget="tru-value"
                attrs={{
                  "data-margin": "15",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
