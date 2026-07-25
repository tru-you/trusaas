import { MARKET_LISTINGS, MarketListing } from '../data/marketListings';

/* ============================================================================
   Pricing engine — position your unit against comparable competitor listings.
   The maths here is real; only the underlying feed (marketListings) is sample.
   ========================================================================== */

export interface TargetVehicle {
  year: number;
  make: string;
  model: string;
  variant?: string;
  mileage?: number;
  askingPrice: number;
}

/** First two tokens of a variant, e.g. "2.8 GD-6 Raider 4x4 AT" → "2.8 gd-6".
 *  Used to keep a Raider next to a Legend (same engine/family) but away from a
 *  2.4. Loose on purpose — a strict variant match finds nothing on used stock. */
function variantFamily(v?: string): string {
  return (v || '')
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ')
    .trim();
}

export interface Comp extends MarketListing {
  /** How close this listing is to the target — higher is nearer. */
  score: number;
}

export interface PricePosition {
  comps: Comp[];
  count: number;
  median: number | null;
  low: number | null;
  high: number | null;
  /** Your price minus the comp median. Positive = you're dearer. */
  deltaToMedian: number | null;
  /** 1 = cheapest. Rank of your asking price among (comps + you). */
  rank: number | null;
  total: number | null;
  /** Median days the comparable stock has been listed — the speed signal. */
  avgDaysListed: number | null;
  /** Suggested asking band to sit competitively (25th–median of comps). */
  suggestLow: number | null;
  suggestHigh: number | null;
  /** Plain-English verdict for the salesperson. */
  verdict: string;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function percentile(nums: number[], p: number): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

/**
 * Find comparable listings and score how close each is to the target:
 *   same make + model (required)
 *   year within ±1
 *   mileage within ±25% (when the target's mileage is known)
 *   same variant family scores higher, but a different one still counts
 */
export function findComps(target: TargetVehicle, listings: MarketListing[] = MARKET_LISTINGS): Comp[] {
  const fam = variantFamily(target.variant);
  return listings
    .filter((l) => l.make.toLowerCase() === target.make.toLowerCase())
    .filter((l) => l.model.toLowerCase() === target.model.toLowerCase())
    .filter((l) => Math.abs(l.year - target.year) <= 1)
    .filter((l) => {
      if (!target.mileage) return true;
      return Math.abs(l.mileage - target.mileage) <= target.mileage * 0.25;
    })
    .map((l) => {
      let score = 100;
      score -= Math.abs(l.year - target.year) * 15;
      if (target.mileage) score -= Math.min(30, Math.abs(l.mileage - target.mileage) / 4000);
      if (fam && variantFamily(l.variant) === fam) score += 20;
      return { ...l, score: Math.round(score) };
    })
    .sort((a, b) => b.score - a.score);
}

export function pricePosition(target: TargetVehicle, listings: MarketListing[] = MARKET_LISTINGS): PricePosition {
  const comps = findComps(target, listings);
  const prices = comps.map((c) => c.price);

  if (!comps.length) {
    return {
      comps, count: 0, median: null, low: null, high: null, deltaToMedian: null,
      rank: null, total: null, avgDaysListed: null, suggestLow: null, suggestHigh: null,
      verdict: 'No comparable listings in the sample feed for this unit yet.',
    };
  }

  const med = median(prices)!;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const delta = target.askingPrice - med;
  // Rank your price among all (cheapest = 1).
  const all = [...prices, target.askingPrice].sort((a, b) => a - b);
  const rank = all.indexOf(target.askingPrice) + 1;
  const avgDays = median(comps.map((c) => c.daysListed));
  const p25 = percentile(prices, 25)!;

  const overPct = Math.round((delta / med) * 100);
  let verdict: string;
  if (delta > med * 0.04) {
    verdict = `You're about ${Math.abs(overPct)}% above the ${comps.length} comparable units — expect it to sit unless you move on price.`;
  } else if (delta < -med * 0.04) {
    verdict = `You're about ${Math.abs(overPct)}% under the market — room to hold firm, or add margin.`;
  } else {
    verdict = `Priced right in line with the ${comps.length} comparable units.`;
  }

  return {
    comps,
    count: comps.length,
    median: med,
    low,
    high,
    deltaToMedian: delta,
    rank,
    total: all.length,
    avgDaysListed: avgDays,
    suggestLow: Math.min(p25, med),
    suggestHigh: med,
    verdict,
  };
}
