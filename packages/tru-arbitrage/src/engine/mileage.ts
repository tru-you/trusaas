import * as fs from 'fs';
import * as path from 'path';
import { ValuationComp } from '../types';

// ── TU Kilometer Adjustment Data ──────────────────────────────────────────
// TransUnion's official mileage bands by vehicle type (A=passenger, B=commercial)
// and registration year. Each band (VL/L/A/H/VH) has min/exact/max km ranges.
// The "A" (average) band's exact value is the expected km for a given age.

interface KmBand { min: number; exact: number; max: number; }
type KmTable = Record<string, Record<string, Record<string, KmBand>>>;

let tuKmData: KmTable | null = null;

function loadKmData(): KmTable {
  if (tuKmData) return tuKmData;
  const dataPath = path.join(__dirname, '..', 'data', 'tu-kilometers.json');
  try {
    tuKmData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log('[mileage] Loaded TransUnion kilometer adjustment table');
  } catch {
    tuKmData = {};
  }
  return tuKmData!;
}

/** Find the expected "average" km for a vehicle type + year from TU data. */
function tuExpectedKm(vehicleType: string, year: number): number | null {
  const table = loadKmData();
  const bands = table[vehicleType]?.[String(year)];
  if (!bands?.A) return null;
  return bands.A.exact;  // The "Average" band's exact km
}

/** TU-calibrated depreciation rate per 10k km, derived from the band spread.
 *  For a given vehicle type + year, the rate = (High price adjustment) / (km spread).
 *  We use the ratio between the "Average" and "High" band mileages as a proxy:
 *  a wider spread means km has less impact on value in that segment. */
function tuDepreciationRate(vehicleType: string, year: number): number | null {
  const table = loadKmData();
  const bands = table[vehicleType]?.[String(year)];
  if (!bands?.A || !bands?.L) return null;
  // The spread from Low to Average gives us a per-km value sensitivity.
  // SA passenger cars: roughly 1.0-1.5% per 10k km.
  // SA commercials (bakkies): roughly 0.8-1.2% per 10k km (hold value better).
  const avgKm = bands.A.exact;
  const lowKm = bands.L.exact;
  if (avgKm <= 0 || lowKm <= 0) return null;
  // The delta between low and avg km bands represents a meaningful depreciation step.
  // We normalize this to a per-10k-km rate.
  const kmDelta = avgKm - lowKm;
  if (kmDelta <= 0) return null;
  // Typical SA depreciation: ~12-15% of value across the L-to-A band gap.
  // So rate ≈ 0.13 / (gap in 10k units) = 0.13 / (gap/10000)
  const ratePerBucket = 0.13 / (kmDelta / 10000);
  // Clamp to sane range: 0.5% to 2.5% per 10k km
  return Math.max(0.005, Math.min(0.025, ratePerBucket));
}

// ── Core Functions ────────────────────────────────────────────────────────

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
 * Adjust each comp's price toward the subject vehicle's target mileage (km).
 * Uses TransUnion's official km adjustment data when available (vehicle type + year),
 * falling back to a standard 1.2% per 10k km rate.
 */
export function adjustForMileage(
  listings: ValuationComp[],
  targetKm?: number | null,
  vehicleType?: string,
  year?: number
): ValuationComp[] {
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) {
    return listings;
  }

  const validKmListings = listings.filter((l) => typeof l.km === 'number' && l.km > 0);
  if (validKmListings.length === 0) {
    return listings;
  }

  const sampleMedian = median(validKmListings.map((l) => l.km!));
  if (!sampleMedian) return listings;

  // Try TU-calibrated rate first, fall back to standard SA rate
  const tuRate = (vehicleType && year) ? tuDepreciationRate(vehicleType, year) : null;
  const ratePerBucket = tuRate ?? 0.012; // 1.2% per 10k km default

  return listings.map((l) => {
    if (typeof l.km !== 'number' || l.km <= 0) return l;

    const deltaKm = sampleMedian - targetKm;
    const adjustmentPct = (deltaKm / 10000) * ratePerBucket;
    const boundedPct = Math.max(-0.25, Math.min(0.25, adjustmentPct));

    const adjustedPrice = Math.round(l.price * (1 + boundedPct));
    return {
      price: adjustedPrice,
      km: l.km,
      source: l.source,
      url: l.url,
    };
  });
}
