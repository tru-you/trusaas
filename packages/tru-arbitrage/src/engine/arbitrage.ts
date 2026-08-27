import crypto from 'crypto';
import { NormalizedVehicle, ArbitrageDeal, TrackedInventoryVehicle, ValuationResult, DealCategory } from '../types';
import { CONFIG } from '../config';

export function generateVehicleFingerprint(vehicle: NormalizedVehicle): string {
  const sellerKey = vehicle.sellerId || vehicle.sellerName || vehicle.location.toLowerCase().trim();
  const kmBucket = vehicle.mileageKm ? Math.round(vehicle.mileageKm / 5000) * 5000 : 'nokm';
  const raw = `${sellerKey}|${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}|${vehicle.year}|${kmBucket}`;
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

  // Reject damaged or salvage vehicles
  if (vehicle.isDamagedOrSalvage || vehicle.isWantedAd) {
    return null;
  }

  const reconBuffer = customReconBuffer ?? CONFIG.DEFAULT_RECON_BUFFER;
  const minMargin = customMinMargin ?? CONFIG.MIN_ARBITRAGE_MARGIN;

  const marketRetail = valuation.averageRetailPrice;
  const askingPrice = vehicle.askingPrice;
  const grossMargin = marketRetail - askingPrice;
  const netMargin = grossMargin - reconBuffer;

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
    daysOnMarket: tracked.daysOnMarket,
    urgencyScore: tracked.urgencyScore,
    detectedAt: new Date().toISOString(),
    status: 'new',
  };
}
