/**
 * Market-scraper engine — market-agnostic valuation pipeline.
 *
 * Extracted from truflow-premium/src/lib/scraper.ts (and the duplicate copies in
 * TruLens and truinspect) so the SAME engine prices a car in ZA/US/UK, or a
 * property in any market, simply by swapping the MarketConfig. Nothing here is
 * market-specific: currency symbol, country code, Google domain, the classifieds
 * sources and the price bounds all come from the config.
 *
 * Server-only: pulls node + cheerio.
 */

import axios, { AxiosRequestConfig } from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import type { SerperResponse } from './serper';

/* ────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────── */

export interface ScraperSource {
  name: string;
  url: (make: string, model: string, year: string) => string;
  fetchConfig: AxiosRequestConfig;
  selectors: string[];
  /** Query-param name for pagination (default "page"). */
  pageParam?: string;
}

export interface SourceResult {
  name: string;
  count: number;
  avg: number | null;
}

export interface Listing {
  price: number;
  km?: number;
}

export interface ValuationResult {
  averageRetailPrice: number | null;
  tradeEstimate?: number | null;
  priceRange?: { low: number | null; high: number | null };
  confidenceScore?: number;
  listingsFound: number;
  fallbackRequired: boolean;
  searchUrl?: string;
  carsUrl?: string;
  sources: SourceResult[];
  /** Currency symbol of the market the estimate is in (R, $, £). */
  currency?: string;
  mileageAdjusted?: boolean;
  sampleMedianKm?: number | null;
  /** Display unit the source market uses for odometers (km default, mi US/UK).
   *  All km figures in this result stay km — clients convert for display. */
  distanceUnit?: "km" | "mi";
}

export interface JsonAuthConfig {
  url: string;
  tokenPath?: string;
  headers?: Record<string, string>;
  tokenHeader?: string;
}

export interface JsonSourceConfig {
  url: string;
  params?: Record<string, string>;
  resultsPath?: string;
  auth?: JsonAuthConfig;
  priceField?: string;
  titleField?: string;
  makeField?: string;
  modelField?: string;
  yearField?: string;
  kmField?: string;
}

export interface DealerSource {
  name: string;
  url: string;
  match?: string;
  cardSelector?: string;
  enabled?: boolean;
  pages?: number;
  pageParam?: string;
  json?: JsonSourceConfig;
}

/** Every market-varying knob. All env-driven defaults; all overridable. */
export interface MarketConfig {
  /** Market id, e.g. "za" | "us" | "uk" | "housing-za". Used as cache prefix. */
  id: string;
  /** Currency symbol used to detect prices ("R", "$", "£", "R", "€"). */
  currency: string;
  /** Bright Data country code for the Unlocker ("za", "us", "gb", "au"). */
  country: string;
  /** Google SERP domain for the query URL ("google.com", "google.co.uk"). */
  googleDomain: string;
  /** Google location + language params ("gl=za&hl=en"). */
  googleGl: string;
  /** Words appended to the SERP query, e.g. "South Africa", "United Kingdom". */
  googleQuerySuffix: string;
  /** Lower bound for a plausible listing price. */
  minPrice: number;
  /** Upper bound for a plausible listing price. */
  maxPrice: number;
  /** Accept-Language header for plain HTTP. */
  acceptLanguage: string;
  /** Odometer unit the market displays in ("km" default, "mi" for US/UK).
   *  The engine always normalises to km internally — this is a display hint
   *  carried through to the result so clients can convert back. */
  distanceUnit?: "km" | "mi";
  /** Path to data/price-sources.json (dealer layer). Overridable per instance. */
  priceSourcesPath?: string;
  /** Classifieds sites to walk — the SA sites by default. */
  classifieds: ScraperSource[];
  /** Build the user-facing "search the market" fallback URL for a query. */
  searchUrl: (make: string, model: string, year: string) => string;
  /** Build the market's secondary URL (Cars.co.za for SA); optional. */
  secondaryUrl?: (make: string, model: string, year: string) => string;
  /** Name of the secondary classifieds source, if any (tested for searchUrl UI). */
  secondarySourceName?: string;
  /** Override the listing-title matcher. Cars default to make/model/year
   *  matching; housing supplies its own (address/area/bedrooms, no year tilt). */
  titleMatch?: (title: string, make: string, model: string, year: string, match?: string, opts?: { yearTolerance?: number }) => boolean;
}

export interface FetchValuationOptions {
  vin?: string;
  dealerSlug?: string;
  mileage?: number;
  /** Variant/trim string — used for SERP query refinement + title matching but NOT for classifieds URL construction */
  variant?: string;
}

/* ────────────────────────────────────────────────
   MAKE ALIASES (client-safe, no node built-ins)
   ──────────────────────────────────────────────── */

export const CANONICAL_MAKES: Record<string, string> = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "land rover": "Land Rover",
  landrover: "Land Rover",
  "alfa romeo": "Alfa Romeo",
  alfa: "Alfa Romeo",
};

export function urlMake(make: string): string {
  return CANONICAL_MAKES[String(make).toLowerCase().trim()] || String(make);
}

/* ────────────────────────────────────────────────
   ENV-DRIVEN TUNING (shared across markets)
   ──────────────────────────────────────────────── */

const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const REQUEST_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 8000;
const CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000;
const MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES) || 2;

const WORKER_URLS = (
  process.env.SCRAPER_SERVICE_URLS ||
  process.env.SCRAPER_SERVICE_URL ||
  process.env.TRUCRM_SCRAPER_URL ||
  ""
)
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

let workerIndex = 0;
const WORKER_TIMEOUT_MS = Number(process.env.SCRAPER_WORKER_TIMEOUT_MS) || 30000;

const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-ZA,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};

const MIN_DEALER_LISTINGS = 3;
const DEALER_FINAL_THRESHOLD = Math.max(3, Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20);
const MIN_HTTP_LISTINGS = Number(process.env.SCRAPER_MIN_HTTP_LISTINGS) || 8;
const CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
const SERP_TRIGGER_MAX = Math.max(0, Number(process.env.SERP_TRIGGER_MAX) || 6);
const TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 20000;

// SERP env — lazy getters (same dotenv load-order issue as unlocker vars)
function getSerpApiUrl() { return process.env.SERP_API_URL || ""; }
function getSerpApiKey() { return process.env.SERP_API_KEY || ""; }
function getSerpZone() { return process.env.SERP_ZONE || "serp"; }
function getSerpProvider() {
  if (process.env.SERPER_API_KEY) return 'serper';  // Serper.dev is primary when configured
  const url = getSerpApiUrl();
  return (process.env.SERP_PROVIDER || (url.includes("brightdata") ? "brightdata" : url.includes("serpapi") ? "serpapi" : "")).toLowerCase();
}
const SERP_TIMEOUT_MS = 12000;

// Bright Data env — lazy getters because dotenv.config() may run after this module loads
function getBdApiKey() { return process.env.BRIGHTDATA_API_KEY || process.env.SERP_API_KEY || ""; }
function getUnlockerZone() { return process.env.UNLOCKER_ZONE || process.env.BRIGHTDATA_UNLOCKER_ZONE || "unlocker"; }
function isUnlockerEnabled() { return /^(1|true|yes)$/i.test(process.env.SCRAPER_UNLOCKER_ENABLED || ""); }
const UNLOCKER_TIMEOUT_MS = 20000;
const UNLOCKER_MAX_PAGES = 1;

/* ────────────────────────────────────────────────
   SMALL HELPERS
   ──────────────────────────────────────────────── */

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

async function fetchWithRetry(url: string, config: AxiosRequestConfig, retries: number = MAX_RETRIES): Promise<any> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, config);
      return res.data;
    } catch (err: any) {
      lastErr = err;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr!;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function escapeRegex(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Strip ONLY cosmetic / irrelevant noise from model strings for fuzzy matching.
 * Price-material trims (GTI, RS, sport, TSI, TDI, 4x4, etc.) are KEPT because
 * they represent fundamentally different price segments:
 *   Polo Trendline ~R190k  vs  Polo GTI ~R480k
 *   Golf Comfortline ~R350k vs Golf R ~R900k */
const MODEL_NOISE_RE =
  /(?:\b(?:touring|tourer|flagship|executive|luxury|limited|edition|baseline|elegance|comfort|urban|ambition|advance|style|storage|extras|bluemotion|facelift|fl|lci|plus|pack|line|se)\b)/gi;
export function modelCore(text: string): string {
  const s = String(text || "").trim().toLowerCase();
  if (!s || s === "any" || s === "-") return "";
  return s.replace(/[-_]/g, " ").replace(MODEL_NOISE_RE, " ").replace(/\s+/g, " ").trim();
}

const MAKE_ALIASES: Record<string, string[]> = {
  vw: ["volkswagen"],
  volkswagen: ["vw"],
  "mercedes-benz": ["mercedes", "benz", "merc"],
  mercedes: ["mercedes-benz", "benz", "merc"],
  merc: ["mercedes-benz", "mercedes", "benz"],
  "land rover": ["landrover", "landie", "range rover"],
  landrover: ["land rover", "range rover"],
  "alfa romeo": ["alfa"],
  alfa: ["alfa romeo"],
  bmw: ["b.m.w."],
  chevy: ["chevrolet"],
  chevrolet: ["chevy"],
  gwm: ["great wall", "great wall motors"],
};

function makeVariants(make: string): string[] {
  const m = String(make).toLowerCase().trim();
  return [m, ...(MAKE_ALIASES[m] || [])];
}

const YEAR_TOLERANCE = Number(process.env.SCRAPER_YEAR_TOLERANCE) || 1;

function titleMentionsVehicle(title: string, make: string, model: string, year: string, match?: string, opts?: { yearTolerance?: number; variant?: string }): boolean {
  const t = String(title || "");
  const y = parseInt(String(year), 10);
  const tolerance = opts?.yearTolerance ?? YEAR_TOLERANCE;
  if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
    const ym = t.match(/\b(?:19|20)\d{2}\b/);
    if (ym && Math.abs(parseInt(ym[0], 10) - y) > tolerance) return false;
  }
  const makeOk = makeVariants(make).some((kw) => new RegExp(escapeRegex(kw), "i").test(t));
  const q = modelCore(model);
  const modelOk = !q || modelCore(t).includes(q);

  // Engine displacement check (e.g. 2.8, 2.4, 1.4, 2.0, 3.0, 3.2) — prevents mixing engine sizes
  const searchDisp = (match || opts?.variant || model || "").match(/\b(\d\.\d)\b/)?.[1];
  if (searchDisp) {
    const titleDisp = t.match(/\b(\d\.\d)\b/)?.[1];
    if (titleDisp && titleDisp !== searchDisp) return false;
  }

  // Performance badge separation (GTI, RS, AMG, Golf R, Type R):
  // If searching for a standard car (e.g. Golf 1.4 TSI), exclude GTI/R comps that double the price
  const isPerfSearch = /\b(gti|gtd|rs\b|amg\b|type[- ]?r|golf[- ]?r\b)\b/i.test(`${model} ${opts?.variant || ''} ${match || ''}`);
  if (!isPerfSearch) {
    const isPerfTitle = /\b(gti|gtd|rs\b|amg\b|type[- ]?r|golf[- ]?r\b)\b/i.test(t);
    if (isPerfTitle) return false;
  }

  // Variant token check — if variant specifies key badges/engine tokens (e.g. "1.4", "tsi", "gd-6", "4x4"),
  // require at least one key token to match in the title to avoid generic/untrimmed cards polluting the sample
  if (opts?.variant) {
    const vWords = String(opts.variant).toLowerCase().split(/[\s\-_/]+/).filter(w => w.length >= 2);
    const keyTokens = vWords.filter(w => /^(?:\d\.\d|gti|gtd|tdi|tsi|tfsi|amg|4x4|4wd|gd-6|d-4d|v6|v8)$/i.test(w));
    if (keyTokens.length > 0) {
      const lowerTitle = t.toLowerCase();
      const hasKeyToken = keyTokens.some(tok => lowerTitle.includes(tok));
      if (!hasKeyToken) return false;
    }
  }

  const matchOk = !match || new RegExp(escapeRegex(String(match)), "i").test(t);
  return makeOk && modelOk && matchOk;
}

/* ────────────────────────────────────────────────
   RENDER LAYER (worker + Web Unlocker)
   ──────────────────────────────────────────────── */

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
let workerFailCount = 0;
let workerCircuitOpenUntil = 0;

async function renderViaWorker(url: string, maxMs?: number): Promise<string | null> {
  if (WORKER_URLS.length === 0) return null;
  if (Date.now() < workerCircuitOpenUntil) return null;
  const timeoutMs = Math.max(1, Math.min(WORKER_TIMEOUT_MS, maxMs ?? WORKER_TIMEOUT_MS));
  for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
    const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
    try {
      const res = await fetch(`${worker.replace(/\/$/, "")}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body?.ok && typeof body.html === "string") {
        workerFailCount = 0;
        return body.html;
      }
    } catch (err: any) {
      console.warn(`[scraper] headless render failed on ${worker} for ${url}:`, err?.message || err);
    }
  }
  workerFailCount++;
  if (workerFailCount >= CIRCUIT_BREAKER_THRESHOLD) {
    workerCircuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`[scraper] circuit breaker open — skipping headless for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`);
  }
  return null;
}

async function brightDataFetch(targetUrl: string, zone: string, country: string, timeoutMs: number): Promise<string | null> {
  const apiKey = getBdApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(getSerpApiUrl() || "https://api.brightdata.com/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url: targetUrl, format: "raw", country }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`[scraper] brightDataFetch HTTP ${res.status} on ${targetUrl}`);
      return null;
    }
    const text = await res.text();
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        const maybe = parsed?.body ?? parsed?.html ?? parsed?.result;
        if (typeof maybe === "string" && maybe.length > 0) return maybe;
      } catch {
        // not JSON — keep raw
      }
    }
    return text;
  } catch (err: any) {
    console.warn("[scraper] brightDataFetch failed:", err?.message || err);
    return null;
  }
}

export function unlockerConfigured(): boolean {
  return isUnlockerEnabled() && !!getBdApiKey();
}

export async function renderViaUnlocker(url: string, country: string, maxMs?: number): Promise<string | null> {
  if (!unlockerConfigured()) return null;
  console.log(`[scraper] Attempting Bright Data unlocker for: ${url}`);
  return brightDataFetch(url, getUnlockerZone(), country, Math.max(1, Math.min(UNLOCKER_TIMEOUT_MS, maxMs ?? UNLOCKER_TIMEOUT_MS)));
}

export function serpConfigured(): boolean {
  return !!process.env.SERPER_API_KEY || (!!getSerpApiKey() && (getSerpProvider() === "brightdata" || getSerpProvider() === "serpapi"));
}

export function parseSerpResults(json: any, make: string, model: string, year: string, cfg: MarketConfig): Listing[] {
  if (!json || typeof json !== "object") return [];
  const out: Listing[] = [];
  const consider = (title: unknown, snippet: unknown, structuredPrice?: unknown) => {
    const text = `${String(title || "")} ${String(snippet || "")}`.trim();
    if (!text) return;
    if (!titleMentionsVehicle(text, make, model, year)) return;
    let price = typeof structuredPrice === "number" ? jsonPrice(structuredPrice, cfg) : null;
    if (price == null) {
      // Extract ALL prices from snippet text and use median — avoids grabbing
      // price ceilings from range snippets like "From R89,900 to R549,900"
      const allPrices = extractPricesFromText(text, cfg);
      if (allPrices.length === 1) {
        price = allPrices[0];
      } else if (allPrices.length > 1) {
        const sorted = [...allPrices].sort((a, b) => a - b);
        price = sorted[Math.floor(sorted.length / 2)];
      }
    }
    if (price != null) out.push({ price });
  };
  const organic = json.organic_results || json.organic || [];
  for (const r of Array.isArray(organic) ? organic : []) {
    consider(r?.title, r?.snippet ?? r?.description ?? r?.desc);
  }
  const shopping = json.shopping_results || json.shopping || [];
  for (const r of Array.isArray(shopping) ? shopping : []) {
    consider(r?.title, r?.snippet ?? r?.description, r?.extracted_price ?? r?.price);
  }
  const seen = new Set<number>();
  return out.filter((l) => (seen.has(l.price) ? false : (seen.add(l.price), true)));
}

export async function fetchSerpListings(make: string, model: string, year: string, cfg: MarketConfig): Promise<Listing[]> {
  if (!serpConfigured()) return [];
  const isHousing = cfg.id.startsWith("housing");
  const q = isHousing
    ? `${make} ${model === "property" ? "" : model} property for sale South Africa price`
    : `${year} ${make} ${model} for sale ${cfg.googleQuerySuffix} price`;
  try {
    let json: any = null;
    
    // 1. Primary: Serper.dev (cheapest, fastest)
    if (process.env.SERPER_API_KEY) {
      const { serperSearch, toEngineFormat } = await import('./serper');
      const glCode = cfg.googleGl?.replace('gl=', '') || 'za';
      const result = await serperSearch(q, { gl: glCode, num: 20 });
      json = toEngineFormat(result);
    }
    // 2. Fallback: Bright Data SERP
    else if (getSerpProvider() === "brightdata") {
      const googleUrl = `https://${cfg.googleDomain}/search?q=${encodeURIComponent(q)}&${cfg.googleGl}&num=20&brd_json=1`;
      const res = await fetch(getSerpApiUrl() || "https://api.brightdata.com/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${getSerpApiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ zone: getSerpZone(), url: googleUrl, format: "raw" }),
        signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const body = await res.text();
      try { json = JSON.parse(body); } catch { return []; }
    }
    // 3. Fallback: SerpAPI
    else {
      const base = getSerpApiUrl() || "https://serpapi.com/search.json";
      const url = `${base}?engine=google&google_domain=${cfg.googleDomain}&${cfg.googleGl}&num=20&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(getSerpApiKey())}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(SERP_TIMEOUT_MS) });
      if (!res.ok) return [];
      json = await res.json();
    }
    return parseSerpResults(json, make, model, year, cfg);
  } catch (err: any) {
    console.warn("[scraper] SERP layer failed:", err?.message || err);
    return [];
  }
}

/* ────────────────────────────────────────────────
   PRICE EXTRACTION (currency-aware via MarketConfig)
   ──────────────────────────────────────────────── */

function priceScanRe(cfg: MarketConfig): RegExp {
  return new RegExp(`${escapeRegex(cfg.currency)}\\s?(\\d{1,3}(?:[ ,]\\d{3})+|\\d{5,7})`, "g");
}

function priceReg(cfg: MarketConfig): RegExp {
  /* Grouped thousands ("£12,995") or bare digits ("£12995"). The old shape
   * missed bare 4–5 digit prices entirely — fine for grouped ZA sites, wrong
   * for US/UK markup that renders without separators. The currency symbol must
   * immediately precede the digits, so years in the same text never match. */
  return new RegExp(`${escapeRegex(cfg.currency)}\\s?(\\d{1,3}(?:[ ,]\\d{3})+|\\d{4,7})`);
}

function priceFromText(text: string, cfg: MarketConfig): number | null {
  const m = String(text).match(priceReg(cfg));
  if (!m) return null;
  const val = parseInt(m[1].replace(/[^\d]/g, ""), 10);
  return val >= cfg.minPrice && val <= cfg.maxPrice ? val : null;
}

function jsonPrice(v: unknown, cfg: MarketConfig): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else {
    const s = String(v ?? "").trim();
    // Strip thousands-separator commas before extracting digits/decimals
    const clean = s.replace(/,/g, "").replace(/[^\d.]/g, "");
    n = parseFloat(clean);
  }
  return Number.isFinite(n) && n >= cfg.minPrice && n <= cfg.maxPrice ? Math.round(n) : null;
}

function extractPricesFromText(text: string, cfg: MarketConfig): number[] {
  const prices: number[] = [];
  const re = priceScanRe(cfg);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[^\d]/g, ""), 10);
    if (val >= cfg.minPrice && val <= cfg.maxPrice) prices.push(val);
  }
  return prices;
}
export function extractPrices(html: string, selectors: string[], cfg: MarketConfig): number[] {
  const $ = cheerio.load(html);
  const prices: number[] = [];
  for (const sel of selectors) {
    $(sel.trim()).each((_, el) => {
      const val = priceFromText($(el).text(), cfg);
      if (val !== null) prices.push(val);
    });
  }
  if (prices.length === 0) return extractPricesFromText($.text(), cfg);
  return prices;
}

export function extractJsonLd(html: string, cfg: MarketConfig): Listing[] {
  const $ = cheerio.load(html);
  const out: Listing[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw) return;
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return; }
    for (const node of jsonLdNodes(parsed)) {
      const types = ([] as any[]).concat(node["@type"] || []);
      const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
      if (!types.some((t) => VEHICLE_TYPE_RE.test(String(t))) && !offer) continue;
      const price = num(offer?.price ?? offer?.lowPrice ?? node.price);
      if (price == null || price < cfg.minPrice || price > cfg.maxPrice) continue;
      const odo = node.mileageFromOdometer;
      let km = num(odo && typeof odo === "object" ? odo.value : odo);
      /* schema.org unitCode "SMI" = statute miles → km; a unit-less odometer in
       * a miles market defaults to miles too. */
      const unit = odo && typeof odo === "object" ? String(odo.unitCode || "") : "";
      const miles = /^smi$/i.test(unit) || (!unit && cfg.distanceUnit === "mi");
      if (km != null && miles) km = km * 1.60934;
      out.push({
        price: Math.round(price),
        km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined,
      });
    }
  });
  return out;
}

function jsonLdNodes(root: any): any[] {
  const out: any[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    out.push(n);
    if (Array.isArray(n["@graph"])) n["@graph"].forEach(visit);
  };
  visit(root);
  return out;
}

const VEHICLE_TYPE_RE = /car|vehicle|motorcycle|product/i;

function htmlToListings(html: string, selectors: string[], cfg: MarketConfig): Listing[] {
  const jl = extractJsonLd(html, cfg);
  if (jl.length) return jl;
  return extractPrices(html, selectors, cfg).map((price) => ({ price }));
}

function yearTolerant(cfg: MarketConfig, title: string, make: string, model: string, year: string, match?: string, opts?: { yearTolerance?: number; variant?: string }): boolean {
  const fn = cfg.titleMatch || titleMentionsVehicle;
  return fn(title, make, model, year, match, opts);
}

export function extractCardListings(html: string, make: string, model: string, year: string, cfg: MarketConfig, opts?: { variant?: string; yearTolerance?: number }): Listing[] {
  const $ = cheerio.load(html);
  const out: Listing[] = [];
  const seen = new Set<string>();

  const selectCards = () => {
    const anchors = $('a[class*="result-tile"], a[class*="vehicle-card"], a[class*="listing-card"], a[class*="VehicleCard"]');
    if (anchors.length) return anchors;
    return $('[class*="VehicleCard_vehicleCard"], [class*="vehicleCard"], [class*="listing-card"]');
  };
  const cards = selectCards();

  cards.each((_, el) => {
    const $c = $(el);
    const cardText = $c.text().replace(/\s+/g, " ").trim();
    if (cardText.length < 8) return;

    if (!yearTolerant(cfg, cardText, make, model, year, undefined, { yearTolerance: opts?.yearTolerance ?? 1, variant: opts?.variant })) return;

    const priceEl = $c.find('[class^="e-price__"], [class*="price"]').first();
    const price = priceEl.length ? num(priceEl.text()) : priceFromText(cardText, cfg);
    if (price == null || price < cfg.minPrice || price > cfg.maxPrice) return;

    /* Odometer in km or miles (US/UK listings carry miles — normalise to km so
     * the engine's maths stays unit-consistent). */
    const odoMatch = cardText.match(/(\d{1,3}(?:[ ,]\d{3})*)\s?(km|mi(?:les)?\b)/i);
    let km: number | undefined = odoMatch ? num(odoMatch[1]) ?? undefined : undefined;
    if (km != null && odoMatch && /^mi/i.test(odoMatch[2])) km = Math.round(km * 1.60934);
    const key = `${Math.round(price)}|${km ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined });
  });

  return out;
}

export function extractNextDataListings(html: string, make: string, model: string, year: string, cfg: MarketConfig, opts?: { variant?: string; yearTolerance?: number }): Listing[] {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").contents().text() || $("#__NEXT_DATA__").text();
  if (!raw) return [];
  let root: any;
  try { root = JSON.parse(raw); } catch { return []; }
  const out: Listing[] = [];
  const seen = new Set<string>();
  const visit = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") {
      const s = n.trim();
      if ((s[0] === "{" || s[0] === "[") && s.includes('"price"')) {
        try { visit(JSON.parse(s)); } catch { /* not embedded */ }
      }
      return;
    }
    if (typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    const price = typeof n.price === "number" ? n.price : null;
    if (price != null && price >= cfg.minPrice && price <= cfg.maxPrice && (n.make || n.model || n.title)) {
      /* Feeds name the year field differently (year / modelYear / vehicleYear). */
      const yr = n.year ?? n.modelYear ?? n.vehicleYear;
      const variantText = [n.variant, n.variantName, n.derivative, n.trim, n.subTitle, n.subtitle, n.badge, n.engine, n.summary].filter(Boolean).join(" ");
      const title = `${n.title || `${yr ?? ""} ${n.make ?? ""} ${n.model ?? ""}`} ${variantText}`.trim();
      if (yearTolerant(cfg, title, make, model, year, undefined, { yearTolerance: opts?.yearTolerance ?? 1, variant: opts?.variant })) {
        const key = `${n.reference ?? n.id ?? ""}|${price}`;
        if (!seen.has(key)) {
          seen.add(key);
          let km = num(n.mileage ?? n.km ?? n.odometer);
          /* A market's own classifieds report in the market's unit — miles
           * markets (US/UK) normalise to km here so engine maths stays
           * km-denominated everywhere. */
          if (km != null && cfg.distanceUnit === "mi") km = km * 1.60934;
          out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined });
        }
      }
    }
    for (const k of Object.keys(n)) visit(n[k]);
  };
  visit(root);
  return out;
}
export function adjustForMileage(listings: Listing[], targetKm?: number): number[] {
  const raw = listings.map((l) => l.price);
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) return raw;
  const withKm = listings.filter((l): l is Required<Listing> => typeof l.km === "number");
  if (withKm.length < 3) return raw;
  const mx = withKm.reduce((s, l) => s + l.km, 0) / withKm.length;
  const my = withKm.reduce((s, l) => s + l.price, 0) / withKm.length;
  let numr = 0, den = 0;
  for (const l of withKm) { numr += (l.km - mx) * (l.price - my); den += (l.km - mx) ** 2; }
  let slope = den ? numr / den : 0;
  const medPrice = median(withKm.map((l) => l.price)) ?? my;
  const defaultSlope = -(medPrice * 0.03) / 20_000;
  /* Acceptance band expressed as a fraction of the median price per km so it
   * holds in any currency. The old absolute band (R0.2–R3 per km) was tuned
   * for a ~R200k median; -1e-6 … -1.5e-5 of price per km reproduces exactly
   * that at R200k and scales with the car's value in ZAR/USD/GBP alike. */
  const rel = medPrice > 0 ? slope / medPrice : 0;
  if (!(rel < -1e-6 && rel > -1.5e-5)) slope = defaultSlope;
  return listings.map((l) => {
    if (typeof l.km !== "number") return l.price;
    const adj = l.price + slope * (targetKm - l.km);
    return Math.round(Math.min(l.price * 1.2, Math.max(l.price * 0.8, adj)));
  });
}

function iqrFilter(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const s = [...prices].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const filtered = s.filter((v) => v >= lo && v <= hi);
  return filtered.length >= 2 ? filtered : s;
}
export function robustAverage(prices: number[]): number | null {
  if (!prices.length) return null;
  const s = iqrFilter(prices);
  if (s.length <= 12) {
    const mid = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
  }
  const trim = Math.max(1, Math.floor(s.length * 0.1));
  const core = s.slice(trim, s.length - trim);
  return Math.round(core.reduce((a, b) => a + b, 0) / core.length);
}

/* ────────────────────────────────────────────────
   DEALER STOCK LAYER (config-driven via MarketConfig)
   ──────────────────────────────────────────────── */

export function expandDealerUrl(
  source: DealerSource,
  make: string,
  model: string,
  year: string,
  page = 1,
): string {
  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(model);
  const y = String(year);
  const base = source.url.replace(/\{make\}/g, m).replace(/\{model\}/g, mo).replace(/\{year\}/g, y);
  if (page <= 1) return base;
  const param = source.pageParam || "page";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${page}`;
}

function loadDealerSources(cfg?: MarketConfig): DealerSource[] {
  try {
    const p = cfg?.priceSourcesPath || process.env.PRICE_SOURCES_PATH || path.join(process.cwd(), "data", "price-sources.json");
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.dealers) ? parsed.dealers : [];
    return list
      .filter((d: any) => d && d.enabled !== false)
      .filter((d: any) => d && typeof d.url === "string" && /^https?:\/\//i.test(d.url))
      .map((d: any) => ({
        name: String(d.name || d.url),
        url: d.url,
        match: typeof d.match === "string" ? d.match : undefined,
        cardSelector: typeof d.cardSelector === "string" ? d.cardSelector : undefined,
        enabled: d.enabled !== false,
        pages: typeof d.pages === "number" && d.pages >= 1 ? Math.round(d.pages) : undefined,
        pageParam: typeof d.pageParam === "string" ? d.pageParam : undefined,
        json: d.json && typeof d.json === "object" && typeof d.json.url === "string" ? d.json : undefined,
      }));
  } catch (err: any) {
    console.warn("[scraper] could not read dealer price sources:", err?.message || err);
    return [];
  }
}

export function extractDealerPrices(
  html: string,
  source: DealerSource,
  make: string,
  model: string,
  year: string,
  cfg: MarketConfig,
): number[] {
  const $ = cheerio.load(html);
  const prices: number[] = [];
  const cardSelector =
    source.cardSelector || "article, .vehicle, .stock-item, .listing, [class*=\"card\"], [class*=\"vehicle\"]";
  $(cardSelector).each((_, el) => {
    const $el = $(el);
    const title =
      $el.find("h2, h3, h4, .title, [class*=\"title\"], [class*=\"name\"]").first().text() || $el.text();
    if (!titleMentionsVehicle(title, make, model, year, source.match)) return;
    const val = priceFromText($el.text(), cfg);
    if (val !== null) prices.push(val);
  });
  return prices;
}

function jsonListingArray(body: any, cfg: JsonSourceConfig): any[] {
  if (Array.isArray(body)) return body;
  let node = body;
  for (const key of (cfg.resultsPath || "results").split(".").filter(Boolean)) {
    if (node == null) return [];
    node = node[key];
  }
  return Array.isArray(node) ? node : [];
}

export async function fetchJsonDealerPrices(
  source: DealerSource,
  make: string,
  model: string,
  year: string,
  cfg: MarketConfig,
): Promise<Listing[]> {
  const jcfg = source.json!;
  const url = new URL(jcfg.url);
  for (const [k, rawV] of Object.entries(jcfg.params || {})) {
    const v = rawV
      .replace(/\{make\}/g, urlMake(make))
      .replace(/\{model\}/g, String(model))
      .replace(/\{year\}/g, String(year));
    url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    "Accept-Language": cfg.acceptLanguage,
    Accept: "application/json",
  };
  if (jcfg.auth) {
    const aRes = await fetchWithRetry(jcfg.auth.url, { timeout: REQUEST_TIMEOUT, headers });
    const aBody = typeof aRes === "string" ? JSON.parse(aRes) : aRes;
    let tok: unknown = aBody;
    for (const k of (jcfg.auth.tokenPath || "Data.AuthToken").split(".").filter(Boolean)) {
      tok = (tok as any)?.[k];
    }
    if (typeof tok === "string" && tok) headers[jcfg.auth.tokenHeader || "Authorization-Token"] = tok;
    for (const [k, v] of Object.entries(jcfg.auth.headers || {})) headers[k] = v;
  }
  const res = await fetchWithRetry(url.toString(), { timeout: REQUEST_TIMEOUT, headers });
  const body = typeof res === "string" ? JSON.parse(res) : res;
  const items = jsonListingArray(body, jcfg);
  const listings: Listing[] = [];
  for (const item of items) {
    const itemMake = String(item[jcfg.makeField || "make"] ?? "").toLowerCase();
    const itemModel = String(item[jcfg.modelField || "model"] ?? "").toLowerCase();
    const itemTitle = String(item[jcfg.titleField || "title"] ?? "").toLowerCase();
    const itemYear = Number(item[jcfg.yearField || "year"] ?? NaN);
    const makeOk = makeVariants(make).some((kw) => itemMake.includes(kw));
    const q = modelCore(String(model));
    const modelOk = !q || modelCore(itemModel).includes(q) || modelCore(itemTitle).includes(q);
    const qYear = parseInt(year, 10);
    const yearOk = !Number.isFinite(itemYear) || !Number.isFinite(qYear) || Math.abs(itemYear - qYear) <= YEAR_TOLERANCE;
    if (!makeOk || !modelOk || !yearOk) continue;
    const val = jsonPrice(item[jcfg.priceField || "price"], cfg);
    if (val === null) continue;
    const kmRaw = jcfg.kmField ? item[jcfg.kmField] : (item.mileage ?? item.km ?? item.odometer);
    const km = num(kmRaw);
    listings.push({ price: val, km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined });
  }
  const seen = new Set<string>();
  return listings.filter((l) => {
    const k = `${l.price}|${l.km ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function fetchPageForParsing(url: string, cfg: MarketConfig): Promise<string | null> {
  const rendered = await renderViaWorker(url);
  if (rendered) return rendered;
  const unlocked = await renderViaUnlocker(url, cfg.country);
  if (unlocked) return unlocked;
  try {
    return await fetchWithRetry(url, {
      timeout: REQUEST_TIMEOUT,
      headers: { ...DEFAULT_HEADERS, "Accept-Language": cfg.acceptLanguage },
    });
  } catch (err: any) {
    console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
    return null;
  }
}

export { loadDealerSources };
export function buildSourcesFor(cfg: MarketConfig): ScraperSource[] {
  return cfg.classifieds.map((s) => ({
    ...s,
    fetchConfig: { ...s.fetchConfig, headers: { ...DEFAULT_HEADERS, "Accept-Language": cfg.acceptLanguage } },
  }));
}
