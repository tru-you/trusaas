/**
 * Valuation confidence — the moat.
 *
 * A deal is only as good as the comps behind it. This score (0–1) blends:
 *   1. Sample size  — how many live comps the crawler actually found.
 *   2. Price-band tightness — how tightly the comps cluster around their own
 *      median (IQR/median). Tight band = one coherent variant; wide band =
 *      mixed variants leaking in, average meaningless.
 *
 * Capped at 0.95 — a scraped sample is never certain. Comps carry no reliable
 * listing-date signal yet, so recency is not scored (deliberately omitted, not
 * assumed good). Alerts below CONFIDENCE_FLOOR never fire; the surgical
 * TransUnion backstop is the only way a thin-comp vehicle gets priced.
 */
import { ValuationComp } from '../types';

export function calculateValuationConfidence(comps: ValuationComp[], listingsFound: number): number {
  // 1. Sample size factor
  let sizeScore = 0;
  if (listingsFound >= 11) sizeScore = 0.85;
  else if (listingsFound >= 6) sizeScore = 0.75;
  else if (listingsFound >= 3) sizeScore = 0.5;
  else if (listingsFound >= 1) sizeScore = 0.2;
  else return 0; // zero comps — nothing to be confident about

  // 2. Price-band tightness (IQR / median)
  let tightness = 0;
  if (comps.length >= 4) {
    const prices = comps.map((c) => c.price).filter((p) => p > 0).sort((a, b) => a - b);
    if (prices.length >= 4) {
      const q1 = prices[Math.floor(prices.length * 0.25)];
      const q3 = prices[Math.min(prices.length - 1, Math.ceil(prices.length * 0.75) - 1)];
      const med = prices[Math.floor(prices.length / 2)];
      if (med > 0 && q3 >= q1) {
        const spread = (q3 - q1) / med;
        if (spread <= 0.15) tightness = 0.1;
        else if (spread >= 0.5) tightness = -0.1;
      }
    }
  }

  return Math.max(0, Math.min(0.95, sizeScore + tightness));
}