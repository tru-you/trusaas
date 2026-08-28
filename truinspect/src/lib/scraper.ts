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
  /** Query-param name for pagination (default "page"). A site that ignores it
   *  just returns page 1 again, which the price+km dedupe collapses. */
  pageParam?: string;
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

const WORKER_TIMEOUT_MS = Number(process.env.SCRAPER_WORKER_TIMEOUT_MS) || 30000;

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

/** Below this many JSON-dealer listings the HTML-dealer lane (headless renders)
 *  fires to widen the dealer sample. Kept low: the JSON dealers are fast, and
 *  the render lane is only worth paying for when they're nearly empty. */
const MIN_DEALER_LISTINGS = 3;

/** A dealer sample this rich is final on its own and skips classifieds. Set
 *  high enough that a valuation rests on a real sample (20–30 comps) instead of
 *  the handful of listings that used to short-circuit the classifieds layer. */
const DEALER_FINAL_THRESHOLD = Math.max(3, Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20);

/** Classifieds are now SPA/Algolia sites: the server HTML often carries only a
 *  couple of JSON-LD "featured" items while the real 20–50 listings load via a
 *  client XHR. If a plain-HTTP page yields fewer than this, render the full
 *  page through the headless worker instead of trusting the sliver — this is
 *  the fix for "1 listing on a popular car". */
const MIN_HTTP_LISTINGS = Number(process.env.SCRAPER_MIN_HTTP_LISTINGS) || 8;

/** How many pages of each classifieds source to walk. Page 1 alone is a thin,
 *  volatile sample on a popular model. */
const CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);

/** When dealer + classifieds together come back thinner than this, fire the
 *  paid SERP layer (if configured) to cast a wider net across every SA site
 *  Google has indexed. Gated so the common, data-rich path never pays. */
const SERP_TRIGGER_MAX = Math.max(0, Number(process.env.SERP_TRIGGER_MAX) || 6);

/** Hard ceiling on a whole valuation (dealer + classifieds combined). The
 *  pipeline returns whatever it has when the budget runs out, so a dead worker
 *  or a slow unlocker can never hang the trade-in flow. */
const TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 12000;

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

/** Pull {price, km} listings off a card-based classifieds page. Two very
 *  different markup styles appear here:
 *   - AutoTrader:   <a class*="result-tile"> with an .e-price__ + "N km" summary
 *   - Cars.co.za:   Next.js CSS-module [class*="VehicleCard_vehicleCard"] tile
 *  Both are SPAs whose __NEXT_DATA__/JSON-LD is a stub, so the card grid is what
 *  actually carries the data. We match card containers by class fragments and
 *  read price/km/year by regex from the (CSS-module noise-laden) card text, so
 *  the markup namespace doesn't matter. Year tolerance is 2 because AutoTrader
 *  ignores ?year= and returns a spread; a wildly-out-of-range year still drops.
 *  Returns [] when no recognisable cards, so callers fall back to the price scan.
 */
export function extractCardListings(html: string, make: string, model: string, year: string): Listing[] {
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
    const cardText = $c.text().replace(/\s+/g, ' ').trim();
    if (cardText.length < 8) return;

    // make/model + year (tolerance 2) against the CARD TEXT, not just the title
    // element — CSS-module noise strips the title out of some tiles but the text
    // still names the vehicle.
    if (!titleMentionsVehicle(cardText, make, model, year, undefined, { yearTolerance: 2 })) return;

    // Targeted price element first (precise), regex fallback (broad). Using
    // priceFromText alone on the full card text grabs the first R-prefixed
    // number, which can be the mileage ("R 95 000 km") rather than the price.
    const priceEl = $c.find('[class^="e-price__"], [class*="price"]').first();
    const price = priceEl.length ? num(priceEl.text()) : priceFromText(cardText);
    if (price == null || price < MIN_PRICE || price > MAX_PRICE) return;

    const kmMatch = cardText.match(/(\d{1,3}(?:[ ,]\d{3})?)\s?km/i);
    const km = kmMatch ? num(kmMatch[1]) : undefined;
    const key = `${Math.round(price)}|${km ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined });
  });

  return out;
}

/** Pull {price, km} listings out of a Next.js page's __NEXT_DATA__ blob (Cars.co.za
 *  and other Next sites embed their full result set there, carrying price AND
 *  mileage — richer than the 1 JSON-LD node the page exposes). The payload is
 *  often double-encoded (a JSON string inside the JSON), so we unwrap nested
 *  JSON-looking strings as we walk. Only listings whose title names the queried
 *  make/model within the year tolerance are kept, so the multi-year, multi-model
 *  cars the page also carries can't skew the sample. Returns [] on any non-Next
 *  page, so callers fall back to JSON-LD/CSS exactly as before. */
export function extractNextDataListings(html: string, make: string, model: string, year: string): Listing[] {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').contents().text() || $('#__NEXT_DATA__').text();
  if (!raw) return [];
  let root: any;
  try { root = JSON.parse(raw); } catch { return []; }

  const out: Listing[] = [];
  const seen = new Set<string>();
  const visit = (n: any) => {
    if (n == null) return;
    if (typeof n === 'string') {
      const s = n.trim();
      if ((s[0] === '{' || s[0] === '[') && s.includes('"price"')) {
        try { visit(JSON.parse(s)); } catch { /* not embedded JSON */ }
      }
      return;
    }
    if (typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    const price = typeof n.price === 'number' ? n.price : null;
    if (price != null && price >= MIN_PRICE && price <= MAX_PRICE && (n.make || n.model || n.title)) {
      const title = String(n.title || `${n.year ?? ''} ${n.make ?? ''} ${n.model ?? ''}`);
      if (titleMentionsVehicle(title, make, model, year)) {
        const key = `${n.reference ?? n.id ?? ''}|${price}`;
        if (!seen.has(key)) {
          seen.add(key);
          const km = num(n.mileage ?? n.km ?? n.odometer);
          out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1_000_000 ? Math.round(km) : undefined });
        }
      }
    }
    for (const k of Object.keys(n)) visit(n[k]);
  };
  visit(root);
  return out;
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
 * squares); otherwise a conservative default (~3% of the median price per
 * 20,000 km). Every adjustment is clamped to ±20% of the listing's own price so
 * a noisy slope can never produce an absurd number, and listings without km
 * pass through untouched. Returns bare (possibly adjusted) prices.
 */
function adjustForMileage(listings: Listing[], targetKm?: number): number[] {
  const raw = listings.map((l) => l.price);
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) return raw;

  const withKm = listings.filter((l): l is Required<Listing> => typeof l.km === 'number');
  if (withKm.length < 3) return raw; // too little km signal to adjust safely

  const mx = withKm.reduce((s, l) => s + l.km, 0) / withKm.length;
  const my = withKm.reduce((s, l) => s + l.price, 0) / withKm.length;
  let numr = 0, den = 0;
  for (const l of withKm) { numr += (l.km - mx) * (l.price - my); den += (l.km - mx) ** 2; }
  let slope = den ? numr / den : 0; // rand per km — expected negative

  const medPrice = median(withKm.map((l) => l.price)) ?? my;
  const defaultSlope = -(medPrice * 0.03) / 20_000; // ~3% per 20,000 km
  // Trust the fitted slope only if it's negative and within a sane band — a
  // steep slope fitted on a mixed-variant sample (GTI vs base) would otherwise
  // swing prices far more than mileage ever does.
  if (!(slope < -0.2 && slope > -3)) slope = defaultSlope;

  // Clamp each adjustment to ±20% of the listing's own price. This is a close
  // evaluation, not an exact one: a tight band keeps mileage from dominating a
  // valuation that is really about the car, not its odometer.
  return listings.map((l) => {
    if (typeof l.km !== 'number') return l.price;
    const adj = l.price + slope * (targetKm - l.km);
    return Math.round(Math.min(l.price * 1.2, Math.max(l.price * 0.8, adj)));
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
async function renderViaWorker(url: string, maxMs?: number): Promise<string | null> {
  if (WORKER_URLS.length === 0) return null;
  if (Date.now() < workerCircuitOpenUntil) {
    console.warn('[scraper] headless circuit open — skipping render');
    return null;
  }
  const timeoutMs = Math.max(1, Math.min(WORKER_TIMEOUT_MS, maxMs ?? WORKER_TIMEOUT_MS));
  for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
    const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
    try {
      const res = await fetch(`${worker.replace(/\/$/, '')}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(timeoutMs),
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

/** Render a page for parsing: the worker first, then Web Unlocker (unblocks a
 *  Cloudflared dealer page the plain worker can't reach), then plain HTTP. */
export async function fetchPageForParsing(url: string): Promise<string | null> {
  const rendered = await renderViaWorker(url);
  if (rendered) return rendered;
  const unlocked = await renderViaUnlocker(url);
  if (unlocked) return unlocked;
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

/** How many model years either side of the query still count as a comp. A
 *  trade-in wants a close ballpark, not a single-year sliver — ±3 widens the
 *  sample on a thin model without dragging in a different generation.
 *  Env-overridable. */
const YEAR_TOLERANCE = Number(process.env.SCRAPER_YEAR_TOLERANCE) || 3;

/** Listing titles must name the actual vehicle: make (any of its spellings)
 *  AND model (plus any dealer-configured `match`) all have to appear, and the
 *  title's model year must be within ±YEAR_TOLERANCE of the query year. A
 *  same-make different-model listing must not skew a valuation. A title with
 *  no recognisable year is NOT rejected — the search URL already constrains the
 *  year, and dropping every year-less card was throwing away real comps.
 *  `match` exists for dealers whose titles abbreviate the model ("GTI",
 *  "R-Line", "1.4 TSI"). */
function titleMentionsVehicle(title: string, make: string, model: string, year: string, match?: string, opts?: { yearTolerance?: number }): boolean {
  const t = String(title || '');
  const y = parseInt(String(year), 10);
  const tolerance = opts?.yearTolerance ?? YEAR_TOLERANCE;
  if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
    const ym = t.match(/\b(?:19|20)\d{2}\b/);
    // Only reject on a year that's present AND out of band; a missing year is
    // allowed through (the query URL already narrowed the year).
    if (ym && Math.abs(parseInt(ym[0], 10) - y) > tolerance) return false;
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
    const yearOk = !Number.isFinite(itemYear) || !Number.isFinite(qYear) || Math.abs(itemYear - qYear) <= YEAR_TOLERANCE;
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

// ==================== SERP (GOOGLE) LAYER ====================
//
// Google has already indexed every SA classifieds + dealer site, so one search
// aggregates comps across all of them — the best recall there is, and the best
// answer for the long tail where any single site is thin. We never scrape
// Google directly (it hard-blocks server IPs and it's against their ToS); a
// SERP provider runs the query through its own proxies and hands back JSON.
//
// Provider-agnostic and OFF by default: with no key set fetchSerpListings is a
// no-op and the pipeline behaves exactly as before. Set SERP_PROVIDER +
// SERP_API_KEY (Bright Data or SerpApi) to switch it on — one env var to swap
// providers, no code change.

const SERP_API_URL = process.env.SERP_API_URL || '';
const SERP_API_KEY = process.env.SERP_API_KEY || '';
const SERP_ZONE = process.env.SERP_ZONE || 'serp';
const SERP_PROVIDER = (
  process.env.SERP_PROVIDER ||
  (SERP_API_URL.includes('brightdata') ? 'brightdata' : SERP_API_URL.includes('serpapi') ? 'serpapi' : '')
).toLowerCase();
const SERP_TIMEOUT_MS = Number(process.env.SERP_TIMEOUT_MS) || 12000;

// ── Web Unlocker (Bright Data) ───────────────────────────────────────────
// Same unified endpoint + key as the SERP layer, different zone. It returns the
// target page's UNBLOCKED raw HTML (solving Cloudflare / anti-bot on AutoTrader
// and Cars.co.za), which flows into htmlToListings unchanged. One account key
// covers both zones; BRIGHTDATA_API_KEY overrides only if you want a separate
// billing key. Off unless SCRAPER_UNLOCKER_ENABLED is truthy, so with nothing
// set the pipeline behaves exactly as before.
const BD_API_KEY = process.env.BRIGHTDATA_API_KEY || SERP_API_KEY;
const UNLOCKER_ZONE = process.env.UNLOCKER_ZONE || process.env.BRIGHTDATA_UNLOCKER_ZONE || 'unlocker';
const UNLOCKER_ENABLED = /^(1|true|yes)$/i.test(process.env.SCRAPER_UNLOCKER_ENABLED || '');
// Fail over fast: a stalled Web Unlocker used to hang 20s before the pipeline
// fell back to the market estimate, which reads as "timed out". 8s is plenty
// for a healthy unlocker and drops to the estimate quickly when it's slow.
// Override with UNLOCKER_TIMEOUT_MS if a source genuinely needs longer.
const UNLOCKER_TIMEOUT_MS = Number(process.env.UNLOCKER_TIMEOUT_MS) || 8000;
/** Unlocker only fetches the first N pages of a classifieds source (it's paid);
 *  the free worker still paginates further. */
const UNLOCKER_MAX_PAGES = Math.max(1, Number(process.env.UNLOCKER_MAX_PAGES) || 1);

/** True when Web Unlocker is switched on and has a key. Gates the (paid) call. */
export function unlockerConfigured(): boolean {
  return UNLOCKER_ENABLED && !!BD_API_KEY;
}

/** POST a target URL to Bright Data's unified request API on `zone` and return
 *  the response body — unblocked HTML for the Unlocker zone. No-op without a
 *  key; never throws. */
async function brightDataFetch(targetUrl: string, zone: string, timeoutMs: number): Promise<string | null> {
  if (!BD_API_KEY) return null;
  try {
    const res = await fetch(SERP_API_URL || 'https://api.brightdata.com/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BD_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, url: targetUrl, format: 'raw', country: 'za' }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`[scraper] brightDataFetch HTTP ${res.status} on ${targetUrl}`);
      return null;
    }
    const text = await res.text();
    // Some zones wrap the raw page in a JSON envelope even with format:"raw" —
    // unwrap the actual HTML defensively (same as TruCRM's webUnlockerFetch).
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        const maybe = parsed?.body ?? parsed?.html ?? parsed?.result;
        if (typeof maybe === 'string' && maybe.length > 0) return maybe;
      } catch {
        // not JSON — keep the raw text
      }
    }
    return text;
  } catch (err: any) {
    console.warn('[scraper] brightDataFetch failed:', err?.message || err);
    return null;
  }
}

/** Fetch a page through Bright Data Web Unlocker. Returns unblocked HTML, or
 *  null when disabled — callers fall through to the next render tier. */
export async function renderViaUnlocker(url: string, maxMs?: number): Promise<string | null> {
  if (!unlockerConfigured()) return null;
  return brightDataFetch(url, UNLOCKER_ZONE, Math.max(1, Math.min(UNLOCKER_TIMEOUT_MS, maxMs ?? UNLOCKER_TIMEOUT_MS)));
}

/** True when a SERP provider is wired up. Used to gate the (paid) call. */
export function serpConfigured(): boolean {
  return !!SERP_API_KEY && (SERP_PROVIDER === 'brightdata' || SERP_PROVIDER === 'serpapi');
}

/** Turn a SERP provider's JSON into price Listings. Handles both the SerpApi
 *  shape (organic_results / shopping_results) and the Bright Data shape
 *  (organic / shopping). Keeps only results whose text names the actual
 *  make/model/year, then reads a structured price when present, else the first
 *  R-price in the title/snippet. Exported so it can be unit-tested without a
 *  live provider. SERP rarely carries odometer, so these are price-only. */
export function parseSerpResults(json: any, make: string, model: string, year: string): Listing[] {
  if (!json || typeof json !== 'object') return [];
  const out: Listing[] = [];
  const consider = (title: unknown, snippet: unknown, structuredPrice?: unknown) => {
    const text = `${String(title || '')} ${String(snippet || '')}`.trim();
    if (!text) return;
    if (!titleMentionsVehicle(text, make, model, year)) return;
    let price = typeof structuredPrice === 'number' ? jsonPrice(structuredPrice) : null;
    if (price == null) price = priceFromText(text);
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
  // Dedupe on price — the same asking price echoing across three sites in the
  // results is almost always the same car listed in three places.
  const seen = new Set<number>();
  return out.filter((l) => (seen.has(l.price) ? false : (seen.add(l.price), true)));
}

/** Query Google through the configured SERP provider and return price
 *  Listings. No-op (returns []) when no provider/key is set, and never throws —
 *  a SERP outage degrades to whatever the free layers found. */
export async function fetchSerpListings(make: string, model: string, year: string): Promise<Listing[]> {
  if (!serpConfigured()) return [];
  const q = `${year} ${make} ${model} for sale South Africa price`;
  try {
    let json: any = null;
    if (SERP_PROVIDER === 'brightdata') {
      const googleUrl =
        `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=za&hl=en&num=20&brd_json=1`;
      const res = await fetch(SERP_API_URL || 'https://api.brightdata.com/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SERP_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: SERP_ZONE, url: googleUrl, format: 'raw' }),
        signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const body = await res.text();
      try { json = JSON.parse(body); } catch { return []; }
    } else {
      // SerpApi
      const base = SERP_API_URL || 'https://serpapi.com/search.json';
      const url =
        `${base}?engine=google&google_domain=google.co.za&gl=za&hl=en&num=20` +
        `&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(SERP_API_KEY)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(SERP_TIMEOUT_MS) });
      if (!res.ok) return [];
      json = await res.json();
    }
    return parseSerpResults(json, make, model, year);
  } catch (err: any) {
    console.warn('[scraper] SERP layer failed:', err?.message || err);
    return [];
  }
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

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const budgetLeft = () => deadline - Date.now();

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
            const found: number[] = [];
            for (let p = 1; p <= pages; p++) {
              if (budgetLeft() <= 0) break;
              const url = expandDealerUrl(d, make, baseModel, y, p);
              // Plain HTTP first: most dealer stock pages are server-rendered
              // and answer in well under a second, whereas a headless render
              // (serialised on the worker, cold-starting on the free tier)
              // can take 30s+. Only when the cheap fetch yields no matching
              // listings — a JS-only SPA or a bot wall — do we pay for the
              // render tier, exactly the classifieds-lane pattern.
              let prices: number[] = [];
              let html: string | null = null;
              try {
                html = await fetchWithRetry(url, { timeout: REQUEST_TIMEOUT, headers: DEFAULT_HEADERS });
              } catch (err: any) {
                console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
              }
              if (html) prices = extractDealerPrices(html, d, make, baseModel, y);

              if (prices.length === 0) {
                const rendered = (await renderViaWorker(url, budgetLeft())) ?? (await renderViaUnlocker(url, budgetLeft()));
                if (rendered) {
                  const rp = extractDealerPrices(rendered, d, make, baseModel, y);
                  if (rp.length) prices = rp;
                }
              }
              if (prices.length === 0) break; // nothing on this page → stop paging
              found.push(...prices);
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
  if (dealerListings.length >= DEALER_FINAL_THRESHOLD) {
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

  // Too thin or empty — Layer 3: classifieds. Walk each source across a few
  // pages; per page take plain HTTP first, but when it comes back thin (an
  // SPA served only a JSON-LD sliver) render the whole page through the worker
  // and keep whichever gave more. Accepting the first non-empty page was what
  // pinned popular cars at a single listing.
  const sources = buildSources();

  const pageUrl = (src: ScraperSource, page: number): string => {
    const base = src.url(make, baseModel, y);
    if (page <= 1) return base;
    const param = src.pageParam || 'page';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${param}=${page}`;
  };

  // Prefer a Next.js __NEXT_DATA__ result set (Cars.co.za: full, km-carrying,
  // year-filtered) over the JSON-LD/CSS scrape; fall back to the latter for
  // non-Next sites (AutoTrader). Runs here, not in htmlToListings, because only
  // here do we have make/model/year to filter the embedded listings.
  const parseClassified = (html: string, selectors: string[]): Listing[] => {
    const nd = extractNextDataListings(html, make, baseModel, y);
    if (nd.length) return nd;
    const cards = extractCardListings(html, make, baseModel, y);
    if (cards.length) return cards;
    return htmlToListings(html, selectors);
  };

  const perSource = await Promise.all(
    sources.map(async (src) => {
      const acc: Listing[] = [];
      for (let p = 1; p <= CLASSIFIEDS_PAGES; p++) {
        if (budgetLeft() <= 0) break;
        const url = pageUrl(src, p);
        let listings: Listing[] = [];
        try {
          const html = await fetchWithRetry(url, { timeout: REQUEST_TIMEOUT, headers: DEFAULT_HEADERS });
          listings = parseClassified(html, src.selectors);
        } catch (err: any) {
          console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
        }
        // Paid unblock tier — defeats the Cloudflare block that plain HTTP hits
        // on Cars.co.za (server fetch is 403). Capped to the first
        // UNLOCKER_MAX_PAGES pages and only when the free page came back thin.
        let unlocked: string | null = null;
        if (listings.length < MIN_HTTP_LISTINGS && p <= UNLOCKER_MAX_PAGES) {
          unlocked = await renderViaUnlocker(url, budgetLeft());
          if (unlocked) {
            const r = parseClassified(unlocked, src.selectors);
            if (r.length > listings.length) listings = r;
          }
        }
        // Free worker render — only when the unlocker didn't already return the
        // full page (rendering again would be pure latency), for a genuine
        // SPA-XHR miss the Unlocker's raw HTML didn't surface.
        if (listings.length < MIN_HTTP_LISTINGS && !unlocked) {
          const rendered = await renderViaWorker(url, budgetLeft());
          if (rendered) {
            const r = parseClassified(rendered, src.selectors);
            if (r.length > listings.length) listings = r;
          }
        }
        if (listings.length === 0) break; // nothing on this page → stop paging
        acc.push(...listings);
      }
      // Dedupe within the source: a site that ignores the page param serves
      // page 1 again, and identical price+km would otherwise inflate.
      const seen = new Set<string>();
      const deduped = acc.filter((l) => {
        const k = `${l.price}|${l.km ?? ''}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { name: src.name, listings: deduped };
    }),
  );

  const classifiedListings: Listing[] = [];
  const sourcesOutput: SourceResult[] = [];
  for (const { name, listings } of perSource) {
    classifiedListings.push(...listings);
    const prices = listings.map((l) => l.price);
    sourcesOutput.push({
      name,
      count: prices.length,
      avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null,
    });
  }

  // Layer 4: SERP (Google) — only when the free layers are thin AND a provider
  // is configured, so the common data-rich path never pays. Cached with the
  // rest, so at most one paid call per model per cache window.
  let serpListings: Listing[] = [];
  if (dealerListings.length + classifiedListings.length < SERP_TRIGGER_MAX && serpConfigured()) {
    serpListings = await fetchSerpListings(make, baseModel, y);
    if (serpListings.length) {
      const prices = serpListings.map((l) => l.price);
      sourcesOutput.push({
        name: 'Google (SERP)',
        count: prices.length,
        avg: Math.round(prices.reduce((s, v) => s + v, 0) / prices.length),
      });
    }
  }

  // Blend everything, then dedupe across layers on price+km so the same car
  // surfacing on several sites (and in Google) counts once.
  const combined = [...dealerListings, ...classifiedListings, ...serpListings];
  const crossSeen = new Set<string>();
  const allListings = combined.filter((l) => {
    const k = `${l.price}|${l.km ?? ''}`;
    if (crossSeen.has(k)) return false;
    crossSeen.add(k);
    return true;
  });
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
