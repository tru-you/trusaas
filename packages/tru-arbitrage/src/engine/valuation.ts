import axios from 'axios';
import * as cheerio from 'cheerio';
import { ValuationComp, ValuationResult } from '../types';
import { adjustForMileage, robustAverage, median } from './mileage';
import { CONFIG } from '../config';

const cache = new Map<string, { data: ValuationResult; ts: number }>();

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-ZA,en;q=0.9',
  'Cache-Control': 'no-cache',
};

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
    } catch {
      // Ignore JSON parse errors
    }
  });

  return out;
}

export function extractNextDataComps(html: string, make: string, model: string): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];
  const script = $('script#__NEXT_DATA__').html();
  if (!script) return out;

  try {
    const json = JSON.parse(script);
    const listings =
      json?.props?.pageProps?.listings ||
      json?.props?.pageProps?.searchResults?.listings ||
      json?.props?.pageProps?.initialData?.listings ||
      [];

    if (Array.isArray(listings)) {
      for (const item of listings) {
        const price = cleanNumber(item.price || item.priceValue || item.pricing?.retailPrice);
        const km = cleanNumber(item.mileage || item.mileageValue || item.odometer);
        if (price && price >= CONFIG.MIN_VEHICLE_PRICE && price <= CONFIG.MAX_VEHICLE_PRICE) {
          out.push({
            price: Math.round(price),
            km: km && km > 0 && km < 1000000 ? Math.round(km) : undefined,
            source: 'next-data',
          });
        }
      }
    }
  } catch {
    // Ignore JSON-LD parse errors
  }

  return out;
}

export function extractCssComps(html: string): ValuationComp[] {
  const $ = cheerio.load(html);
  const out: ValuationComp[] = [];
  const selectors = ['[class^="e-price__"]', '.vehicle-price', '.stock-price', '.price'];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/[^\d]/g, '');
      const price = parseInt(text, 10);
      if (price >= CONFIG.MIN_VEHICLE_PRICE && price <= CONFIG.MAX_VEHICLE_PRICE) {
        out.push({ price, source: 'css-selector' });
      }
    });
  }

  return out;
}

export async function fetchLiveMarketValuation(
  make: string,
  model: string,
  year: number,
  mileageKm?: number | null
): Promise<ValuationResult> {
  const key = cacheKey(make, model, year);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CONFIG.SCRAPER_CACHE_TTL_MS) {
    return cached.data;
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
        const res = await axios.get(target.url, {
          headers: DEFAULT_HEADERS,
          timeout: CONFIG.SCRAPER_TIMEOUT_MS,
        });

        if (res.status === 200 && typeof res.data === 'string') {
          const html = res.data;
          const nextData = extractNextDataComps(html, make, model);
          const jsonLd = extractJsonLdComps(html);
          const css = extractCssComps(html);

          const comps = nextData.length ? nextData : jsonLd.length ? jsonLd : css;
          allComps.push(...comps);

          const prices = comps.map((c) => c.price);
          sourcesOutput.push({
            name: target.name,
            count: comps.length,
            avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
          });
        }
      } catch (err: any) {
        // Fallback gracefully on target error
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

  const adjustedComps = adjustForMileage(dedupedComps, mileageKm);
  const avg = robustAverage(adjustedComps);
  const kmValues = dedupedComps.map((c) => c.km).filter((k): k is number => typeof k === 'number');

  const result: ValuationResult = {
    averageRetailPrice: avg,
    listingsFound: dedupedComps.length,
    mileageAdjusted: !!mileageKm && mileageKm > 0 && kmValues.length > 0,
    sampleMedianKm: median(kmValues),
    sources: sourcesOutput,
  };

  cache.set(key, { data: result, ts: Date.now() });
  return result;
}
