import * as cheerio from 'cheerio';
import { ValuationComp, ValuationResult } from '../types';
import { adjustForMileage, robustAverage, median } from './mileage';
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
      out.push({
        price: Math.round(price),
        km: km && km > 0 && km < 1000000 ? Math.round(km) : undefined,
        source: 'next-data',
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
 *  models on the same page can't skew the sample. */
export function extractCardComps(html: string, make: string, model: string, year: number): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];
  const seen = new Set<string>();
  const yearTol = Number(process.env.SCRAPER_YEAR_TOLERANCE) || 3;
  const makeKey = make.toLowerCase();
  const modelKey = modelCore(model);

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

    out.push({
      price: Math.round(price),
      km: km && km > 0 && km < 1000000 ? Math.round(km) : undefined,
      source: 'card',
    });
  });

  return out;
}

export async function fetchLiveMarketValuation(
  make: string,
  model: string,
  year: number,
  mileageKm: number | null
): Promise<ValuationResult> {
  const key = cacheKey(make, model, year);
  const cached = cacheGet(key);
  if (cached) {
    return cached;
  }

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
          const card = extractCardComps(html, make, model, year);
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

  let adjustedComps = adjustForMileage(dedupedComps, mileageKm);
  let avg = robustAverage(adjustedComps);
  const kmValues = dedupedComps.map((c) => c.km).filter((k): k is number => typeof k === 'number');

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
      sources: sourcesOutput,
    };
    cacheSet(key, result);
    return result;
  }

  const result: ValuationResult = {
    averageRetailPrice: avg,
    listingsFound: dedupedComps.length,
    fallbackRequired: false,
    mileageAdjusted: !!mileageKm && mileageKm > 0 && kmValues.length > 0,
    sampleMedianKm: median(kmValues) || (mileageKm ? Math.round(mileageKm * 1.05) : 110000),
    sources: sourcesOutput,
  };

  cacheSet(key, result);
  return result;
}
