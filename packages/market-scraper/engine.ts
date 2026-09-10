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
  year?: number;
  title?: string;
  source?: string;
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
const CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 5);
const SERP_TRIGGER_MAX = Math.max(0, Number(process.env.SERP_TRIGGER_MAX) || 6);
const TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 22000;

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

export function splitModelAndVariant(rawModel: string, rawVariant?: string): { baseModel: string; variant: string } {
  let m = String(rawModel || '').trim();
  let v = String(rawVariant || '').trim();

  const compoundPatterns: Array<{ re: RegExp; base: string; extractVariant?: (match: RegExpMatchArray) => string }> = [
    { re: /^golf\s+(gti|gtd|r\b|1\.4\s*tsi|1\.0\s*tsi|1\.2\s*tsi|2\.0\s*tdi|comfortline|highline|trendline)/i, base: 'Golf', extractVariant: (m) => m[1] },
    { re: /^polo\s+(gti|vivo\b|1\.0\s*tsi|1\.2\s*tsi|1\.4|1\.6|comfortline|highline|trendline)/i, base: 'Polo', extractVariant: (m) => m[1].toLowerCase().startsWith('vivo') ? 'Polo Vivo' : m[1] },
    { re: /^hilux\s+(2\.8\s*gd-6|2\.4\s*gd-6|2\.7\s*vvti|4\.0\s*v6|raider|legend|srx|gr-s)/i, base: 'Hilux', extractVariant: (m) => m[1] },
    { re: /^fortuner\s+(2\.8\s*gd-6|2\.4\s*gd-6|2\.5\s*(?:d-4d)?|3\.0\s*d-4d|4\.0\s*v6|epic)/i, base: 'Fortuner', extractVariant: (m) => m[1] },
    { re: /^corolla\s+(cross|quest|1\.8|1\.6|1\.4|hybrid|prestige|exclusive)/i, base: 'Corolla', extractVariant: (m) => m[1].toLowerCase().includes('cross') || m[1].toLowerCase().includes('quest') ? `Corolla ${m[1]}` : m[1] },
    { re: /^ranger\s+(raptor|2\.0\s*bi-turbo|2\.0\s*si-turbo|3\.2\s*tdci|2\.2\s*tdci|wildtrak|xlt|xl)/i, base: 'Ranger', extractVariant: (m) => m[1] },
    { re: /^(?:3\s*series\s+)?(318[id]|320[id]|325[i]|328[i]|330[id]|335[i]|340[i]|m340i|m3)\b/i, base: '3 Series', extractVariant: (m) => m[1] },
    { re: /^(?:1\s*series\s+)?(116[i]|118[id]|120[id]|125[i]|135[i]|m135i|m140i|1m)\b/i, base: '1 Series', extractVariant: (m) => m[1] },
    { re: /^(?:2\s*series\s+)?(218[id]|220[id]|228[i]|235[i]|m235i|m240i|m2)\b/i, base: '2 Series', extractVariant: (m) => m[1] },
    { re: /^(?:4\s*series\s+)?(420[id]|428[i]|430[id]|435[i]|440[i]|m440i|m4)\b/i, base: '4 Series', extractVariant: (m) => m[1] },
    { re: /^(?:5\s*series\s+)?(520[id]|523[i]|525[id]|528[i]|530[id]|535[id]|540[i]|550[i]|m550i|m5)\b/i, base: '5 Series', extractVariant: (m) => m[1] },
    { re: /^(?:c[- ]?class\s+)?(c180|c200|c220d|c250|c300|c350|c43|c63)\b/i, base: 'C-Class', extractVariant: (m) => m[1] },
    { re: /^(?:a[- ]?class\s+)?(a180|a200|a220d|a250|a35|a45)\b/i, base: 'A-Class', extractVariant: (m) => m[1] },
    { re: /^(?:e[- ]?class\s+)?(e200|e220d|e250|e300|e350|e400|e43|e53|e63)\b/i, base: 'E-Class', extractVariant: (m) => m[1] },
    { re: /^(?:cla[- ]?class\s+|cla\s+)?(cla180|cla200|cla220d|cla250|cla35|cla45)\b/i, base: 'CLA', extractVariant: (m) => m[1] },
    { re: /^a3\s+(1\.0\s*tfsi|1\.4\s*tfsi|1\.8\s*tfsi|2\.0\s*tfsi|2\.0\s*tdi|s3|rs3|sedan|sportback)/i, base: 'A3', extractVariant: (m) => m[1] },
    { re: /^a4\s+(1\.4\s*tfsi|1\.8\s*tfsi|2\.0\s*tfsi|2\.0\s*tdi|3\.0\s*tdi|s4|rs4)/i, base: 'A4', extractVariant: (m) => m[1] },
  ];

  for (const cp of compoundPatterns) {
    const match = m.match(cp.re);
    if (match) {
      if (cp.base === 'Polo' && match[1]?.toLowerCase().startsWith('vivo')) {
        m = 'Polo Vivo';
      } else {
        m = cp.base;
      }
      if (!v && cp.extractVariant) {
        v = cp.extractVariant(match);
      }
      break;
    }
  }

  return { baseModel: m, variant: v };
}

/** Simplify complex or hyper-specific dealer trim strings to closest core sibling trim.
 * e.g. "Audi A3 SS Trendline" -> "Trendline", "Golf 1.4 TSI R-Line DSG" -> "1.4 TSI" */
export function simplifyVariant(variant: string): string {
  const v = String(variant || '').trim();
  if (!v) return '';
  return v
    .replace(/\b(?:ss|special edition|black edition|night package|launch edition|conceptline|plus)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
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

const YEAR_TOLERANCE = 1; // Strict: 1 year only either side

function titleMentionsVehicle(title: string, make: string, model: string, year: string, match?: string, opts?: { yearTolerance?: number; variant?: string }): boolean {
  const t = String(title || "");
  const y = parseInt(String(year), 10);
  const tolerance = opts?.yearTolerance ?? YEAR_TOLERANCE;
  if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
    const ym = t.match(/(?:19|20)\d{2}/);
    if (ym && Math.abs(parseInt(ym[0], 10) - y) > tolerance) return false;
  }
  const makeOk = makeVariants(make).some((kw) => new RegExp(escapeRegex(kw), "i").test(t));
  const q = modelCore(model);
  const modelOk = !q || modelCore(t).includes(q);

  // Exclude armored / bulletproof / specialized conversions unless specifically searched
  const isArmoredSearch = /\b(armou?red|bulletproof|b4|b6|b7)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  if (!isArmoredSearch && /\b(armou?red|bulletproof|b4|b6|b7)\b/i.test(t)) {
    return false;
  }

  // Engine displacement check (e.g. 2.8, 2.4, 1.4, 2.0, 3.0, 3.2) — prevents mixing engine sizes
  const searchDisp = (match || opts?.variant || model || "").match(/\b(\d\.\d)\b/)?.[1];
  if (searchDisp) {
    const titleDisp = t.match(/\b(\d\.\d)\b/)?.[1];
    if (titleDisp && titleDisp !== searchDisp) return false;
  }

  // Fuel Type separation (Diesel vs Petrol)
  const isDieselSearch = /\b(diesel|tdi|d-4d|gd-6|cdi|dci|crdi|tdci|di-d)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const isPetrolSearch = /\b(petrol|tsi|tfsi|vvt-i|vvti|ecoboost)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const isCompDiesel = /\b(diesel|tdi|d-4d|gd-6|cdi|dci|crdi|tdci|di-d)\b/i.test(t);
  const isCompPetrol = /\b(petrol|tsi|tfsi|vvt-i|vvti|ecoboost)\b/i.test(t);
  if (isDieselSearch && isCompPetrol) return false;
  if (isPetrolSearch && isCompDiesel) return false;

  // Cab Type separation for bakkies / commercial vehicles
  const isDoubleCabSearch = /\b(double cab|d\/c|dc\b|4dr)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const isSingleCabSearch = /\b(single cab|s\/c|sc\b)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const isExtraCabSearch = /\b(extra cab|xtra cab|super cab|extended cab|club cab|king cab)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const isCompDC = /\b(double cab|d\/c|dc\b)\b/i.test(t);
  const isCompSC = /\b(single cab|s\/c|sc\b)\b/i.test(t);
  const isCompEC = /\b(extra cab|xtra cab|super cab|extended cab|club cab|king cab)\b/i.test(t);
  if (isDoubleCabSearch && (isCompSC || isCompEC)) return false;
  if (isSingleCabSearch && (isCompDC || isCompEC)) return false;
  if (isExtraCabSearch && (isCompSC || isCompDC)) return false;

  // Drivetrain separation (4x4 vs 4x2)
  const is4x4Search = /\b(4x4|4wd|awd|all-wheel|syncro|4motion|quattro|xdrive|4matic)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const is4x2Search = /\b(4x2|2wd|raised body|rb\b)\b/i.test(`${opts?.variant || ''} ${match || ''}`);
  const isComp4x4 = /\b(4x4|4wd|awd|all-wheel|syncro|4motion|quattro|xdrive|4matic)\b/i.test(t);
  const isComp4x2 = /\b(4x2|2wd|raised body|rb\b)\b/i.test(t);
  if (is4x4Search && isComp4x2) return false;
  if (is4x2Search && isComp4x4) return false;

  // Performance badge separation (GTI, RS, AMG, Golf R, Type R):
  // If searching for a standard car (e.g. Golf 1.4 TSI), exclude GTI/R comps that double the price
  const isPerfSearch = /\b(gti|gtd|rs\b|amg\b|type[- ]?r|golf[- ]?r\b)\b/i.test(`${model} ${opts?.variant || ''} ${match || ''}`);
  if (!isPerfSearch) {
    const isPerfTitle = /\b(gti|gtd|rs\b|amg\b|type[- ]?r|golf[- ]?r\b)\b/i.test(t);
    if (isPerfTitle) return false;
  }

  // Variant token check — if variant specifies key badges/engine tokens (e.g. "1.4", "tsi", "gd-6", "raider", "legend"),
  // require at least one key token to match in the title to avoid generic/untrimmed cards polluting the sample
  if (opts?.variant) {
    const vWords = String(opts.variant).toLowerCase().split(/[\s\-_/]+/).filter(w => w.length >= 2);
    const keyTokens = vWords.filter(w => /^(?:\d\.\d|gti|gtd|tdi|tsi|tfsi|amg|4x4|4wd|gd-6|d-4d|v6|v8|raider|legend|highline|comfortline|trendline)$/i.test(w));
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

export async function renderViaWorker(url: string, maxMs?: number): Promise<string | null> {
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
  const targetYr = parseInt(String(year), 10);
  // Strip variant from model for SERP filtering — SERP query already includes variant,
  // but aggregator pages (Trovit, Automark) often say "Toyota Fortuner" without "2.5"
  const serpBaseModel = model.replace(/\s+\d\.\d.*$/, '').trim() || model;
  
  // Block scam-heavy domains — Facebook Marketplace, Gumtree, OLX, Junk Mail, TikTok
  // These sites have rampant fake/bait pricing that pollutes valuations
  const BLOCKED_DOMAINS = /\b(facebook\.com|gumtree\.co\.za|olx\.co\.za|junkmail\.co\.za|tiktok\.com|bidorbuy\.co\.za)\b/i;
  
  const consider = (title: unknown, snippet: unknown, link?: string, structuredPrice?: unknown) => {
    // Domain filter — reject known scam/junk sources
    if (link && BLOCKED_DOMAINS.test(link)) return;
    
    const text = `${String(title || "")} ${String(snippet || "")}`.trim();
    if (!text) return;
    
    // Exclude auction/bidding results — below-market liquidation prices
    if (/\b(bidding|auction|starting bid|reserve|bid now|sold for)\b/i.test(text)) return;
    
    // Year check: scan ALL years in text, accept if ANY is within ±1 of target
    if (Number.isFinite(targetYr) && targetYr >= 1990 && targetYr <= 2100) {
      const allYears = text.match(/(?:19|20)\d{2}/g);
      if (allYears) {
        const hasMatchingYear = allYears.some(ys => Math.abs(parseInt(ys, 10) - targetYr) <= 1);
        if (!hasMatchingYear) return;
      }
      // No year at all → still allow (aggregator listing pages)
    }
    
    // Use base model (e.g. "Fortuner") not "Fortuner 2.5" for SERP title matching
    if (!titleMentionsVehicle(text, make, serpBaseModel, year)) return;
    
    let price = typeof structuredPrice === "number" ? jsonPrice(structuredPrice, cfg) : null;
    if (price == null) {
      const allPrices = extractPricesFromText(text, cfg);
      if (allPrices.length === 1) {
        price = allPrices[0];
      } else if (allPrices.length > 1) {
        const sorted = [...allPrices].sort((a, b) => a - b);
        price = sorted[Math.floor(sorted.length / 2)];
      }
    }
    if (price != null) {
      const ym = text.match(/(?:19|20)\d{2}/);
      const serpYear = ym ? parseInt(ym[0], 10) : undefined;
      out.push({ price, title: String(title || ''), year: serpYear, source: 'Google (SERP)' });
    }
  };
  const organic = json.organic_results || json.organic || [];
  for (const r of Array.isArray(organic) ? organic : []) {
    consider(r?.title, r?.snippet ?? r?.description ?? r?.desc, r?.link);
  }
  const shopping = json.shopping_results || json.shopping || [];
  for (const r of Array.isArray(shopping) ? shopping : []) {
    consider(r?.title, r?.snippet ?? r?.description, r?.link, r?.extracted_price ?? r?.price);
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
        body: JSON.stringify({ zone: getSerpZone(), url: googleUrl, format: "raw", country }),
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

export function extractJsonLd(html: string, cfg: MarketConfig, make?: string, model?: string, year?: string, opts?: { variant?: string; yearTolerance?: number }): Listing[] {
  const $ = cheerio.load(html);
  const out: Listing[] = [];
  const targetYr = year ? parseInt(String(year), 10) : undefined;
  const tolerance = opts?.yearTolerance ?? 1;

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

      const nodeName = String(node.name || node.title || "");
      const nodeYr = node.modelDate || node.productionDate || node.vehicleModelDate;
      const fullText = `${nodeYr ? `${nodeYr} ` : ""}${nodeName}`.trim();

      if (targetYr && Number.isFinite(targetYr) && targetYr >= 1990 && targetYr <= 2100) {
        const ym = fullText.match(/(?:19|20)\d{2}/);
        if (ym && Math.abs(parseInt(ym[0], 10) - targetYr) > tolerance) {
          continue;
        }
      }
      if (make && model && year && !yearTolerant(cfg, fullText, make, model, year, undefined, opts)) {
        continue;
      }

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

function htmlToListings(html: string, selectors: string[], cfg: MarketConfig, make?: string, model?: string, year?: string, opts?: { variant?: string; yearTolerance?: number }): Listing[] {
  const jl = extractJsonLd(html, cfg, make, model, year, opts);
  if (jl.length) return jl;
  return [];
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
    const anchors = $('a[href*="/car-for-sale/"], a[href*="/for-sale/"], a[href*="/usedcars/"], a[href*="/used-cars/"], a[class*="result-tile"], a[class*="vehicle-card"], a[class*="listing-card"], a[class*="VehicleCard"]');
    if (anchors.length) return anchors;
    return $('[class*="VehicleCard_vehicleCard"], [class*="vehicleCard"], [class*="listing-card"], article, [class*="listing"]');
  };
  const cards = selectCards();

  cards.each((_, el) => {
    const $c = $(el);
    const rawHtml = $c.html() || "";
    const cleanText = rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const cardText = cleanText || $c.text().replace(/\s+/g, " ").trim();
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

    const yrMatch = cardText.match(/(?:19|20)\d{2}/);
    const parsedYear = yrMatch ? parseInt(yrMatch[0], 10) : undefined;
    const targetYr = parseInt(String(year), 10);
    const tolerance = opts?.yearTolerance ?? 1;

    if (parsedYear && Number.isFinite(targetYr) && Math.abs(parsedYear - targetYr) > tolerance) {
      return;
    }

    out.push({
      price: Math.round(price),
      km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined,
      year: parsedYear,
      title: cardText.slice(0, 120),
    });
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
  const targetYr = parseInt(String(year), 10);
  const tolerance = opts?.yearTolerance ?? 1;

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
      const parsedYr = Number(yr);

      // Strict structured year check if available
      if (Number.isFinite(parsedYr) && parsedYr >= 1990 && parsedYr <= 2100 && Number.isFinite(targetYr)) {
        if (Math.abs(parsedYr - targetYr) > tolerance) return;
      }

      const variantText = [n.variant, n.variantName, n.derivative, n.trim, n.subTitle, n.subtitle, n.badge, n.engine, n.summary].filter(Boolean).join(" ");
      const title = `${yr ? `${yr} ` : ""}${n.title || `${n.make ?? ""} ${n.model ?? ""}`} ${variantText}`.trim();
      if (yearTolerant(cfg, title, make, model, year, undefined, { yearTolerance: tolerance, variant: opts?.variant })) {
        const key = `${n.reference ?? n.id ?? ""}|${price}`;
        if (!seen.has(key)) {
          seen.add(key);
          let km = num(n.mileage ?? n.km ?? n.odometer);
          if (km != null && cfg.distanceUnit === "mi") km = km * 1.60934;
          out.push({
            price: Math.round(price),
            km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined,
            year: Number.isFinite(Number(yr)) ? Number(yr) : undefined,
            title: title.slice(0, 120),
          });
        }
      }
    }
    for (const k of Object.keys(n)) visit(n[k]);
  };
  visit(root);
  return out;
}

/**
 * Per-year comp adjustment rates for the SA used-car market.
 * These are NOT total depreciation from new — they represent the
 * price differential per year of age gap between a comp listing and
 * the subject vehicle.  Aligned to TransUnion's ~3.5% good-condition
 * baseline; varies by brand retention profile.
 *
 * | Tier | Rate  | Makes                                           |
 * |------|-------|-------------------------------------------------|
 * |  1   | 3.5%  | Toyota, Isuzu, Land Rover, Jeep, Porsche        |
 * |  2   | 4.0%  | VW, Nissan, Mazda, Suzuki, Subaru, Honda, Ford   |
 * |  3   | 4.5%  | Hyundai, Kia, Mitsubishi, Opel, Chevrolet       |
 * |  4   | 5.5%  | BMW, Mercedes, Audi, Volvo, Mini, Jaguar         |
 * |  5   | 6.5%  | Alfa Romeo, Maserati, Peugeot, Citroën, Fiat    |
 * |  6   | 5.5%  | Budget/new-entrant: Renault, Chery, GWM, etc.   |
 * |  EV  | 8.5%  | Any EV / PHEV (overrides make tier)             |
 */
const DEPRECIATION_BY_MAKE: Record<string, number> = {
  // Tier 1 — hold value exceptionally (3.5% / year gap)
  toyota: 0.035, isuzu: 0.035, "land rover": 0.035, landrover: 0.035, jeep: 0.035, porsche: 0.035,
  // Tier 2 — strong retention (4.0% / year gap)
  volkswagen: 0.04, vw: 0.04, nissan: 0.04, mazda: 0.04, suzuki: 0.04,
  subaru: 0.04, honda: 0.04, ford: 0.04,
  // Tier 3 — mainstream (4.5% / year gap)
  hyundai: 0.045, kia: 0.045, mitsubishi: 0.045, opel: 0.045, chevrolet: 0.045, chevy: 0.045,
  // Tier 4 — premium European (5.5% / year gap)
  bmw: 0.055, "mercedes-benz": 0.055, mercedes: 0.055, audi: 0.055, volvo: 0.055, mini: 0.055, jaguar: 0.055,
  // Tier 5 — fast-depreciating niche (6.5% / year gap)
  "alfa romeo": 0.065, alfa: 0.065, maserati: 0.065, peugeot: 0.065, citroen: 0.065, fiat: 0.065,
  // Tier 6 — budget / new-entrant brands (5.5% / year gap)
  renault: 0.055, chery: 0.055, gwm: 0.055, haval: 0.055, baic: 0.055, jac: 0.055, mahindra: 0.045,
};

const DEFAULT_DEPRECIATION_RATE = 0.045; // 4.5% fallback for unknown makes
const EV_DEPRECIATION_RATE = 0.085;      // EVs lose value fast

export function getDepreciationRate(make?: string, isEv?: boolean): number {
  if (isEv) return EV_DEPRECIATION_RATE;
  if (!make) return DEFAULT_DEPRECIATION_RATE;
  const m = String(make).toLowerCase().trim();
  return DEPRECIATION_BY_MAKE[m] ?? DEFAULT_DEPRECIATION_RATE;
}

/** Compound depreciation adjustment when comp year ≠ subject year.
 *  Positive gap (subject newer than comp) → price UP.
 *  Negative gap (subject older than comp) → price DOWN.
 *  Caps at ±3 years to avoid absurd extrapolation. */
export function adjustForYearGap(price: number, compYear?: number, subjectYear?: number, make?: string, isEv?: boolean): number {
  if (!compYear || !subjectYear || compYear === subjectYear) return price;
  const gap = subjectYear - compYear; // e.g. subject=2015, comp=2016 -> -1 -> price DOWN
  if (Math.abs(gap) > 3) return price; // too far apart to be a useful comp
  const rate = getDepreciationRate(make, isEv);
  // Compound: each year compounds on the previous
  const factor = Math.pow(1 - rate, -gap);
  return Math.round(price * factor);
}

export function adjustForTrim(price: number, compTitle?: string, subjectVariant?: string): number {
  if (!subjectVariant || !compTitle) return price;
  let p = price;
  const sVar = subjectVariant.toLowerCase();
  const cTitle = compTitle.toLowerCase();

  // 1. Trim tier level (Highline vs Comfortline vs Trendline)
  const getTrimScore = (text: string) => {
    if (/\b(highline|exclusive|prestige|autobiography|gt-line|gt\b|vogue|overland|legend|wildtrak|m-sport|m sport|amg line|s-line|s line)\b/i.test(text)) return 3;
    if (/\b(comfortline|advance|sport|dynamic|elegance|srx|raider|limited|xlt|advantage|progressive|se\b)\b/i.test(text)) return 2;
    if (/\b(trendline|base|conceptline|entry|active|essential|s\b|sr\b|start|xl\b|workhorse)\b/i.test(text)) return 1;
    return 0;
  };

  const sScore = getTrimScore(sVar);
  const cScore = getTrimScore(cTitle);

  if (sScore > 0 && cScore > 0 && sScore !== cScore) {
    const diff = sScore - cScore; // e.g. Highline(3) vs Comfortline(2) = +1 -> +7%
    p = Math.round(p * (1 + diff * 0.07));
  }

  // 2. Transmission adjustment (Auto / DSG vs Manual)
  const isSubjectAuto = /\b(auto|automatic|dsg|edc|tiptronic|steptronic|s-tronic|7g-tronic|9g-tronic|cvt|a\/t|at\b)\b/i.test(sVar);
  const isCompAuto = /\b(auto|automatic|dsg|edc|tiptronic|steptronic|s-tronic|7g-tronic|9g-tronic|cvt|a\/t|at\b)\b/i.test(cTitle);
  const isCompManual = /\b(manual|m\/t|mt\b)\b/i.test(cTitle) || (!isCompAuto && /\b(5-speed|6-speed)\b/i.test(cTitle));

  if (isSubjectAuto && isCompManual) {
    p = Math.round(p * 1.045); // Subject is Auto, comp is Manual -> add +4.5%
  } else if (!isSubjectAuto && /\b(manual|m\/t|mt\b)\b/i.test(sVar) && isCompAuto) {
    p = Math.round(p * 0.955); // Subject is Manual, comp is Auto -> subtract -4.5%
  }

  // 3. Drivetrain adjustment for bakkies/SUVs (4x4 vs 4x2)
  const isSubject4x4 = /\b(4x4|4wd|awd|all-wheel|syncro|4motion|quattro|xdrive|4matic)\b/i.test(sVar);
  const isComp4x4 = /\b(4x4|4wd|awd|all-wheel|syncro|4motion|quattro|xdrive|4matic)\b/i.test(cTitle);
  const isComp4x2 = /\b(4x2|2wd|rwd|fwd|raised body|rb\b)\b/i.test(cTitle);

  if (isSubject4x4 && isComp4x2) {
    p = Math.round(p * 1.10); // Subject is 4x4, comp is 4x2 -> add +10%
  } else if (!isSubject4x4 && /\b(4x2|2wd|rb\b)\b/i.test(sVar) && isComp4x4) {
    p = Math.round(p * 0.90); // Subject is 4x2, comp is 4x4 -> subtract -10%
  }

  // 4. Cab Type adjustment for bakkies (Double Cab vs Single Cab vs Super/Extra Cab)
  const isSubjectDC = /\b(double cab|d\/c|dc\b)\b/i.test(sVar);
  const isCompSC = /\b(single cab|s\/c|sc\b)\b/i.test(cTitle);
  const isCompDC = /\b(double cab|d\/c|dc\b)\b/i.test(cTitle);

  if (isSubjectDC && isCompSC) {
    p = Math.round(p * 1.14); // Subject is Double Cab, comp is Single Cab -> add +14%
  } else if (/\b(single cab|s\/c|sc\b)\b/i.test(sVar) && isCompDC) {
    p = Math.round(p * 0.86); // Subject is Single Cab, comp is Double Cab -> subtract -14%
  }

  // 5. Engine displacement differential (sibling variant adjustment)
  // If searching for a 2.5 but comp is a 3.0, the 3.0 is worth more — adjust DOWN
  // Uses a conservative 5% per 0.1L displacement step
  const searchDisp = parseFloat((sVar.match(/(\d\.\d)/)?.[1]) || '0');
  const compDisp = parseFloat((cTitle.match(/(\d\.\d)/)?.[1]) || '0');
  if (searchDisp > 0 && compDisp > 0 && searchDisp !== compDisp) {
    const steps = Math.round((compDisp - searchDisp) * 10); // e.g. 3.0 vs 2.5 = 5 steps
    const adjustment = 1 - (steps * 0.03); // 3% per 0.1L step, conservative
    p = Math.round(p * Math.max(0.7, Math.min(1.3, adjustment))); // cap at ±30%
  }

  return p;
}

export function adjustForMileage(listings: Listing[], _targetKm?: number): number[] {
  // Make NO synthetic slope adjustments for mileage — pass clean raw listing prices
  return listings.map((l) => l.price);
}

export function iqrFilter(prices: number[]): number[] {
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
  if (!prices || !prices.length) return null;
  const s = [...prices].sort((a, b) => a - b);

  // Tiny sample (1–3 comps): bottom comps are usually damaged/auction liquidations.
  // Anchor to the top clean retail comp in that pool.
  if (s.length <= 3) {
    return s[s.length - 1];
  }

  // 4 comps: average of the top 2 comps
  if (s.length === 4) {
    return Math.round((s[2] + s[3]) / 2);
  }

  // Large pool (>= 5 comps): filter IQR outliers and take the dense cluster median
  const filtered = iqrFilter(s);
  if (!filtered.length) return median(s);
  const mid = Math.floor(filtered.length / 2);
  return Math.round(filtered.length % 2 ? filtered[mid] : (filtered[mid - 1] + filtered[mid]) / 2);
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
