/**
 * market-scraper — market-agnostic valuation pipeline.
 *
 * One engine, any market. `fetchValuation(make, model, year, opts, market?)`
 * prices a car (or, with a housing market, a property) by walking dealer stock,
 * classifieds, headless renders and an optional SERP tier. `market` defaults to
 * South Africa, so existing callers are unchanged.
 */

import {
  MarketConfig,
  FetchValuationOptions,
  ValuationResult,
  Listing,
  SourceResult,
  DealerSource,
  ScraperSource,
  loadDealerSources,
  fetchJsonDealerPrices,
  extractDealerPrices,
  expandDealerUrl,
  fetchPageForParsing,
  fetchSerpListings,
  serpConfigured,
  extractJsonLd,
  extractNextDataListings,
  extractPrices,
  adjustForMileage,
  robustAverage,
  median,
  modelCore,
  buildSourcesFor,
} from "./engine";

// Forward the full public surface so per-app `src/lib/scraper.ts` loses nothing.
export * from "./engine";

import { sa } from "./markets/sa";
import { us } from "./markets/us";
import { uk } from "./markets/uk";
import { housingZa } from "./markets/housing";

export const markets = { za: sa, us, uk, housingZa };
export { sa };

export type { MarketConfig, FetchValuationOptions, ValuationResult, Listing, SourceResult, DealerSource };

const DEFAULT_MARKET: MarketConfig = sa;
const CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000;
const TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 20000;
const MIN_DEALER_LISTINGS = Number(process.env.SCRAPER_MIN_DEALER_LISTINGS) || 3;
const DEALER_FINAL_THRESHOLD = Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20;
const CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
const SERP_TRIGGER_MAX = Number(process.env.SERP_TRIGGER_MAX) || 6;

/* ── per-market cache ─────────────────────────── */

interface CacheEntry { data: ValuationResult; ts: number; }
const cache = new Map<string, CacheEntry>();

function cacheKey(marketId: string, make: string, model: string, year: string, vin?: string, dealerSlug?: string): string {
  return `${marketId}|${(dealerSlug || "default").toLowerCase()}|${make.toLowerCase()}|${model.toLowerCase()}|${year}|${(vin || "novin").toUpperCase()}`;
}
function cacheGet(key: string): ValuationResult | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.data;
}
function cachePut(key: string, data: ValuationResult): void { cache.set(key, { data, ts: Date.now() }); }

export function clearValuationCache(): void { cache.clear(); }

/* ── helpers ──────────────────────────────────── */

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function pageUrl(src: ScraperSource, make: string, model: string, year: string, page: number): string {
  const base = src.url(make, model, year);
  if (page <= 1) return base;
  const param = src.pageParam || "page";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${page}`;
}

/** Classifieds parser for a market: Next.js __NEXT_DATA__ → JSON-LD → class scan. */
function classifiedParser(cfg: MarketConfig, make: string, model: string, year: string) {
  return (html: string, selectors: string[]): Listing[] => {
    const nd = extractNextDataListings(html, make, model, year, cfg);
    if (nd.length) return nd;
    return htmlToAnyListings(html, selectors, cfg);
  };
}

function htmlToAnyListings(html: string, selectors: string[], cfg: MarketConfig): Listing[] {
  const jl = extractJsonLd(html, cfg);
  if (jl.length) return jl;
  return extractPrices(html, selectors, cfg).map((price) => ({ price }));
}

/* ── main ─────────────────────────────────────── */

export async function fetchValuation(
  make: string,
  model: string,
  year: string,
  opts: FetchValuationOptions = {},
  market: MarketConfig = DEFAULT_MARKET,
): Promise<ValuationResult> {
  const cfg = market;
  const baseModel = modelCore(model);
  const key = cacheKey(cfg.id, make, baseModel, year, opts.vin, opts.dealerSlug);
  const cached = cacheGet(key);
  if (cached) return cached;

  const y = String(year);
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const budgetLeft = () => deadline - Date.now();

  const dealers: DealerSource[] = loadDealerSources(cfg);
  const jsonDealers = dealers.filter((d) => !!d.json);
  const htmlDealers = dealers.filter((d) => !d.json);

  const collect = async (d: DealerSource): Promise<{ name: string; count: number; avg: number | null; listings: Listing[] }> => {
    try {
      const listings: Listing[] = d.json
        ? await fetchJsonDealerPrices(d, make, baseModel, y, cfg)
        : await (async () => {
            const pages = Math.max(1, d.pages ?? 2);
            const found: number[] = [];
            for (let p = 1; p <= pages; p++) {
              if (budgetLeft() <= 0) break;
              const url = expandDealerUrl(d, make, baseModel, y, p);
              let html: string | null = null;
              let prices: number[] = [];
              try { html = await fetchPageForParsing(url, cfg); }
              catch (err: any) { console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err); }
              if (html) prices = extractDealerPrices(html, d, make, baseModel, y, cfg);
              if (prices.length === 0) break;
              found.push(...prices);
            }
            return [...new Set(found)].map((price) => ({ price }));
          })();
      const prices = listings.map((l) => l.price);
      return {
        name: `Dealer · ${d.name}`,
        count: prices.length,
        avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null,
        listings,
      };
    } catch (err: any) {
      console.warn(`[scraper] dealer ${d.name} failed:`, err?.message || err);
      return { name: `Dealer · ${d.name}`, count: 0, avg: null, listings: [] };
    }
  };

  const jsonResults = await Promise.all(jsonDealers.map(collect));
  const jsonListings = jsonResults.flatMap((r) => r.listings);
  let htmlResults: { name: string; count: number; avg: number | null; listings: Listing[] }[] = [];
  if (jsonListings.length < MIN_DEALER_LISTINGS && htmlDealers.length) {
    htmlResults = await mapPool(htmlDealers, 2, collect);
  }
  const dealerResults = [...jsonResults, ...htmlResults];
  const dealerListings = dealerResults.flatMap((r) => r.listings);
  const dealerSources: SourceResult[] = dealerResults.map(({ name, count, avg }) => ({ name, count, avg }));

  const targetKm = Number(opts.mileage);
  const kmOf = (ls: Listing[]) => median(ls.map((l) => l.km).filter((k): k is number => typeof k === "number"));

  if (dealerListings.length >= DEALER_FINAL_THRESHOLD) {
    const adjusted = adjustForMileage(dealerListings, targetKm);
    const data: ValuationResult = {
      averageRetailPrice: robustAverage(adjusted),
      listingsFound: adjusted.length,
      fallbackRequired: false,
      sources: dealerSources,
      currency: cfg.currency,
      distanceUnit: cfg.distanceUnit,
      mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && dealerListings.some((l) => typeof l.km === "number"),
      sampleMedianKm: kmOf(dealerListings),
    };
    cachePut(key, data);
    return data;
  }

  const sources = buildSourcesFor(cfg);
  const parse = classifiedParser(cfg, make, baseModel, y);
  const perSource = await Promise.all(
    sources.map(async (src) => {
      const acc: Listing[] = [];
      for (let p = 1; p <= CLASSIFIEDS_PAGES; p++) {
        if (budgetLeft() <= 0) break;
        const url = pageUrl(src, make, baseModel, y, p);
        let listings: Listing[] = [];
        try {
          const html = await fetchPageForParsing(url, cfg);
          if (html) listings = parse(html, src.selectors);
        } catch (err: any) { console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err); }
        if (listings.length === 0) break;
        acc.push(...listings);
      }
      const seen = new Set<string>();
      const deduped = acc.filter((l) => { const k = `${l.price}|${l.km ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
      return { name: src.name, listings: deduped };
    }),
  );

  const classifiedListings: Listing[] = [];
  const sourcesOutput: SourceResult[] = [];
  for (const { name, listings } of perSource) {
    classifiedListings.push(...listings);
    const prices = listings.map((l) => l.price);
    sourcesOutput.push({ name, count: prices.length, avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null });
  }

  let serpListings: Listing[] = [];
  if (dealerListings.length + classifiedListings.length < SERP_TRIGGER_MAX && serpConfigured()) {
    serpListings = await fetchSerpListings(make, baseModel, y, cfg);
    if (serpListings.length) {
      sourcesOutput.push({ name: "Google (SERP)", count: serpListings.length, avg: Math.round(serpListings.reduce((s, l) => s + l.price, 0) / serpListings.length) });
    }
  }

  const combined = [...dealerListings, ...classifiedListings, ...serpListings];
  const crossSeen = new Set<string>();
  const allListings = combined.filter((l) => { const k = `${l.price}|${l.km ?? ""}`; if (crossSeen.has(k)) return false; crossSeen.add(k); return true; });
  const finalSources = [...dealerSources, ...sourcesOutput];

  const searchUrl = cfg.searchUrl(make, baseModel, y);
  const carsUrl = cfg.secondarySourceName && sources.some((s) => s.name === cfg.secondarySourceName)
    ? cfg.secondaryUrl?.(make, baseModel, y)
    : undefined;

  if (allListings.length === 0) {
    const data: ValuationResult = { averageRetailPrice: null, listingsFound: 0, fallbackRequired: true, currency: cfg.currency, distanceUnit: cfg.distanceUnit, searchUrl, carsUrl, sources: finalSources, mileageAdjusted: false, sampleMedianKm: null };
    cachePut(key, data);
    return data;
  }

  const adjustedAll = adjustForMileage(allListings, targetKm);
  const data: ValuationResult = {
    averageRetailPrice: robustAverage(adjustedAll),
    listingsFound: adjustedAll.length,
    fallbackRequired: dealerListings.length < MIN_DEALER_LISTINGS,
    searchUrl, carsUrl,
    sources: finalSources,
    currency: cfg.currency,
    distanceUnit: cfg.distanceUnit,
    mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && allListings.some((l) => typeof l.km === "number"),
    sampleMedianKm: kmOf(allListings),
  };
  cachePut(key, data);
  return data;
}
