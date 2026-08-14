import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// ==================== TYPES ====================

export interface ScraperSource {
  name: string;
  url: (make: string, model: string, year: string) => string;
  fetchConfig: AxiosRequestConfig;
  selectors: string[];
}

export interface SourceResult {
  name: string;
  count: number;
  avg: number | null;
}

export interface ValuationResult {
  averageRetailPrice: number | null;
  listingsFound: number;
  fallbackRequired: boolean;
  searchUrl?: string;
  carsUrl?: string;
  sources: SourceResult[];
  /** True when the sample was normalised toward the subject car's mileage
   *  (i.e. a target km was supplied AND at least one listing carried km). */
  mileageAdjusted?: boolean;
  /** Median km of the listings that carried mileage — lets the UI show what
   *  the market's typical km is vs the subject car. Null when none had km. */
  sampleMedianKm?: number | null;
}

export interface JsonAuthConfig {
  /** URL that issues the bearer token (the dealer's own public "get token"
   *  endpoint, keyed by the client key their public site embeds). */
  url: string;
  /** Dotted path to the token inside the auth response, default "Data.AuthToken". */
  tokenPath?: string;
  /** Static headers sent with every data call (e.g. Authorization-ID). */
  headers?: Record<string, string>;
  /** Header name carrying the token, default "Authorization-Token". */
  tokenHeader?: string;
}

export interface JsonSourceConfig {
  /** Base URL of the public JSON API (no user credentials — a dealer's own
   *  public site feeds it, respecting the tenant boundary). */
  url: string;
  /** Query params applied to every request; {make} / {model} / {year} are
   *  replaced with the query (make canonicalised, e.g. VW -> Volkswagen). */
  params?: Record<string, string>;
  /** Path to the listing array inside the JSON body, default "results". */
  resultsPath?: string;
  /** Optional token flow for APIs gated behind the site's own auth header. */
  auth?: JsonAuthConfig;
  priceField?: string;
  titleField?: string;
  makeField?: string;
  modelField?: string;
  yearField?: string;
  /** Field holding the listing's mileage/odometer km, for mileage-adjusted
   *  valuation. Falls back to common names (mileage/km/odometer) when unset. */
  kmField?: string;
}

/** A dealer stock page the app knows about. Configured in
 *  data/price-sources.json (path override via PRICE_SOURCES_PATH), so the
 *  layer only exists on instances that opt in. `match` narrows which listing
 *  titles count — e.g. "Golf|Polo" — and `cardSelector` overrides the default
 *  listing-card lookup for sites whose markup is unusual. `pages` fetches
 *  additional ?page=N pages (identical prices are deduped, so a site that
 *  ignores the param just returns page 1's data once); `pageParam` overrides
 *  the query-param name for sites that don't use "page". A `json` config
 *  switches the dealer to its public JSON API — no worker render needed. */
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

// ==================== CONFIG ====================

const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const REQUEST_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 8000;

const CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000;

const MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES) || 2;

/** The dedicated headless renderers (trusaas-crm-scraper service, or TruCRM's
 *  in-app scraper). SCRAPER_SERVICE_URLS accepts a comma-separated list —
 *  requests are round-robined across them and fail over to the next on error,
 *  so running several worker processes (each with its own PORT) scales
 *  renders horizontally. When unset, every render layer falls back to plain
 *  HTTP — exactly today's behaviour. */
const WORKER_URLS = (
  process.env.SCRAPER_SERVICE_URLS ||
  process.env.SCRAPER_SERVICE_URL ||
  process.env.TRUCRM_SCRAPER_URL ||
  ''
)
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

let workerIndex = 0;

const WORKER_TIMEOUT_MS = Number(process.env.SCRAPER_WORKER_TIMEOUT_MS) || 60000;

/** Run `fn` over `items` with at most `size` promises in flight at once. */
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

/** Dealer stock pages live in data/price-sources.json beside the inventory
 *  file, so they ride the same mounted disk and survive deploys. */
const PRICE_SOURCES_PATH =
  process.env.PRICE_SOURCES_PATH || path.join(process.cwd(), 'data', 'price-sources.json');

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-ZA,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const MIN_PRICE = 10_000;
const MAX_PRICE = 50_000_000;

/** Below this many dealer listings the market average is too thin to trust on
 *  its own — the pipeline then falls back and blends in classifieds. */
const MIN_DEALER_LISTINGS = 3;

// ==================== CACHE ====================

interface CacheEntry {
  data: ValuationResult;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(make: string, model: string, year: string, vin?: string, dealerSlug?: string): string {
  return `${(dealerSlug || 'default').toLowerCase()}|${make.toLowerCase()}|${model.toLowerCase()}|${year}|${(vin || 'novin').toUpperCase()}`;
}

function cacheGet(key: string): ValuationResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cachePut(key: string, data: ValuationResult): void {
  cache.set(key, { data, ts: Date.now() });
}

// ==================== SOURCE DEFINITIONS ====================

import { CANONICAL_MAKES, urlMake } from './makeAliases';

export { CANONICAL_MAKES, urlMake };

function buildSources(): ScraperSource[] {
  const sources: ScraperSource[] = [];

  if (process.env.SCRAPER_AUTOTRADER_DISABLED !== 'true') {
    sources.push({
      name: 'AutoTrader',
      url: (make, model, year) =>
        `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&year=${year}`,
      fetchConfig: {
        timeout: REQUEST_TIMEOUT,
        headers: DEFAULT_HEADERS,
      },
      selectors: (process.env.SCRAPER_AUTOTRADER_SELECTORS || '[class^="e-price__"]')
        .split(','),
    });
  }

  if (process.env.SCRAPER_CARSCOZA_DISABLED !== 'true') {
    sources.push({
      name: 'Cars.co.za',
      url: (make, model, year) =>
        `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
      fetchConfig: {
        timeout: REQUEST_TIMEOUT,
        headers: DEFAULT_HEADERS,
      },
      selectors: (process.env.SCRAPER_CARSCOZA_SELECTORS || '.vehicle-price')
        .split(','),
    });
  }

  return sources;
}

// ==================== PRICE EXTRACTION ====================

/** Regex fallback: scan raw text for R-prefixed prices when CSS selectors miss
 *  (e.g. AutoTrader renames their class). */
const PRICE_SCAN_RE = /R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,7})/g;

function extractPricesFromText(text: string): number[] {
  const prices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = PRICE_SCAN_RE.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[^\d]/g, ''), 10);
    if (val >= MIN_PRICE && val <= MAX_PRICE) prices.push(val);
  }
  PRICE_SCAN_RE.lastIndex = 0;
  return prices;
}

function extractPrices(html: string, selectors: string[]): number[] {
  const $ = cheerio.load(html);
  const prices: number[] = [];
  for (const sel of selectors) {
    $(sel.trim()).each((_, el) => {
      const val = parseInt($(el).text().replace(/[^\d]/g, ''), 10);
      if (val >= MIN_PRICE && val <= MAX_PRICE) prices.push(val);
    });
  }
  if (prices.length === 0) {
    return extractPricesFromText($.text());
  }
  return prices;
}

// ==================== LISTINGS · JSON-LD · MILEAGE ====================

/** A single market listing: its price, and its mileage when we could read it. */
export interface Listing {
  price: number;
  km?: number;
}

/** Parse any numeric-ish value ("R 245 000", "120000.00", 120000) to a number. */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Flatten a JSON-LD document: handles arrays, @graph, and nested objects. */
function jsonLdNodes(root: any): any[] {
  const out: any[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    out.push(n);
    if (Array.isArray(n['@graph'])) n['@graph'].forEach(visit);
  };
  visit(root);
  return out;
}

const VEHICLE_TYPE_RE = /car|vehicle|motorcycle|product/i;

/** Pull {price, km} listings from a page's schema.org JSON-LD. This is far more
 *  stable than CSS classes (the markup can reskin; the structured data rarely
 *  does) and — the real prize — it carries mileageFromOdometer, so the sample
 *  can be normalised to the subject car's km. Returns [] when a page has no
 *  usable structured data, so callers fall back to CSS/regex exactly as before. */
export function extractJsonLd(html: string): Listing[] {
  const $ = cheerio.load(html);
  const out: Listing[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw) return;
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return; }
    for (const node of jsonLdNodes(parsed)) {
      const types = ([] as any[]).concat(node['@type'] || []);
      const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
      if (!types.some((t) => VEHICLE_TYPE_RE.test(String(t))) && !offer) continue;
      const price = num(offer?.price ?? offer?.lowPrice ?? node.price);
      if (price == null || price < MIN_PRICE || price > MAX_PRICE) continue;
      const odo = node.mileageFromOdometer;
      const km = num(odo && typeof odo === 'object' ? odo.value : odo);
      out.push({
        price: Math.round(price),
        km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined,
      });
    }
  });
  return out;
}

/** JSON-LD first (stable + carries km), CSS/regex only if the page has none. */
function htmlToListings(html: string, selectors: string[]): Listing[] {
  const jl = extractJsonLd(html);
  if (jl.length) return jl;
  return extractPrices(html, selectors).map((price) => ({ price }));
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Normalise a price sample toward the subject car's mileage.
 *
 * Two same-year cars at 40k and 130k km are not worth the same — averaging them
 * raw is the biggest accuracy hole in a listings-based valuation. When enough
 * listings carry km, we fit a rand-per-km slope from the sample itself (least
 * squares); otherwise a conservative default (~4% of the median price per
 * 20,000 km). Every adjustment is clamped to ±30% of the listing's own price so
 * a noisy slope can never produce an absurd number, and listings without km
 * pass through untouched. Returns bare (possibly adjusted) prices.
 */
function adjustForMileage(listings: Listing[], targetKm?: number): number[] {
  const raw = listings.map((l) => l.price);
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) return raw;

  const withKm = listings.filter((l): l is Required<Listing> => typeof l.km === 'number');
  if (withKm.length < 4) return raw; // too little km signal to adjust safely

  const mx = withKm.reduce((s, l) => s + l.km, 0) / withKm.length;
  const my = withKm.reduce((s, l) => s + l.price, 0) / withKm.length;
  let numr = 0, den = 0;
  for (const l of withKm) { numr += (l.km - mx) * (l.price - my); den += (l.km - mx) ** 2; }
  let slope = den ? numr / den : 0; // rand per km — expected negative

  const medPrice = median(withKm.map((l) => l.price)) ?? my;
  const defaultSlope = -(medPrice * 0.04) / 20_000; // ~4% per 20,000 km
  // Trust the fitted slope only if it's negative and within a sane band.
  if (!(slope < -0.2 && slope > -8)) slope = defaultSlope;

  return listings.map((l) => {
    if (typeof l.km !== 'number') return l.price;
    const adj = l.price + slope * (targetKm - l.km);
    return Math.round(Math.min(l.price * 1.3, Math.max(l.price * 0.7, adj)));
  });
}

// ==================== FETCH WITH RETRY ====================

async function fetchWithRetry(
  url: string,
  config: AxiosRequestConfig,
  retries: number = MAX_RETRIES,
): Promise<string> {
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get<string>(url, config);
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

// ==================== HEADLESS RENDER LAYER ====================

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
let workerFailCount = 0;
let workerCircuitOpenUntil = 0;

/** Render a page through a headless scraper worker (trusaas-crm-scraper /
 *  TruCRM's scrapeWebsite). Requests are round-robined across configured
 *  workers, retrying on the next worker when one errors. A circuit breaker
 *  skips renders for 5 min after repeated failures so requests don't wait
 *  60s each on a dead worker. Returns the rendered HTML, or null when no
 *  worker is configured or none could render — never throws. */
async function renderViaWorker(url: string): Promise<string | null> {
  if (WORKER_URLS.length === 0) return null;
  if (Date.now() < workerCircuitOpenUntil) {
    console.warn('[scraper] headless circuit open — skipping render');
    return null;
  }
  for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
    const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
    try {
      const res = await fetch(`${worker.replace(/\/$/, '')}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body?.ok && typeof body.html === 'string') {
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

/** Render a page for parsing: the worker when available, plain HTTP otherwise. */
export async function fetchPageForParsing(url: string): Promise<string | null> {
  const rendered = await renderViaWorker(url);
  if (rendered) return rendered;
  try {
    return await fetchWithRetry(url, { timeout: REQUEST_TIMEOUT, headers: DEFAULT_HEADERS });
  } catch (err: any) {
    console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
    return null;
  }
}

// ==================== DEALER STOCK LAYER ====================

function escapeRegex(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Trim / variant / engine / extras words that must not break model matching.
 *  Users type sparse ("Yaris") or padded ("Yaris Cross 1.5 Touring Sport") model
 *  fields, and dealer titles carry the same noise — so matching keys on the
 *  cleaned base model instead of the raw string. Drop displacements ("1.5",
 *  "1400cc") and variant words, never 3+ digit bare model numbers ("308"). */
const MODEL_NOISE_RE = /(?:\b\d+\.\d+\b|\b\d+\s*(?:l|lit|litre|liter|cc)\b|\b(?:sport|sports|rs|gti|gtd|tdi|tsi|tfsi|ttsi|vvti|vvt-i|dsg|dsgi|touring|tourer|premium|flagship|executive|luxury|limited|edition|baseline|active|elegance|comfort|urban|ambition|advance|adventure|4x4|4wd|automatic|auto|manual|fwd|awd|rwd|style|storage|extras)\b)/gi;

/** Reduce any vehicle-name string to its base model so variant/extras words
 *  can't veto a genuine match. Empty for blank. */
function modelCore(text: string): string {
  const s = String(text || '').trim().toLowerCase();
  if (!s || s === 'any' || s === '-') return '';
  return s
    .replace(/[-_]/g, ' ')
    .replace(MODEL_NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Listing titles spell makes in several ways ("VW Golf" vs "Volkswagen Golf",
 *  "Mercedes-Benz" vs "Mercedes"). When checking a make keyword, its aliases
 *  count too — otherwise real dealer stock almost never matches. */
const MAKE_ALIASES: Record<string, string[]> = {
  'vw': ['volkswagen'],
  'volkswagen': ['vw'],
  'mercedes-benz': ['mercedes', 'benz'],
  'mercedes': ['mercedes-benz', 'benz'],
  'land rover': ['landrover'],
  'landrover': ['land rover'],
  'alfa romeo': ['alfa'],
  'alfa': ['alfa romeo'],
};

function makeVariants(make: string): string[] {
  const m = String(make).toLowerCase().trim();
  return [m, ...(MAKE_ALIASES[m] || [])];
}

/** Dealer stock URLs may contain {make} / {model} / {year} placeholders for
 *  sites with search-style URLs; plain stock-page URLs pass through unchanged. */
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
  const param = source.pageParam || 'page';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${param}=${page}`;
}

/** Listings on dealer stock pages, configured in data/price-sources.json.
 *  Never throws: a missing/corrupt file means "no dealer sources". Entries
 *  with `"enabled": false` are skipped — the safe way to keep a URL on file
 *  without hitting it. */
export function loadDealerSources(): DealerSource[] {
  try {
    if (!fs.existsSync(PRICE_SOURCES_PATH)) return [];
    // Strip a UTF-8 BOM: Windows editors (and PowerShell's Set-Content) can
    // prepend one, and JSON.parse would reject the file outright.
    const raw = fs.readFileSync(PRICE_SOURCES_PATH, 'utf-8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.dealers) ? parsed.dealers : [];
    return list
      .filter((d: any) => d && d.enabled !== false)
      .filter((d: any) => d && typeof d.url === 'string' && /^https?:\/\//i.test(d.url))
      .map((d: any) => ({
        name: String(d.name || d.url),
        url: d.url,
        match: typeof d.match === 'string' ? d.match : undefined,
        cardSelector: typeof d.cardSelector === 'string' ? d.cardSelector : undefined,
        enabled: d.enabled !== false,
        pages: typeof d.pages === 'number' && d.pages >= 1 ? Math.round(d.pages) : undefined,
        pageParam: typeof d.pageParam === 'string' ? d.pageParam : undefined,
        json: d.json && typeof d.json === 'object' && typeof d.json.url === 'string' ? d.json : undefined,
      }));
  } catch (err: any) {
    console.warn('[scraper] could not read dealer price sources:', err?.message || err);
    return [];
  }
}

/** Listing titles must name the actual vehicle: make (any of its spellings)
 *  AND model (plus any dealer-configured `match`) all have to appear, and the
 *  title's model year must be within ±1 of the query year. A same-make
 *  different-model or different-year listing must not skew a trade-in
 *  valuation. Titles without a recognisable model year don't count at all.
 *  `match` exists for dealers whose titles abbreviate the model ("GTI",
 *  "R-Line", "1.4 TSI"). */
function titleMentionsVehicle(title: string, make: string, model: string, year: string, match?: string): boolean {
  const t = String(title || '');
  const y = parseInt(String(year), 10);
  if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
    const ym = t.match(/\b(?:19|20)\d{2}\b/);
    if (!ym) return false;
    if (Math.abs(parseInt(ym[0], 10) - y) > 1) return false;
  }
  const makeOk = makeVariants(make).some((kw) => new RegExp(escapeRegex(kw), 'i').test(t));
  const q = modelCore(model);
  const modelOk = !q || modelCore(t).includes(q);
  const matchOk = !match || new RegExp(escapeRegex(String(match)), 'i').test(t);
  return makeOk && modelOk && matchOk;
}

/** First R-price in a chunk of text, or null. Groups of 1–3 digits separated
 *  by space/comma, or a glued 6–7 digit run ("R 245000"). Groups need a real
 *  separator: in concatenated page text a price glues to the next element's
 *  year ("R 245 0002019" must parse as R 245 000, not R 245 000 201). */
const PRICE_REGEX = /R\s?((?:\d{1,3}(?:[ ,]\d{3})*)|\d{6,7})/;

function priceFromText(text: string): number | null {
  const m = String(text).match(PRICE_REGEX);
  if (!m) return null;
  const val = parseInt(m[1].replace(/[^\d]/g, ''), 10);
  return val >= MIN_PRICE && val <= MAX_PRICE ? val : null;
}

/** Pull prices off a dealer's stock page. Each listing is a card (article,
 *  .vehicle, .stock-item, etc.); only cards whose title mentions the requested
 *  vehicle count, so another model on the same page can't skew the average.
 *  No page-wide fallback: a dealer whose stock page has no matching listings
 *  contributes nothing — better an honest 0 (letting the classifieds layer
 *  take over) than a bogus average of unrelated cars on the page. */
function extractDealerPrices(
  html: string,
  source: DealerSource,
  make: string,
  model: string,
  year: string,
): number[] {
  const $ = cheerio.load(html);
  const prices: number[] = [];

  const cardSelector =
    source.cardSelector || 'article, .vehicle, .stock-item, .listing, [class*="card"], [class*="vehicle"]';
  $(cardSelector).each((_, el) => {
    const $el = $(el);
    const title =
      $el.find('h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text() || $el.text();
    if (!titleMentionsVehicle(title, make, model, year, source.match)) return;
    const val = priceFromText($el.text());
    if (val !== null) prices.push(val);
  });

  return prices;
}

// ==================== DEALER JSON API LAYER ====================

/** Walk `results` (or a configured dotted path) to the listing array. */
function jsonListingArray(body: any, cfg: JsonSourceConfig): any[] {
  if (Array.isArray(body)) return body;
  let node = body;
  for (const key of (cfg.resultsPath || 'results').split('.').filter(Boolean)) {
    if (node == null) return [];
    node = node[key];
  }
  return Array.isArray(node) ? node : [];
}

/** "309950.00", "R 309 950" or a bare number -> 309950. */
function jsonPrice(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else n = parseFloat(String(v ?? '').replace(/[^\d.,]/g, ''));
  return Number.isFinite(n) && n >= MIN_PRICE && n <= MAX_PRICE ? Math.round(n) : null;
}

/** Listings straight from a dealer's public stock API — structured make /
 *  model / year fields beat title text-matching, and plain HTTP beats a
 *  headless render. Only publicly exposed endpoints are used: another
 *  tenant's data is never touched and no credentials are ever sent. */
async function fetchJsonDealerPrices(
  source: DealerSource,
  make: string,
  model: string,
  year: string,
): Promise<Listing[]> {
  const cfg = source.json!;
  const url = new URL(cfg.url);
  for (const [k, rawV] of Object.entries(cfg.params || {})) {
    const v = rawV
      .replace(/\{make\}/g, urlMake(make))
      .replace(/\{model\}/g, String(model))
      .replace(/\{year\}/g, String(year));
    url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = { ...DEFAULT_HEADERS, Accept: 'application/json' };
  if (cfg.auth) {
    // Some dealers gate their public APIs behind the site's own token flow —
    // identical to what the dealer's public webpage itself does, no user
    // credentials involved.
    const aRes = await fetchWithRetry(cfg.auth.url, { timeout: REQUEST_TIMEOUT, headers });
    const aBody = typeof aRes === 'string' ? JSON.parse(aRes) : aRes;
    let tok: unknown = aBody;
    for (const k of (cfg.auth.tokenPath || 'Data.AuthToken').split('.').filter(Boolean)) {
      tok = (tok as any)?.[k];
    }
    if (typeof tok === 'string' && tok) headers[cfg.auth.tokenHeader || 'Authorization-Token'] = tok;
    for (const [k, v] of Object.entries(cfg.auth.headers || {})) headers[k] = v;
  }
  const res = await fetchWithRetry(url.toString(), { timeout: REQUEST_TIMEOUT, headers });
  // axios auto-parses JSON responses, so res.data may already be an object.
  const body = typeof res === 'string' ? JSON.parse(res) : res;
  const items = jsonListingArray(body, cfg);
  const listings: Listing[] = [];
  for (const item of items) {
    const itemMake = String(item[cfg.makeField || 'make'] ?? '').toLowerCase();
    const itemModel = String(item[cfg.modelField || 'model'] ?? '').toLowerCase();
    const itemTitle = String(item[cfg.titleField || 'title'] ?? '').toLowerCase();
    const itemYear = Number(item[cfg.yearField || 'year'] ?? NaN);
    const makeOk = makeVariants(make).some((kw) => itemMake.includes(kw));
    const q = modelCore(String(model));
    const modelOk =
      !q ||
      modelCore(itemModel).includes(q) ||
      modelCore(itemTitle).includes(q);
    const qYear = parseInt(year, 10);
    const yearOk = !Number.isFinite(itemYear) || !Number.isFinite(qYear) || Math.abs(itemYear - qYear) <= 1;
    if (!makeOk || !modelOk || !yearOk) continue;
    const val = jsonPrice(item[cfg.priceField || 'price']);
    if (val === null) continue;
    const kmRaw = cfg.kmField ? item[cfg.kmField] : (item.mileage ?? item.km ?? item.odometer);
    const km = num(kmRaw);
    listings.push({ price: val, km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined });
  }
  // Dedupe on price+km so a page that ignores the page param can't inflate.
  const seen = new Set<string>();
  return listings.filter((l) => {
    const k = `${l.price}|${l.km ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Drop prices outside 1.5× IQR — a R487k listing among R170k cars is noise. */
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

/** Robust central value for market samples: IQR-filtered, then median for
 *  small samples, 10%-trimmed mean for larger ones. */
function robustAverage(prices: number[]): number | null {
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

// ==================== MAIN EXPORTED FUNCTION ====================

export interface FetchValuationOptions {
  /** VIN of the vehicle being valued — used for cache-key scoping. */
  vin?: string;
  /** The dealer running the valuation — used for cache-key scoping. */
  dealerSlug?: string;
  /** Subject car's mileage (km). When supplied, the price sample is normalised
   *  toward it so a low-km car isn't valued against high-km listings. */
  mileage?: number;
}

export async function fetchValuation(
  make: string,
  model: string,
  year: string,
  opts: FetchValuationOptions = {},
): Promise<ValuationResult> {
  // Strip trim/engine/extras before building URLs and cache keys: a user
  // typing "Yaris 1.5 Touring Sport" must query the same classifieds and hit
  // the same cache as a user typing just "Yaris". Listing-level matching runs
  // on the cleaned base too, so a padded entry still lands the right stock.
  const baseModel = modelCore(model);
  const key = cacheKey(make, baseModel, year, opts.vin, opts.dealerSlug);
  const cached = cacheGet(key);
  if (cached) return cached;

  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(baseModel);
  const y = String(year);

  // Layer 1: dealer stock pages — real market data from as many competition
  // dealerships as are configured. Enough listings and we're done: it's the
  // freshest, most local signal there is.
  //
  // Two lanes: structured JSON dealers first (fast, plain HTTP). They alone
  // meeting the confidence floor skip the headless lane entirely — the
  // worker renders serially, so a big render queue outlives per-request
  // timeouts. Otherwise the HTML lane runs with a global concurrency cap so
  // no request waits more than a few queue slots.
  const dealers = loadDealerSources();
  const jsonDealers = dealers.filter((d) => !!d.json);
  const htmlDealers = dealers.filter((d) => !d.json);

  const collect = async (d: (typeof dealers)[number]): Promise<{ name: string; count: number; avg: number | null; listings: Listing[] }> => {
    try {
      const listings: Listing[] = d.json
        ? await fetchJsonDealerPrices(d, make, baseModel, y)
        : await (async () => {
            const pages = Math.max(1, d.pages ?? 2);
            // Serialised worker: one render at a time — pages must not pile
            // up concurrently or every client-side render timeout fires.
            const found: number[] = [];
            for (let p = 1; p <= pages; p++) {
              const html = await fetchPageForParsing(expandDealerUrl(d, make, baseModel, y, p));
              if (!html) break;
              found.push(...extractDealerPrices(html, d, make, baseModel, y));
            }
            // Dedupe: a site that ignores the page param returns the same
            // listings again; identical prices would otherwise inflate the
            // average. (Dealer HTML cards don't expose km; JSON dealers do.)
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
    // Cap concurrent renders (2 in flight) — the worker serialises anyway,
    // and this keeps every request inside its timeout window.
    htmlResults = await mapPool(htmlDealers, 2, collect);
  }

  const dealerResults = [...jsonResults, ...htmlResults];

  const dealerListings = dealerResults.flatMap((r) => r.listings);
  const dealerSources: SourceResult[] = dealerResults.map(({ name, count, avg }) => ({ name, count, avg }));

  // Subject-car mileage: normalise the sample toward it wherever listings
  // carry km (JSON dealers + JSON-LD classifieds). Listings without km pass
  // through, so this never makes a km-less valuation worse.
  const targetKm = Number(opts.mileage);
  const kmOf = (ls: Listing[]) => median(ls.map((l) => l.km).filter((k): k is number => typeof k === 'number'));

  // The dealer market is the freshest signal there is — a rich enough sample
  // is final on its own and we're done.
  if (dealerListings.length >= MIN_DEALER_LISTINGS) {
    const adjusted = adjustForMileage(dealerListings, targetKm);
    const data: ValuationResult = {
      averageRetailPrice: robustAverage(adjusted),
      listingsFound: adjusted.length,
      fallbackRequired: false,
      sources: dealerSources,
      mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && dealerListings.some((l) => typeof l.km === 'number'),
      sampleMedianKm: kmOf(dealerListings),
    };
    cachePut(key, data);
    return data;
  }

  // Too thin or empty — Layer 3: classifieds, always fetched as part of the
  // fallback. Plain HTTP first (AutoTrader serves its listing cards server-side, and the render
  // worker may be asleep on a free instance); only when the plain page yields
  // no listings is the worker render tried.
  const sources = buildSources();
  const fetchPromises = sources.map(async (src) => {
    const url = src.url(make, baseModel, y);
    try {
      let html: string | null = null;
      try {
        html = await fetchWithRetry(url, { timeout: REQUEST_TIMEOUT, headers: DEFAULT_HEADERS });
      } catch (err: any) {
        console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
      }
      if (html && htmlToListings(html, src.selectors).length > 0) {
        return { name: src.name, html, selectors: src.selectors };
      }
      const rendered = await renderViaWorker(url);
      return { name: src.name, html: rendered, selectors: src.selectors };
    } catch (err: any) {
      console.warn(`[scraper] ${src.name} failed:`, err.message);
      return { name: src.name, html: null, selectors: src.selectors };
    }
  });

  const settled = await Promise.allSettled(fetchPromises);

  const classifiedListings: Listing[] = [];
  const sourcesOutput: SourceResult[] = [];

  for (const result of settled) {
    if (result.status === 'rejected') continue;
    const { name, html, selectors } = result.value;
    if (!html) {
      sourcesOutput.push({ name, count: 0, avg: null });
      continue;
    }

    const listings = htmlToListings(html, selectors);
    classifiedListings.push(...listings);
    const prices = listings.map((l) => l.price);
    sourcesOutput.push({
      name,
      count: prices.length,
      avg: prices.length
        ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length)
        : null,
    });
  }

  // Blend everything: whatever the dealer market gave us (1–2 listings is too
  // thin to trust alone) plus the classifieds fallback.
  const allListings = [...dealerListings, ...classifiedListings];
  const finalSources = [...dealerSources, ...sourcesOutput];

  if (allListings.length === 0) {
    const data: ValuationResult = {
      averageRetailPrice: null,
      listingsFound: 0,
      fallbackRequired: true,
      searchUrl: `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${mo}&year=${y}`,
      carsUrl: sources.some((s) => s.name === 'Cars.co.za')
        ? `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${mo}/?Year=${y}`
        : undefined,
      sources: finalSources,
      mileageAdjusted: false,
      sampleMedianKm: null,
    };
    cachePut(key, data);
    return data;
  }

  const adjustedAll = adjustForMileage(allListings, targetKm);
  const data: ValuationResult = {
    averageRetailPrice: robustAverage(adjustedAll),
    listingsFound: adjustedAll.length,
    fallbackRequired: dealerListings.length < MIN_DEALER_LISTINGS,
    searchUrl: `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${mo}&year=${y}`,
    carsUrl: sources.some((s) => s.name === 'Cars.co.za')
      ? `https://www.cars.co.za/usedcars/${m}/${mo}/?Year=${y}`
      : undefined,
    sources: finalSources,
    mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && allListings.some((l) => typeof l.km === 'number'),
    sampleMedianKm: kmOf(allListings),
  };

  cachePut(key, data);
  return data;
}

export function clearValuationCache(): void {
  cache.clear();
}
