/**
 * Native normalizer — the zero-heuristic path for structured feeds.
 *
 * Flow's public stock feed hands over clean, typed vehicle rows. There is
 * nothing to guess: no regex extraction, no Gemini spend, no damage/wanted
 * false positives (a dealer's own DMS record is not a junk listing). When any
 * core field is missing, returns null and the listing falls through to the
 * regex fastpath like any other source.
 */
import { RawFbListing, NormalizedVehicle } from '../types';
import { CANONICAL_MAKES } from './make-aliases';

export function normalizeViaNativeScraper(raw: RawFbListing): NormalizedVehicle | null {
  if (raw.source !== 'flow_stock') return null;

  const title = (raw.title || '').trim();

  // Year: typed first, then title fallback
  let year = raw.year;
  if (!year) {
    const m = title.match(/\b(19|20)\d{2}\b/);
    if (m) year = parseInt(m[0], 10);
  }

  // Make: typed first, canonicalized; else first non-year title token
  const makeRaw = raw.make || title.replace(/^\s*(19|20)\d{2}\s*/, '').split(/\s+/)[0] || '';
  const make = makeRaw ? (CANONICAL_MAKES[makeRaw.toLowerCase().trim()] || makeRaw.trim()) : '';

  // Model/trim: typed only — free-text model parsing stays the regex path's job
  const model = raw.model ? String(raw.model).trim() : '';

  // Price: typed, sanity-bounded by the same gates every source obeys
  const price = Number(raw.final_price ?? raw.price);
  const askingPrice = Number.isFinite(price) && price > 0 ? Math.round(price) : null;

  // Mileage: typed, else parsed from description
  let mileageKm: number | null = raw.mileage && raw.mileage > 0 ? Math.round(raw.mileage) : null;
  if (!mileageKm) {
    const m = (raw.description || '').match(/\b(\d{4,6})\s?(?:km|kms)\b/i);
    if (m) mileageKm = parseInt(m[1], 10);
  }

  if (!year || !make || !model || !askingPrice) return null;

  const images = Array.isArray(raw.images)
    ? raw.images
    : typeof raw.images === 'string'
    ? [raw.images]
    : [];

  return {
    rawId: raw.id || raw.item_id || String(Math.random()),
    source: 'dealer_direct',
    url: raw.url || '',
    title,
    year,
    make,
    model,
    trim: raw.trim || undefined,
    mileageKm,
    askingPrice,
    location: raw.location || 'South Africa',
    sellerId: raw.seller_id,
    sellerName: raw.seller_name,
    images,
    isDamagedOrSalvage: false,
    isWantedAd: false,
    confidence: 1.0,
    normalizedBy: 'native_scraper',
  };
}