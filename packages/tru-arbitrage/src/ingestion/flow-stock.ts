/**
 * Flow stock ingestion — the "My Stock" feed.
 *
 * Reads a dealer's PUBLISHED stock straight off their TruFlow public feed
 * (GET /api/public/stock?dealer=<slug> on premium.tru-saas.com): no auth, slug
 * scoped, structured vehicle rows. The dealer's slug rides on their JWT, so a
 * dealer can only ever pull their own feed.
 *
 * Why the public feed and not an internal route: published stock is exactly
 * what is "on the market" — drafts aren't aging on market yet and SOLD units
 * are gone. The engine builds its own days-on-market tracking from first-seen,
 * so the feed not carrying daysInInventory is not a gap.
 *
 * Flow unreachable -> empty array, fail-open for the scan (the classifieds and
 * SERP lanes still run); the dealer's stock simply isn't repriced this run.
 */
import axios from 'axios';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';

export async function fetchFlowStockBySlug(slug: string): Promise<RawFbListing[]> {
  const url = `${CONFIG.FLOW_PREMIUM_URL}/api/public/stock?dealer=${encodeURIComponent(slug)}`;
  try {
    const res = await axios.get(url, { timeout: CONFIG.SCRAPER_TIMEOUT_MS });
    const vehicles = Array.isArray(res.data?.vehicles) ? res.data.vehicles : [];
    const dealerName = String(res.data?.dealer || slug);
    const out: RawFbListing[] = [];

    for (const v of vehicles) {
      const price = Number(v?.price ?? 0);
      if (!price || price < CONFIG.MIN_VEHICLE_PRICE || price > CONFIG.MAX_VEHICLE_PRICE) continue;

      out.push({
        id: `flow_${v.stockNumber || v.id || Math.random().toString(36).slice(2)}`,
        // Distinct from 'dealer_direct' (other dealers' websites via SERP — a
        // BUY-side market source). This is the token dealer's OWN stock.
        source: 'flow_stock',
        url: `${CONFIG.FLOW_PREMIUM_URL}/vehicle/?stock=${encodeURIComponent(String(v.stockNumber || v.id || ''))}`,
        title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ').trim(),
        description: String(v.description || ''),
        final_price: price,
        price,
        currency: 'ZAR',
        location: 'South Africa',
        seller_id: slug,
        seller_name: dealerName,
        images: Array.isArray(v.images) ? v.images : [],
        date_posted: v.updatedAt || new Date().toISOString(),
        // Flow's live-derived stock age — the real days-held statistic. This is
        // the My-Stock DOM signal: a unit the dealer has held long takes an offer.
        days_listed: Number.isFinite(Number(v.daysInInventory)) ? Number(v.daysInInventory) : undefined,
        // Typed structured fields — the native normalizer reads these directly
        year: v.year ? Number(v.year) : undefined,
        make: v.make ? String(v.make) : undefined,
        model: v.model ? String(v.model) : undefined,
        trim: v.trim ? String(v.trim) : undefined,
        mileage: v.mileage ? Number(v.mileage) : undefined,
      });
    }

    console.log(`[flow-stock] ${slug}: ${out.length} published vehicles from Flow feed`);
    return out;
  } catch (err: any) {
    console.warn(`[flow-stock] ${slug}: feed unreachable (${err?.message || err}) — stock not repriced this run`);
    return [];
  }
}

export async function fetchFlowStockBySlugs(slugs: string[]): Promise<RawFbListing[]> {
  if (!slugs || slugs.length === 0) return [];
  const results = await Promise.all(slugs.map((s) => fetchFlowStockBySlug(s)));
  return results.flat();
}