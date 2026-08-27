import { CANONICAL_MAKES, COMMON_MODELS_BY_MAKE } from './make-aliases';
import { RawFbListing, NormalizedVehicle } from '../types';
import { CONFIG } from '../config';

const YEAR_RE = /\b(19\d{2}|20[0-2]\d)\b/;
const PRICE_K_RE = /R?\s?(\d{1,3}(?:\.\d+)?)\s?k\b/i;
const PRICE_FULL_RE = /R\s?(\d{1,3}(?:[ ,.]\d{3})+|\d{5,7})/i;
const MILEAGE_RE = /\b(\d{1,3}(?:[ ,.]\d{3})+|\d{2,3}\s?k|\d{4,6})\s?(?:km|kms|kilometers|kilometres|k)\b/i;

const DAMAGE_KEYWORDS = [
  'non runner',
  'non-runner',
  'not running',
  'code 3',
  'code 4',
  'salvage',
  'rebuilt',
  'accident damaged',
  'accident damage',
  'gearbox issue',
  'engine knock',
  'for spares',
  'spares only',
  'stripping for parts',
];

const WANTED_KEYWORDS = [
  'looking for',
  'wanted',
  'looking to buy',
  'swop for',
  'swap for',
  'swap',
  'wtb',
];

export function parsePrice(text: string, rawPrice?: number | string): number | null {
  if (typeof rawPrice === 'number' && rawPrice >= CONFIG.MIN_VEHICLE_PRICE && rawPrice <= CONFIG.MAX_VEHICLE_PRICE) {
    return Math.round(rawPrice);
  }
  if (typeof rawPrice === 'string') {
    const rawNum = parseInt(rawPrice.replace(/[^\d]/g, ''), 10);
    if (!isNaN(rawNum) && rawNum >= CONFIG.MIN_VEHICLE_PRICE && rawNum <= CONFIG.MAX_VEHICLE_PRICE) {
      return rawNum;
    }
  }

  // Check text for R...k (e.g. R135k -> 135000)
  const kmMatch = text.match(PRICE_K_RE);
  if (kmMatch) {
    const kVal = parseFloat(kmMatch[1]);
    const calc = Math.round(kVal * 1000);
    if (calc >= CONFIG.MIN_VEHICLE_PRICE && calc <= CONFIG.MAX_VEHICLE_PRICE) return calc;
  }

  // Check text for full R price (e.g. R145 000)
  const fullMatch = text.match(PRICE_FULL_RE);
  if (fullMatch) {
    const num = parseInt(fullMatch[1].replace(/[^\d]/g, ''), 10);
    if (num >= CONFIG.MIN_VEHICLE_PRICE && num <= CONFIG.MAX_VEHICLE_PRICE) return num;
  }

  return null;
}

export function parseMileage(text: string): number | null {
  const m = text.match(MILEAGE_RE);
  if (!m) return null;
  const raw = m[1].toLowerCase().trim();
  if (raw.endsWith('k')) {
    const kVal = parseFloat(raw.replace('k', ''));
    if (!isNaN(kVal) && kVal >= 1 && kVal <= 999) return Math.round(kVal * 1000);
  }
  const clean = parseInt(raw.replace(/[^\d]/g, ''), 10);
  if (!isNaN(clean) && clean >= 1000 && clean <= 999000) {
    return clean;
  }
  return null;
}

export function parseYear(text: string): number | null {
  const m = text.match(YEAR_RE);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const currentYear = new Date().getFullYear();
  if (y >= 1995 && y <= currentYear + 1) return y;
  return null;
}

export function detectMakeAndModel(text: string): { make: string; model: string; trim?: string } | null {
  const cleanText = text.toLowerCase();
  
  for (const [alias, canonical] of Object.entries(CANONICAL_MAKES)) {
    const makeRegex = new RegExp(`\\b${alias}\\b`, 'i');
    if (makeRegex.test(cleanText)) {
      // Find model
      const knownModels = COMMON_MODELS_BY_MAKE[canonical] || [];
      for (const model of knownModels) {
        const modelRegex = new RegExp(`\\b${model.replace(/[-_]/g, ' ')}\\b`, 'i');
        if (modelRegex.test(cleanText)) {
          return { make: canonical, model };
        }
      }
      // If make matched but model not in top list, extract next token
      const matchPos = cleanText.search(makeRegex);
      const afterMake = text.slice(matchPos).replace(makeRegex, '').trim().split(/\s+/);
      if (afterMake.length > 0 && afterMake[0].length >= 2) {
        return { make: canonical, model: afterMake[0] };
      }
    }
  }
  return null;
}

export function normalizeViaRegex(raw: RawFbListing): NormalizedVehicle | null {
  const combined = `${raw.title || ''} ${raw.description || ''}`.trim();
  if (!combined) return null;

  const lower = combined.toLowerCase();
  const isDamagedOrSalvage = DAMAGE_KEYWORDS.some((kw) => lower.includes(kw));
  const isWantedAd = WANTED_KEYWORDS.some((kw) => lower.includes(kw));

  const year = parseYear(raw.title) || parseYear(combined);
  const price = parsePrice(combined, raw.final_price ?? raw.price);
  const mileageKm = parseMileage(combined);
  const makeModel = detectMakeAndModel(combined);

  if (!year || !price || !makeModel) {
    return null; // Let LLM fallback try to parse
  }

  const images = Array.isArray(raw.images)
    ? raw.images
    : typeof raw.images === 'string'
    ? [raw.images]
    : [];

  return {
    rawId: raw.id || raw.item_id || String(Math.random()),
    source: raw.source || 'facebook',

    url: raw.url || '',
    title: raw.title || '',
    year,
    make: makeModel.make,
    model: makeModel.model,
    trim: makeModel.trim,
    mileageKm,
    askingPrice: price,
    location: raw.location || 'South Africa',
    sellerId: raw.seller_id,
    sellerName: raw.seller_name,
    images,
    isDamagedOrSalvage,
    isWantedAd,
    confidence: mileageKm ? 0.95 : 0.8,
    normalizedBy: 'regex_fastpath',
  };
}

