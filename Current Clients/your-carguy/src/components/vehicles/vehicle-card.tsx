"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Vehicle } from "@/data/mock-stock";
import { cn, formatPrice, formatNum } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Vehicle;
  onSave?: (id: string) => void;
  saved?: boolean;
}

export default function VehicleCard({ vehicle, onSave, saved }: VehicleCardProps) {
  const [bounce, setBounce] = useState(false);

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    setBounce(true);
    setTimeout(() => setBounce(false), 400);
    onSave?.(vehicle.id);
  };

  return (
    <article
      data-tilt
      data-vehicle-card={vehicle.stockNo}
      className="group relative bg-[#15151A] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-brand/20 hover:shadow-xl hover:shadow-black/40 transition-all duration-500"
    >
      {/* Photo */}
      <Link href={`/vehicle/${vehicle.stockNo}`} className="block aspect-[4/3] relative overflow-hidden bg-[#0E0E12]">
        <Image
          src={vehicle.images[0]}
          alt={vehicle.fullName}
          fill
          className="object-cover group-hover:scale-108 transition-transform duration-700"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          draggable={false}
        />

        {/* Gradient overlay on photo bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#15151A] via-transparent to-transparent opacity-60" />

        {/* Overlay chips */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-[2]">
          {vehicle.category === "featured" && (
            <Badge variant="brand" className="text-[11px] font-semibold px-2 py-0.5 rounded-lg">
              Featured
            </Badge>
          )}
          {vehicle.category === "new-in" && (
            <Badge className="bg-white text-ink text-[11px] font-semibold px-2 py-0.5 rounded-lg">
              New In
            </Badge>
          )}
          {vehicle.daystInStock >= 40 && (
            <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 bg-[#15151A]/90 backdrop-blur-sm rounded-lg border-white/10">
              {vehicle.daystInStock}d in stock
            </Badge>
          )}
        </div>

        {/* Photo count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 z-[2]">
          <Camera className="h-3 w-3 text-white/70" />
          <span className="text-[11px] text-white font-medium">{vehicle.images.length}</span>
        </div>

        {/* Save button */}
        {onSave && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            className={cn(
              "absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 backdrop-blur-md",
              bounce && "animate-heart-bounce",
              saved ? "text-brand" : "text-white/70 hover:text-brand hover:bg-white/90",
            )}
          >
            <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </Button>
        )}
      </Link>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Link href={`/vehicle/${vehicle.stockNo}`}>
          <h3 className="font-display font-semibold text-white/90 leading-tight line-clamp-2 group-hover:text-white transition-colors">
            {vehicle.fullName}
          </h3>
        </Link>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {[
            { label: "Fuel", value: vehicle.fuelType },
            { label: "Year", value: String(vehicle.year) },
            { label: "Mileage", value: `${formatNum(vehicle.mileage)} km` },
            { label: "Gearbox", value: vehicle.transmission },
          ].map((spec) => (
            <div key={spec.label} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
              <span className="text-[10px] text-white/35">{spec.label}</span>
              <span className="text-[10px] font-medium text-white/70 truncate">{spec.value}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.04]" />

        {/* Price + Actions */}
        <div className="flex items-end justify-between pt-1">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-white/25 mb-0.5">Our Price</div>
            <div className="text-base sm:text-lg font-display font-bold text-brand">{formatPrice(vehicle.price)}</div>
          </div>
        </div>
      </div>
    </article>
  );
}
