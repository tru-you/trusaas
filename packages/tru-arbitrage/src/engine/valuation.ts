import * as cheerio from 'cheerio';
import axios from 'axios';
import { ValuationComp, ValuationResult } from '../types';
import { adjustForMileage, robustAverage, median } from './mileage';
import { calculateValuationConfidence } from './confidence';
import { CONFIG } from '../config';
import { fetchHtmlWithFallback } from './fetch-html';

const MAX_CACHE_SIZE = 200;
const cache = new Map<string, { data: ValuationResult; ts: number }>();

function cacheGet(key: string): ValuationResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CONFIG.SCRAPER_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key: string, data: ValuationResult): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Delete oldest entry
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

function cacheKey(make: string, model: string, year: number | string): string {
  return `${make.toLowerCase()}|${model.toLowerCase()}|${year}`;
}

function cleanNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function extractJsonLdComps(html: string): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const node of nodes) {
        const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
        const rawPrice = offer?.price ?? offer?.lowPrice ?? node.price;
        const price = cleanNumber(rawPrice);
        if (!price || price < CONFIG.MIN_VEHICLE_PRICE || price > CONFIG.MAX_VEHICLE_PRICE) continue;

        const odo = node.mileageFromOdometer;
        const km = cleanNumber(odo && typeof odo === 'object' ? odo.value : odo);

        out.push({
          price: Math.round(price),
          km: km && km > 0 && km < 1000000 ? Math.round(km) : undefined,
          source: 'json-ld',
          url: typeof node.url === 'string' ? node.url : undefined,
        });
      }
    } catch {}
  });

  return out;
}

export function extractNextDataComps(html: string, _make: string, _model: string): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];
  const script = $('script#__NEXT_DATA__').html();
  if (!script) return out;

  try {
    const json = JSON.parse(script);
    const listings =
      json?.props?.pageProps?.listings ||
      json?.props?.pageProps?.searchResults?.listings ||
      [];

      for (const item of listings) {
        const price = cleanNumber(item.price || item.priceValue);
        if (!price || price < CONFIG.MIN_VEHICLE_PRICE || price > CONFIG.MAX_VEHICLE_PRICE) continue;

        const km = cleanNumber(item.mileage);
        const rawUrl = typeof item.url === 'string' ? item.url : undefined;
        out.push({
          price: Math.round(price),
          km: km && km > 0 && km < 1000000 ? Math.round(km) : undefined,
          source: 'next-data',
          url: rawUrl && !rawUrl.startsWith('http') ? `https://www.cars.co.za${rawUrl}` : rawUrl,
        });
      }
  } catch {}

  return out;
}

export function extractCssComps(html: string): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];

  $('[class*="price"], [data-price]').each((_, el) => {
    const text = $(el).text();
    const match = text.match(/R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,7})/i);
    if (!match) return;
    const price = cleanNumber(match[1]);
    if (!price || price < CONFIG.MIN_VEHICLE_PRICE || price > CONFIG.MAX_VEHICLE_PRICE) return;

    out.push({
      price: Math.round(price),
      source: 'css-selector',
    });
  });

  return out;
}

/** Escape regex special chars so a make/model literal can be used in a pattern. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Base model token: lowercase, and truncate at a trim/engine suffix so
 *  "Polo 1.2 TSI" matches a card titled just "Polo". Keeps the leading model
 *  word(s) — never strips the whole token. */
function modelCore(text: string): string {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return '';
  // Drop a trailing engine/trim fragment like "1.2 tsi", "2.8 gd-6 4x4", "comfortline".
  const base = t
    .replace(/\b(1\.[0-9]+(\s?[a-z0-9-]+)*)\b.*$/i, '')
    .replace(/\b(2\.[0-9]+(\s?[a-z0-9-]+)*)\b.*$/i, '')
    .trim();
  return base.split(/\s+/)[0] || t.split(/\s+/)[0];
}

/** Extract {price, km} comps off a SPA card grid. AutoTrader renders each
 *  listing as an <a class*="result-tile"> with an .e-price__ element; Cars.co.za
 *  uses Next.js CSS modules ([class*="VehicleCard_vehicleCard"]). We match both
 *  by card-container class fragments and read price/km/year from the card text
 *  via regex, so the exact markup namespace doesn't matter. Only cards whose
 *  title names the queried make/model within the year tolerance count, so other
 *  models on the same page can't skew the sample.
 *
 *  Trim-aware filtering: when a trim string is provided (e.g. "1.9", "3.0 V6"),
 *  we extract the engine displacement token (e.g. "1.9") and boost comps that
 *  match it. If enough trim-matched comps exist (≥3), we use ONLY those —
 *  preventing higher-spec variants from inflating the average. */
export function extractCardComps(html: string, make: string, model: string, year: number, trim?: string, baseUrl?: string): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];
  const trimMatched: ValuationComp[] = [];
  const seen = new Set<string>();
  const yearTol = Number(process.env.SCRAPER_YEAR_TOLERANCE) || 3;
  const makeKey = make.toLowerCase();
  const modelKey = modelCore(model);

  // Extract engine displacement from trim for variant filtering (e.g. "1.9" from "1.9 TD")
  const trimDisplacement = trim ? trim.match(/\b(\d\.\d)\b/)?.[1] : null;

  const pickCards = () => {
    const tiles = $('a[class*="result-tile"], a[class*="vehicle-card"], a[class*="listing-card"]');
    if (tiles.length) return tiles;
    // Next.js CSS-module VehicleCard container (Cars.co.za) — not a link.
    return $('[class*="VehicleCard_vehicleCard"], [class*="vehicleCard"], [class*="card"]');
  };
  const cards = pickCards();

  cards.each((_, el) => {
    const $c = $(el);
    const text = $c.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 8) return;

    // Year filter.
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch && Math.abs(parseInt(yearMatch[0], 10) - year) > yearTol) return;

    // Make/model filter against the card text.
    const lower = text.toLowerCase();
    const makeOk = lower.includes(makeKey);
    const modelOk = !modelKey || lower.includes(modelKey);
    if (!makeOk || !modelOk) return;

    const priceMatch = text.match(/R\s?((?:\d{1,3}(?:[ ,]\d{3})+|\d{6,7}))/i);
    if (!priceMatch) return;
    const price = cleanNumber(priceMatch[1]);
    if (price == null || price < CONFIG.MIN_VEHICLE_PRICE || price > CONFIG.MAX_VEHICLE_PRICE) return;

    const kmMatch = text.match(/(\d{1,3}(?:[ ,]\d{3})?)\s?km/i);
    const km = kmMatch ? cleanNumber(kmMatch[1]) : undefined;
    const key = `${Math.round(price)}|${km ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Deep-link where the card is an anchor — resolves relative hrefs against
    // the page the comps came from.
    let url: string | undefined;
    const href = $c.attr('href');
    if (href && baseUrl) {
      try { url = new URL(href, baseUrl).toString(); } catch { url = undefined; }
    } else if (href && href.startsWith('http')) {
      url = href;
    }

    const comp: ValuationComp = {
      price: Math.round(price),
      km: km && km > 0 && km < 1000000 ? Math.round(km) : undefined,
      source: 'card',
      url,
    };
    out.push(comp);

    // Check if this comp matches our trim/engine displacement
    if (trimDisplacement && lower.includes(trimDisplacement)) {
      trimMatched.push(comp);
    }
  });

  // If we have enough trim-matched comps, prefer them to avoid variant skew
  // (e.g. D-Max 1.9 comps only, not mixed with 3.0 V6 X-Rider)
  if (trimMatched.length >= 3) {
    return trimMatched;
  }

  return out;
}

/** Filter comps to a price band around the median — reject comps more than
 *  50% above or below median price. This prevents higher-spec variants that
 *  slip through make/model matching from inflating the average. */
function filterPriceBand(comps: ValuationComp[]): ValuationComp[] {
  if (comps.length < 4) return comps;
  const prices = comps.map(c => c.price).sort((a, b) => a - b);
  const med = prices[Math.floor(prices.length / 2)];
  const lo = med * 0.5;
  const hi = med * 1.5;
  const filtered = comps.filter(c => c.price >= lo && c.price <= hi);
  // Only use filtered if it didn't remove too many (keep at least 3)
  return filtered.length >= 3 ? filtered : comps;
}

/** Surgical TransUnion backstop — called ONLY when free-comp confidence sits
 *  below the floor. Mirrors the Lens/Inspect proxy pattern: chargeable calls
 *  relay to Flow's internal route over x-tru-sync-key; Flow unreachable or no
 *  key -> null, fail closed (honest no-valuation, never an invented price).
 *  dealershipId (the dealer's slug from their JWT) is REQUIRED by Flow's
 *  internal route — the deduction lands on THAT dealer's bundle, never the
 *  platform pool. */
async function tuValuationBackstop(mmCode: string, year: number, mileageKm: number | null, dealershipId?: string): Promise<number | null> {
  if (!CONFIG.TRUFLOW_SYNC_KEY || !mmCode || !dealershipId) return null;
  try {
    const res = await axios.post(
      `${CONFIG.FLOW_PREMIUM_URL}/api/internal/imagin8/valuation`,
      { mmCode, year, mileage: mileageKm ?? undefined, dealershipId },
      {
        headers: { 'x-tru-sync-key': CONFIG.TRUFLOW_SYNC_KEY, 'Content-Type': 'application/json' },
        timeout: CONFIG.SCRAPER_TIMEOUT_MS,
      }
    );
    const raw = res.data?.mmRetail ?? res.data?.averageRetailPrice ?? res.data?.retail;
    const price = typeof raw === 'string' ? parseFloat(String(raw).replace(/[^\d.]/g, '')) : Number(raw);
    return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
  } catch (err: any) {
    console.warn(`[valuation] TU backstop unavailable (${err?.message || err}) — thin comps stay unalerted`);
    return null;
  }
}

interface GatheredComps {
  dedupedComps: ValuationComp[];
  sourcesOutput: Array<{ name: string; count: number; avg: number | null }>;
}

/** Fetch raw comps from the classifieds targets (no aggregate math). */
async function gatherComps(make: string, model: string, year: number, trim?: string): Promise<GatheredComps> {
  const allComps: ValuationComp[] = [];
  const sourcesOutput: Array<{ name: string; count: number; avg: number | null }> = [];

  const targets = [
    {
      name: 'AutoTrader',
      url: `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`,
    },
    {
      name: 'Cars.co.za',
      url: `https://www.cars.co.za/usedcars/${encodeURIComponent(make)}/${encodeURIComponent(model)}/?Year=${year}`,
    },
  ];

  await Promise.all(
    targets.map(async (target) => {
      try {
        const html = await fetchHtmlWithFallback(target.url);
        if (html) {
          const nextData = extractNextDataComps(html, make, model);
          const jsonLd = extractJsonLdComps(html);
          const card = extractCardComps(html, make, model, year, trim, target.url);
          const css = extractCssComps(html);

          // Prefer the RICHEST extraction, not the first non-empty. Autotrader's
          // SPA card grid (20-30) beats its single JSON-LD node; Cars.co.za's
          // card grid beats its stub __NEXT_DATA__. On pages where structured
          // data is genuinely richer (older CSS sites), cards are empty and the
          // Next/JSON-LD path still wins.
          const candidates = [nextData, jsonLd, card, css];
          const comps = candidates.reduce((best, c) => (c.length > best.length ? c : best), []);
          allComps.push(...comps);

          const prices = comps.map((c) => c.price);
          sourcesOutput.push({
            name: target.name,
            count: comps.length,
            avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
          });
        }
      } catch {
        sourcesOutput.push({ name: target.name, count: 0, avg: null });
      }
    })
  );

  // Deduplicate comps on price|km
  const seen = new Set<string>();
  const dedupedComps = allComps.filter((c) => {
    const k = `${c.price}|${c.km ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { dedupedComps, sourcesOutput };
}

// Comp-list cache — the cheapest-in-country lookup consumes the same sample as
// the aggregate valuation, so both share the TTL window.
const MAX_COMPS_CACHE = 100;
const compsCache = new Map<string, { comps: ValuationComp[]; ts: number }>();

function compsCacheGet(key: string): ValuationComp[] | null {
  const e = compsCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CONFIG.SCRAPER_CACHE_TTL_MS) {
    compsCache.delete(key);
    return null;
  }
  return e.comps;
}

function compsCacheSet(key: string, comps: ValuationComp[]): void {
  if (compsCache.size >= MAX_COMPS_CACHE) {
    const oldest = compsCache.keys().next().value;
    if (oldest) compsCache.delete(oldest);
  }
  compsCache.set(key, { comps, ts: Date.now() });
}

/** Live comps for a vehicle, CHEAPEST FIRST — the price-check lookup.
 *  Same sample as the aggregate valuation (band-filtered), returned as a
 *  ranked list so a dealer sourcing a specific car sees every live asking
 *  price in the country, lowest first.
 *
 *  opts.skipTuBackstop — the lookup never spends TU: TransUnion is the BOOK
 *  (modelled retail/trade), not live market asking prices. It can anchor the
 *  margin-gate average but it can never fill a "cheapest live listings" list.
 *  Thin comps here are an honest "not enough live listings", not a TU figure. */
export async function fetchLiveComps(
  make: string,
  model: string,
  year: number,
  mileageKm: number | null,
  trim?: string,
  mmCode?: string,
  dealershipId?: string,
  opts?: { skipTuBackstop?: boolean }
): Promise<{ valuation: ValuationResult; comps: ValuationComp[] }> {
  const key = cacheKey(make, model, year) + (trim ? `|${trim.toLowerCase()}` : '');
  const cachedV = cacheGet(key);
  const cachedC = compsCacheGet(key);
  if (cachedV && cachedC) {
    return { valuation: cachedV, comps: cachedC };
  }

  const { dedupedComps, sourcesOutput } = await gatherComps(make, model, year, trim);

  // Filter outlier-priced variants (e.g. base 1.9 vs top 3.0 V6) around the median
  const bandedComps = filterPriceBand(dedupedComps);

  const adjustedComps = adjustForMileage(bandedComps, mileageKm);
  const avg = robustAverage(adjustedComps);
  const kmValues = bandedComps.map((c) => c.km).filter((k): k is number => typeof k === 'number');

  // The moat: score the sample. Below the floor, the ONLY way a vehicle gets a
  // price that can alert is the surgical TU backstop — never an invented comp.
  // The price-check lookup skips it (TU is the book, not live asking prices).
  let confidence = calculateValuationConfidence(bandedComps, dedupedComps.length);

  if ((!avg || confidence < CONFIG.CONFIDENCE_FLOOR) && mmCode && !opts?.skipTuBackstop) {
    const tuPrice = await tuValuationBackstop(mmCode, year, mileageKm, dealershipId);
    if (tuPrice) {
      console.log(`[valuation] TU backstop engaged for ${make} ${model} ${year} (comps: ${dedupedComps.length}, conf ${confidence.toFixed(2)}) -> R${tuPrice.toLocaleString()}`);
      const result: ValuationResult = {
        averageRetailPrice: tuPrice,
        listingsFound: Math.max(1, dedupedComps.length),
        fallbackRequired: false,
        mileageAdjusted: false,
        sampleMedianKm: median(kmValues),
        confidence: 0.8, // TransUnion is authoritative for the exact variant
        sources: [...sourcesOutput, { name: 'TransUnion', count: 1, avg: tuPrice }],
      };
      cacheSet(key, result);
      const comps = [...bandedComps].sort((a, b) => a.price - b.price);
      compsCacheSet(key, comps);
      return { valuation: result, comps };
    }
  }

  // Matches the source scraper contract (truflow-premium/src/lib/scraper.ts):
  // when the free crawler finds zero live comps we return an honest null, never an
  // invented price. A synthetic number that lands below the real asking would
  // silently kill every deal through the margin gate. Caller decides the fallback.
  if (!avg || dedupedComps.length === 0) {
    const result: ValuationResult = {
      averageRetailPrice: null,
      listingsFound: dedupedComps.length,
      fallbackRequired: true,
      mileageAdjusted: false,
      sampleMedianKm: null,
      confidence: 0,
      sources: sourcesOutput,
    };
    cacheSet(key, result);
    compsCacheSet(key, []);
    return { valuation: result, comps: [] };
  }

  const result: ValuationResult = {
    averageRetailPrice: avg,
    listingsFound: dedupedComps.length,
    fallbackRequired: false,
    mileageAdjusted: !!mileageKm && mileageKm > 0 && kmValues.length > 0,
    sampleMedianKm: median(kmValues) || (mileageKm ? Math.round(mileageKm * 1.05) : 110000),
    confidence,
    sources: sourcesOutput,
  };

  cacheSet(key, result);
  const comps = [...bandedComps].sort((a, b) => a.price - b.price);
  compsCacheSet(key, comps);
  return { valuation: result, comps };
}

export async function fetchLiveMarketValuation(
  make: string,
  model: string,
  year: number,
  mileageKm: number | null,
  trim?: string,
  mmCode?: string,
  dealershipId?: string
): Promise<ValuationResult> {
  const { valuation } = await fetchLiveComps(make, model, year, mileageKm, trim, mmCode, dealershipId);
  return valuation;
}
