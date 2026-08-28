import crypto from 'crypto';
import { NormalizedVehicle, ArbitrageDeal, TrackedInventoryVehicle, ValuationResult, DealCategory } from '../types';
import { CONFIG } from '../config';

export function generateVehicleFingerprint(vehicle: NormalizedVehicle, dealerSlug = ''): string {
  const sellerKey = vehicle.sellerId || vehicle.sellerName || vehicle.location.toLowerCase().trim();
  const kmBucket = vehicle.mileageKm ? Math.round(vehicle.mileageKm / 5000) * 5000 : 'nokm';
  // dealerSlug is part of the hash input so the same car tracked by two dealers
  // (their own stock + a market listing) never collides in the shared store.
  const raw = `${dealerSlug}|${sellerKey}|${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}|${vehicle.year}|${kmBucket}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

export function calculateUrgencyScore(daysOnMarket: number, priceHistoryCount: number, totalPriceDrop: number, originalPrice: number): number {
  let score = 0;

  // 1. Days on Market factor (up to 40 points)
  if (daysOnMarket >= CONFIG.CRITICAL_FLOORPLAN_DAYS) {
    score += 40;
  } else if (daysOnMarket >= CONFIG.STALE_FLOORPLAN_DAYS) {
    score += 30;
  } else if (daysOnMarket >= 20) {
    score += 20;
  } else if (daysOnMarket >= 10) {
    score += 10;
  }

  // 2. Price drop occurrences (up to 30 points)
  const dropEvents = Math.max(0, priceHistoryCount - 1);
  score += Math.min(30, dropEvents * 15);

  // 3. Percentage price drop (up to 30 points)
  if (originalPrice > 0 && totalPriceDrop > 0) {
    const dropPct = (totalPriceDrop / originalPrice) * 100;
    if (dropPct >= 15) score += 30;
    else if (dropPct >= 10) score += 20;
    else if (dropPct >= 5) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/** Dynamic recon buffer — scaled to the unit's value. pct × marketRetail,
 *  clamped to [floor, cap]: a Polo doesn't cost a GLS to make ready. */
export function calculateReconBuffer(marketRetail: number): number {
  const raw = Math.round(Math.max(0, marketRetail) * (CONFIG.RECON_PCT || 0.03));
  return Math.min(CONFIG.RECON_CAP || 30000, Math.max(CONFIG.RECON_FLOOR || 5000, raw));
}

export function evaluateArbitrageOpportunity(
  vehicle: NormalizedVehicle,
  valuation: ValuationResult,
  tracked: TrackedInventoryVehicle,
  customReconBuffer?: number,
  customMinMargin?: number
): ArbitrageDeal | null {
  if (!valuation.averageRetailPrice || valuation.averageRetailPrice <= 0) {
    return null;
  }

  // Confidence floor — the moat. A valuation below the floor (thin or
  // poorly-clustered comps, no TU backstop) never produces an alert.
  if (valuation.confidence < CONFIG.CONFIDENCE_FLOOR) {
    return null;
  }

  // Reject damaged or salvage vehicles
  if (vehicle.isDamagedOrSalvage || vehicle.isWantedAd) {
    return null;
  }

  const marketRetail = valuation.averageRetailPrice;
  const reconBuffer = customReconBuffer ?? calculateReconBuffer(marketRetail);
  const minMargin = customMinMargin ?? CONFIG.MIN_ARBITRAGE_MARGIN;

  const askingPrice = vehicle.askingPrice;
  const grossMargin = marketRetail - askingPrice;
  const netMargin = grossMargin - reconBuffer;

  // ── Too-good-to-be-true gate ──
  // A net margin above the sanity cap of market retail means something is
  // WRONG — salvage misparsed as clean, a deposit figure read as a price, a
  // SERP snippet artifact, or variant-skewed comps. These deals are the ones
  // that burn a dealer's trust on day one ("drove 300km for a write-off").
  // Floor on the cap so low-value cars aren't strangled by the percentage.
  const sanityMax = Math.max(
    marketRetail * (CONFIG.MARGIN_SANITY_CAP_PCT || 0.4),
    minMargin * 2
  );
  if (netMargin > sanityMax) {
    console.log(`[arbitrage] sanity gate: ${vehicle.year} ${vehicle.make} ${vehicle.model} rejected — net R${netMargin.toLocaleString()} is ${Math.round((netMargin / marketRetail) * 100)}% of market R${marketRetail.toLocaleString()} (cap ${Math.round(sanityMax).toLocaleString()}). Likely bad comps or misparsed price.`);
    return null;
  }

  const isStaleFloorplan = tracked.daysOnMarket >= CONFIG.STALE_FLOORPLAN_DAYS || tracked.totalPriceDrop >= CONFIG.MIN_DISTRESS_PRICE_DROP;
  const isUnderpriced = netMargin >= minMargin;

  // Must qualify either as an underpriced bargain OR as a stale floorplan distress opportunity
  if (!isUnderpriced && !isStaleFloorplan) {
    return null;
  }

  let dealCategory: DealCategory = 'underpriced_arbitrage';
  if (tracked.daysOnMarket >= CONFIG.STALE_FLOORPLAN_DAYS) {
    dealCategory = 'stale_floorplan_distress';
  } else if (tracked.totalPriceDrop >= CONFIG.MIN_DISTRESS_PRICE_DROP) {
    dealCategory = 'price_drop_velocity';
  }

  const marginPercentage = Math.round((netMargin / askingPrice) * 100);

  return {
    id: `deal_${crypto.randomUUID().slice(0, 12)}`,
    fingerprint: tracked.fingerprint,
    source: vehicle.source,
    dealCategory,
    vehicle,
    askingPrice,
    marketRetailPrice: marketRetail,
    reconBuffer,
    projectedGrossMargin: grossMargin,
    projectedNetMargin: netMargin,
    marginPercentage,
    sampleCompsCount: valuation.listingsFound,
    confidence: valuation.confidence,
    daysOnMarket: tracked.daysOnMarket,
    urgencyScore: tracked.urgencyScore,
    detectedAt: new Date().toISOString(),
    status: 'new',
  };
}

/** My Stock gate — the inverse signal. Flags the dealer's OWN stock that is
 *  BOTH overpriced vs live market AND stale. AND-logic on purpose: low noise,
 *  high signal — only real dead weight alerts. Margins are negative by design
 *  (the amount the unit sits above market is the recommended price drop). */
export function evaluateOverpricedStock(
  vehicle: NormalizedVehicle,
  valuation: ValuationResult,
  tracked: TrackedInventoryVehicle
): ArbitrageDeal | null {
  if (!valuation.averageRetailPrice || valuation.averageRetailPrice <= 0) {
    return null;
  }

  // Same confidence floor as the buy gate — no alerts on thin comps.
  if (valuation.confidence < CONFIG.CONFIDENCE_FLOOR) {
    return null;
  }

  const overBy = vehicle.askingPrice - valuation.averageRetailPrice; // positive = overpriced
  const overPct = (overBy / valuation.averageRetailPrice) * 100;
  const isOverpriced = overPct >= CONFIG.OVERPRICED_THRESHOLD_PCT;
  const isStale = tracked.daysOnMarket >= CONFIG.STALE_FLOORPLAN_DAYS;

  // AND: over market AND stale. Either alone is not actionable enough.
  if (!isOverpriced || !isStale) {
    return null;
  }

  return {
    id: `deal_${crypto.randomUUID().slice(0, 12)}`,
    fingerprint: tracked.fingerprint,
    source: vehicle.source,
    dealCategory: 'overpriced_stale_stock',
    vehicle,
    askingPrice: vehicle.askingPrice,
    marketRetailPrice: valuation.averageRetailPrice,
    reconBuffer: 0,
    projectedGrossMargin: -overBy,
    projectedNetMargin: -overBy,
    marginPercentage: -Math.round((overBy / vehicle.askingPrice) * 100),
    sampleCompsCount: valuation.listingsFound,
    confidence: valuation.confidence,
    daysOnMarket: tracked.daysOnMarket,
    urgencyScore: tracked.urgencyScore,
    detectedAt: new Date().toISOString(),
    status: 'new',
  };
}
