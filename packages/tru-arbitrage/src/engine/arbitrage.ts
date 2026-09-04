import crypto from 'crypto';
import { NormalizedVehicle, ArbitrageDeal, TrackedInventoryVehicle, ValuationResult, DealCategory } from '../types';
import { CONFIG } from '../config';

/** Vehicle identity for dedup — make/model/year/km-bucket ONLY. Deliberately
 *  omits seller, source and location: the same car listed on Cars.co.za,
 *  AutoTrader AND a dealer site must land as ONE tracked row / ONE deal, not
 *  three. Location is not a reliable discriminator (AutoTrader/SERP report
 *  "South Africa" where Cars.co.za has a real city, so it would re-split the
 *  very duplicates we're merging). Dealer isolation lives in the tenant prefix
 *  (`${dealerSlug}:`) on the store key, never by salting this hash — so the
 *  hash is stable across tenants. */
export function vehicleFingerprint(make: string, model: string, year: number, mileageKm: number | null): string {
  const kmBucket = mileageKm ? Math.round(mileageKm / 5000) * 5000 : 'nokm';
  const raw = `${String(make || '').toLowerCase()}|${String(model || '').toLowerCase()}|${Number(year) || 0}|${kmBucket}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

export function generateVehicleFingerprint(vehicle: NormalizedVehicle, _dealerSlug = ''): string {
  return vehicleFingerprint(vehicle.make, vehicle.model, vehicle.year, vehicle.mileageKm);
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
