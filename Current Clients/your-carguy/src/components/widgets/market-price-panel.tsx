"use client";

import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { useState } from "react";
import { cn, formatPrice, formatNum } from "@/lib/utils";

interface MarketPricePanelProps {
  dealerPrice: number;
  marketAverage?: number;
  marketLow?: number;
  marketHigh?: number;
  listingsFound?: number;
}

export default function MarketPricePanel({
  dealerPrice,
  marketAverage = 0,
  marketLow = 0,
  marketHigh = 0,
  listingsFound = 0,
}: MarketPricePanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate delta vs market average
  const deltaPct = marketAverage > 0 
    ? ((dealerPrice - marketAverage) / marketAverage * 100).toFixed(1) 
    : null;
  
  const isUnderpriced = deltaPct !== null && parseFloat(deltaPct) < -3;
  const isOverpriced = deltaPct !== null && parseFloat(deltaPct) > 5;
  const isFair = deltaPct !== null && !isUnderpriced && !isOverpriced;

  return (
    <div className="bg-surface-alt rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-muted flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-brand" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">Market Price Transparency</h3>
            <p className="text-xs text-ink-muted">
              {listingsFound > 0 
                ? `Based on ${listingsFound} live listings` 
                : "Pricing benchmark"}
            </p>
          </div>
        </div>
        <span className={cn("text-sm font-medium", expanded ? "" : "")}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in-up">
          {/* Price comparison bar */}
          <div className="relative h-12 rounded-lg overflow-hidden bg-white border border-border">
            {/* Market range band */}
            {marketLow > 0 && marketHigh > 0 && (
              <div 
                className="absolute top-2 bottom-2 bg-brand/10 rounded"
                style={{
                  left: `${Math.min((marketLow / marketHigh) * 100, 95)}%`,
                  width: `${Math.max(100 - ((marketLow / marketHigh) * 100), 15)}%`,
                }}
              />
            )}
            
            {/* Dealer price marker */}
            {dealerPrice > 0 && (
              <div 
                className={cn(
                  "absolute top-0 bottom-0 w-1 z-10",
                  isUnderpriced ? "bg-success" : isOverpriced ? "bg-destructive" : "bg-brand"
                )}
                style={{ 
                  left: marketHigh > 0 ? `${Math.min((dealerPrice / marketHigh) * 100, 100)}%` : "50%",
                }}
              />
            )}
            
            {/* Labels */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted">
              {marketLow > 0 && marketHigh > 0 
                ? `R${formatNum(marketLow)} – R${formatNum(marketHigh)}`
                : "Market range"}
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted">
              Dealer: {formatPrice(dealerPrice)}
            </div>
          </div>

          {/* Status badge */}
          {deltaPct !== null && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              isUnderpriced ? "bg-success-bg" : isOverpriced ? "bg-[rgba(220,38,38,0.08)]" : "bg-brand-muted"
            )}>
              {isUnderpriced ? (
                <TrendingDown className="h-4 w-4 text-success shrink-0" />
              ) : isOverpriced ? (
                <TrendingUp className="h-4 w-4 text-destructive shrink-0" />
              ) : (
                <Info className="h-4 w-4 text-brand shrink-0" />
              )}
              <div>
                {isUnderpriced && <p className="text-sm font-medium text-success">Below market by {deltaPct}%</p>}
                {isOverpriced && <p className="text-sm font-medium text-destructive">Above market by {deltaPct}%</p>}
                {isFair && <p className="text-sm font-medium text-brand">Fairly priced within market range</p>}
              </div>
            </div>
          )}

          {/* Source info */}
          <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            <span>Data sourced from AutoTrader, Cars.co.za, and Bright Data market scraper. Updated weekly.</span>
          </div>
        </div>
      )}
    </div>
  );
}
