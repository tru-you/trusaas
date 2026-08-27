import { ValuationComp } from '../types';

export function median(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function trimOutliers(prices: number[], trimRatio = 0.1): number[] {
  if (prices.length < 5) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const trimCount = Math.max(1, Math.floor(sorted.length * trimRatio));
  return sorted.slice(trimCount, sorted.length - trimCount);
}

export function robustAverage(listings: ValuationComp[]): number | null {
  if (listings.length === 0) return null;
  const prices = listings.map((l) => l.price);
  const trimmed = trimOutliers(prices);
  if (trimmed.length === 0) return null;
  const sum = trimmed.reduce((acc, p) => acc + p, 0);
  return Math.round(sum / trimmed.length);
}

/**
 * Adjust each listing's price toward the subject vehicle's target mileage (km).
 * If a comp has 140,000 km and the subject car has 80,000 km, the subject car
 * is worth more than the comp, so the comp's normalized baseline is adjusted.
 */
export function adjustForMileage(listings: ValuationComp[], targetKm?: number | null): ValuationComp[] {
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) {
    return listings;
  }

  const validKmListings = listings.filter((l) => typeof l.km === 'number' && l.km > 0);
  if (validKmListings.length === 0) {
    return listings;
  }

  const sampleMedian = median(validKmListings.map((l) => l.km!));
  if (!sampleMedian) return listings;

  return listings.map((l) => {
    if (typeof l.km !== 'number' || l.km <= 0) return l;

    // Mileage delta in 10,000 km buckets
    const deltaKm = sampleMedian - targetKm;
    // Standard depreciation rate in SA is ~1.2% - 1.5% per 10k km differential
    const adjustmentPct = (deltaKm / 10000) * 0.012;
    const boundedPct = Math.max(-0.25, Math.min(0.25, adjustmentPct)); // Max 25% adjustment

    const adjustedPrice = Math.round(l.price * (1 + boundedPct));
    return {
      price: adjustedPrice,
      km: l.km,
      source: l.source,
    };
  });
}
