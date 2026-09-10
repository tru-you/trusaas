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
  extractCardListings,
  extractNextDataListings,
  extractPrices,
  adjustForMileage,
  robustAverage,
  median,
  modelCore,
  buildSourcesFor,
  simplifyVariant,
  splitModelAndVariant,
  adjustForYearGap,
  adjustForTrim,
  iqrFilter,
} from "./engine";

// Forward the full public surface so per-app `src/lib/scraper.ts` loses nothing.
export * from "./engine";

import { sa } from "./markets/sa";
import { uk } from "./markets/uk";
import { housingZa } from "./markets/housing";

export const markets = { za: sa, uk, housingZa };
const ALLOWED_MARKETS = (process.env.MARKETS || '').split(',').map(s => s.trim()).filter(Boolean);
const filteredMarkets: Record<string, MarketConfig> = ALLOWED_MARKETS.length
  ? Object.fromEntries(Object.entries(markets).filter(([id]) => ALLOWED_MARKETS.includes(id)))
  : markets;
export { filteredMarkets as activeMarkets };
export { sa };

export type { MarketConfig, FetchValuationOptions, ValuationResult, Listing, SourceResult, DealerSource };

const DEFAULT_MARKET: MarketConfig = sa;
// TODO: export from engine.ts to avoid drift
const CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000;
const TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 22000;
const MIN_DEALER_LISTINGS = Number(process.env.SCRAPER_MIN_DEALER_LISTINGS) || 3;
const DEALER_FINAL_THRESHOLD = Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20;
const CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 5);
const SERP_TRIGGER_MAX = Number(process.env.SERP_TRIGGER_MAX) || 6;

/* ── per-market cache ─────────────────────────── */

interface CacheEntry { data: ValuationResult; ts: number; }
const cache = new Map<string, CacheEntry>();

function cacheKey(marketId: string, make: string, model: string, year: string, vin?: string, dealerSlug?: string, mileage?: number): string {
  return `${marketId}|${(dealerSlug || "default").toLowerCase()}|${make.toLowerCase()}|${model.toLowerCase()}|${year}|${(vin || "novin").toUpperCase()}|${mileage != null && Number.isFinite(mileage) ? Math.round(mileage) : "nomileage"}`;
}
function cacheGet(key: string): ValuationResult | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.data;
}
const MAX_CACHE_SIZE = Number(process.env.SCRAPER_MAX_CACHE_SIZE) || 500;
function cachePut(key: string, data: ValuationResult): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

export function clearValuationCache(): void { cache.clear(); }

/* ── helpers ──────────────────────────────────── */

// TODO: export from engine.ts
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
function classifiedParser(cfg: MarketConfig, make: string, model: string, year: string, variant?: string, yearTolerance = 1) {
  return (html: string, selectors: string[]): Listing[] => {
    const opts = { variant, yearTolerance };
    const nd = extractNextDataListings(html, make, model, year, cfg, opts);
    if (nd.length) return nd;
    const cards = extractCardListings(html, make, model, year, cfg, opts);
    if (cards.length) return cards;
    const jl = extractJsonLd(html, cfg, make, model, year, opts);
    if (jl.length) return jl;
    return [];
  };
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
  const { baseModel: cleanModel, variant: resolvedVariant } = splitModelAndVariant(model, opts.variant);
  const baseModel = modelCore(cleanModel);
  const variant = resolvedVariant || opts.variant || "";
  const targetKm = Number(opts.mileage);
  const subjYear = parseInt(String(year), 10);
  const coreVariant = simplifyVariant(variant);

  const cacheModel = variant ? `${cleanModel} ${variant}` : cleanModel;
  const key = cacheKey(cfg.id, make, cacheModel, year, opts.vin, opts.dealerSlug, targetKm);
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

  const kmOf = (ls: Listing[]) => median(ls.map((l) => l.km).filter((k): k is number => typeof k === "number"));

  const sources = buildSourcesFor(cfg);

  // Progressive search runner across classified sources
  const runClassifiedPass = async (queryModel: string, queryYear: string, queryVariant?: string, tolerance = 1) => {
    const parse = classifiedParser(cfg, make, queryModel, queryYear, queryVariant, tolerance);
    const passResults = await Promise.all(
      sources.map(async (src) => {
        const acc: Listing[] = [];
        for (let p = 1; p <= CLASSIFIEDS_PAGES; p++) {
          if (budgetLeft() <= 0) break;
          const url = pageUrl(src, make, queryModel, queryYear, p);
          let listings: Listing[] = [];
          try {
            const html = await fetchPageForParsing(url, cfg);
            if (html) listings = parse(html, src.selectors);
          } catch (err: any) {
            console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
          }
          acc.push(...listings.map(l => ({ ...l, source: src.name })));
          if (acc.length >= 20) break; // Plenty of clean comps, avoid timeout
        }
        return { name: src.name, listings: acc };
      })
    );
    return passResults;
  };

  // ── STAGE 1: Exact Match (Same Year + Exact Trim) ──
  let classifiedListings: Listing[] = [];
  const sourcesOutput: SourceResult[] = [];
  const stage1Results = await runClassifiedPass(baseModel, y, variant, 0);
  for (const { name, listings } of stage1Results) {
    classifiedListings.push(...listings);
  }

  // ── STAGE 2: Closest Sibling Variant (Same Year) ──
  // If exact trim gave < 3 comps, relax to closest sibling trim on the SAME year
  if (classifiedListings.length < 3 && coreVariant && coreVariant.toLowerCase() !== variant.toLowerCase()) {
    const stage2Results = await runClassifiedPass(baseModel, y, coreVariant, 0);
    for (const { listings } of stage2Results) {
      classifiedListings.push(...listings);
    }
  }

  // ── STAGE 3: Adjacent Year Backup (±2 Years) ──
  // Bright Data often ignores year URL filters, so titleMentionsVehicle year check
  // is the real gate. Widen to ±2 years; adjustForYearGap handles the price correction.
  if (classifiedListings.length < 3 && Number.isFinite(subjYear)) {
    const adjacentYears = [subjYear - 1, subjYear + 1, subjYear - 2, subjYear + 2].map(String);
    const adjacentResults = await Promise.all(
      adjacentYears.map((ay) => runClassifiedPass(baseModel, ay, coreVariant || variant, 0))
    );
    for (const results of adjacentResults) {
      for (const { listings } of results) {
        classifiedListings.push(...listings);
      }
    }
  }

  // ── STAGE 4: Sibling Variant Fallback (Same Year, No Variant Filter) ──
  // If exact variant is too rare (e.g. Fortuner 2.5 D-4D), drop the variant filter
  // and let adjustForTrim's displacement differential handle the price correction.
  if (classifiedListings.length < 3) {
    const stage4Results = await runClassifiedPass(baseModel, y, undefined, 0);
    for (const { listings } of stage4Results) {
      classifiedListings.push(...listings);
    }
  }
  console.log(`[SCRAPER-DEBUG] After all stages: ${classifiedListings.length} classified comps`, classifiedListings.map(l => ({ price: l.price, year: l.year, title: l.title?.slice(0, 80), source: l.source })));

  // Compile classified source summary
  for (const src of sources) {
    const list = classifiedListings.filter((l) => l.source === src.name);
    const prices = list.map((l) => l.price);
    const srcMin = prices.length ? Math.min(...prices) : null;
    const srcMax = prices.length ? Math.max(...prices) : null;
    sourcesOutput.push({
      name: src.name,
      count: prices.length,
      avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null,
      min: srcMin,
      max: srcMax,
    });
  }

  let serpListings: Listing[] = [];
  const serpModel = variant ? `${baseModel} ${variant}` : baseModel;
  if (dealerListings.length + classifiedListings.length < SERP_TRIGGER_MAX && serpConfigured()) {
    serpListings = await fetchSerpListings(make, serpModel, y, cfg);
    if (serpListings.length) {
      sourcesOutput.push({
        name: "Google (SERP)",
        count: serpListings.length,
        avg: Math.round(serpListings.reduce((s, l) => s + l.price, 0) / serpListings.length),
      });
    }
  }

  const combined = [...dealerListings, ...classifiedListings, ...serpListings];
  const crossSeen = new Set<string>();
  const allListings = combined.filter((l) => {
    const k = `${l.price}|${l.km ?? ""}|${l.year ?? ""}`;
    if (crossSeen.has(k)) return false;
    crossSeen.add(k);
    return true;
  });
  const finalSources = [...dealerSources, ...sourcesOutput];

  const searchUrl = cfg.searchUrl(make, baseModel, y);
  const carsUrl = cfg.secondarySourceName && sources.some((s) => s.name === cfg.secondarySourceName)
    ? cfg.secondaryUrl?.(make, baseModel, y)
    : undefined;

  function calcConfidenceScore(prices: number[]): number {
    const n = prices.length;
    if (n === 0) return 0;
    if (n === 1) return 30;
    const avg = prices.reduce((a, b) => a + b, 0) / n;
    const variance = prices.reduce((a, b) => a + (b - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0.5;
    const base = n >= 15 ? 85 : n >= 5 ? 70 : 45;
    const penalty = Math.min(20, Math.round(cv * 80));
    return Math.max(15, Math.min(99, base - penalty + (n >= 20 ? 5 : 0)));
  }

  function calcPriceRange(prices: number[]): { low: number | null; high: number | null } {
    if (!prices.length) return { low: null, high: null };
    const filtered = iqrFilter(prices);
    const sorted = [...filtered].sort((a, b) => a - b);
    if (sorted.length === 1) return { low: sorted[0], high: sorted[0] };
    const lowIdx = Math.floor(sorted.length * 0.05);
    const highIdx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return { low: sorted[lowIdx], high: sorted[highIdx] };
  }

  if (allListings.length === 0) {
    const data: ValuationResult = {
      averageRetailPrice: null,
      tradeEstimate: null,
      priceRange: { low: null, high: null },
      confidenceScore: 0,
      listingsFound: 0,
      fallbackRequired: true,
      currency: cfg.currency,
      distanceUnit: cfg.distanceUnit,
      searchUrl,
      carsUrl,
      sources: finalSources,
      mileageAdjusted: false,
      sampleMedianKm: null,
    };
    cachePut(key, data);
    return data;
  }

  // If target mileage is provided and we have enough comps with mileage,
  // prioritize comps within a ±45,000 km proximity window
  let candidateListings = allListings;
  if (targetKm > 0 && allListings.length >= 6) {
    const kmComps = allListings.filter((l) => typeof l.km === "number" && l.km > 0);
    if (kmComps.length >= 4) {
      const tightProximity = kmComps.filter((l) => Math.abs((l.km as number) - targetKm) <= 45000);
      if (tightProximity.length >= 4) {
        candidateListings = tightProximity;
      }
    }
  }

  // Apply make-aware Year-Gap adjustment and Trim differential adjustment
  const isEv = /\b(electric|ev\b|bev\b|phev|e-tron|id\.\d|ioniq\s*[56]|model\s*[3sy]|leaf|zs\s*ev)\b/i.test(`${variant} ${cleanModel}`);
  const adjustedComps = candidateListings.map((l) => {
    let p = l.price;
    if (l.year && Number.isFinite(subjYear)) {
      p = adjustForYearGap(p, l.year, subjYear, make, isEv);
    }
    if (l.title && variant) {
      p = adjustForTrim(p, l.title, variant);
    }
    return p;
  });
  console.log(`[SCRAPER-DEBUG] Raw prices:`, candidateListings.map(l => l.price));
  console.log(`[SCRAPER-DEBUG] Adjusted prices:`, adjustedComps);
  console.log(`[SCRAPER-DEBUG] Titles present:`, candidateListings.map(l => !!l.title));

  // Filter statistical outliers (e.g. keying errors, armored/extreme conversions, salvage)
  const validComps = iqrFilter(adjustedComps);

  const avgRetail = robustAverage(validComps);
  const range = calcPriceRange(validComps);
  const confidence = calcConfidenceScore(validComps);
  const tradeEst = avgRetail != null ? Math.round(avgRetail * 0.85) : null;

  const data: ValuationResult = {
    averageRetailPrice: avgRetail,
    tradeEstimate: tradeEst,
    priceRange: range,
    confidenceScore: confidence,
    listingsFound: validComps.length,
    fallbackRequired: dealerListings.length < MIN_DEALER_LISTINGS,
    searchUrl,
    carsUrl,
    sources: finalSources,
    currency: cfg.currency,
    distanceUnit: cfg.distanceUnit,
    mileageAdjusted: false,
    sampleMedianKm: kmOf(allListings),
  };
  cachePut(key, data);
  return data;
}
