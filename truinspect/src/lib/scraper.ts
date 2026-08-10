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
 *  its own — the pipeline then falls back and blends in Kredo + classifieds. */
const MIN_DEALER_LISTINGS = 3;

// ==================== CACHE ====================

interface CacheEntry {
  data: ValuationResult;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(make: string, model: string, year: string, vin?: string): string {
  return `${make.toLowerCase()}|${model.toLowerCase()}|${year}|${(vin || 'novin').toUpperCase()}`;
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

function extractPrices(html: string, selectors: string[]): number[] {
  const $ = cheerio.load(html);
  const prices: number[] = [];
  for (const sel of selectors) {
    $(sel.trim()).each((_, el) => {
      const val = parseInt($(el).text().replace(/[^\d]/g, ''), 10);
      if (val >= MIN_PRICE && val <= MAX_PRICE) prices.push(val);
    });
  }
  return prices;
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

/** Render a page through a headless scraper worker (trusaas-crm-scraper /
 *  TruCRM's scrapeWebsite). Requests are round-robined across configured
 *  workers, retrying on the next worker when one errors. Returns the rendered
 *  HTML, or null when no worker is configured or none could render — never
 *  throws. */
async function renderViaWorker(url: string): Promise<string | null> {
  if (WORKER_URLS.length === 0) return null;
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
      if (body?.ok && typeof body.html === 'string') return body.html;
    } catch (err: any) {
      console.warn(`[scraper] headless render failed on ${worker} for ${url}:`, err?.message || err);
    }
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
  const modelOk =
    !model || model.toLowerCase() === 'any' || new RegExp(escapeRegex(String(model)), 'i').test(t);
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

// ==================== KREDO CARVALUE LAYER ====================

const KREDO_CONFIG_PATH = path.join(process.cwd(), 'data', 'kredo-config.json');

interface KredoDealerConfig {
  sandboxKey?: string;
  productionKey?: string;
  connectedAt?: string;
}

function readKredoConfig(): Record<string, KredoDealerConfig> {
  try {
    if (!fs.existsSync(KREDO_CONFIG_PATH)) return {};
    return JSON.parse(fs.readFileSync(KREDO_CONFIG_PATH, 'utf-8').replace(/^\uFEFF/, ''));
  } catch (err: any) {
    console.warn('[scraper] could not read kredo config:', err?.message || err);
    return {};
  }
}

export interface KredoValue {
  tradeValue: number | null;
  retailValue: number | null;
  marketValue: number | null;
}

/** Layer 2 of the valuation pipeline: Kredo CarValue (VIN-based market data).
 *  Returns null when the dealer isn't connected, no VIN is supplied, or the
 *  lookup has no value — the pipeline then falls through to the classifieds
 *  fallback layer. */
export async function kredoCarValue(
  vin: string | undefined,
  dealerSlug: string,
): Promise<KredoValue | null> {
  if (!vin || vin.length < 11) return null;
  const entry = readKredoConfig()[dealerSlug];
  if (!entry?.sandboxKey && !entry?.productionKey) return null;

  // TODO(kredo-docs): Replace with the real Kredo CarValue API call using
  // entry.productionKey (or entry.sandboxKey while testing). Until the API is
  // documented this layer deliberately reports no value, so the pipeline falls
  // through to the classifieds fallback exactly as before.
  console.warn('[scraper] kredo CarValue: real API not wired yet — falling through');
  return null;
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
): Promise<number[]> {
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
  const prices: number[] = [];
  for (const item of items) {
    const itemMake = String(item[cfg.makeField || 'make'] ?? '').toLowerCase();
    const itemModel = String(item[cfg.modelField || 'model'] ?? '').toLowerCase();
    const itemTitle = String(item[cfg.titleField || 'title'] ?? '').toLowerCase();
    const itemYear = Number(item[cfg.yearField || 'year'] ?? NaN);
    const qModel = String(model).toLowerCase();
    const makeOk = makeVariants(make).some((kw) => itemMake.includes(kw));
    const modelOk = !qModel || qModel === 'any' || itemModel.includes(qModel) || itemTitle.includes(qModel);
    const qYear = parseInt(year, 10);
    const yearOk = !Number.isFinite(itemYear) || !Number.isFinite(qYear) || Math.abs(itemYear - qYear) <= 1;
    if (!makeOk || !modelOk || !yearOk) continue;
    const val = jsonPrice(item[cfg.priceField || 'price']);
    if (val !== null) prices.push(val);
  }
  return [...new Set(prices)];
}

/** Robust central value for market samples: median for small samples, a
 *  10%-trimmed mean for larger ones. A single outlier (one dealer's R487k
 *  Yaris beside 28 R171k classified ads) must not bend the answer. */
function robustAverage(prices: number[]): number | null {
  if (!prices.length) return null;
  const s = [...prices].sort((a, b) => a - b);
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
  /** VIN of the vehicle being valued — required by the Kredo CarValue layer. */
  vin?: string;
  /** The dealer running the valuation — picks their Kredo keys. */
  dealerSlug?: string;
}

export async function fetchValuation(
  make: string,
  model: string,
  year: string,
  opts: FetchValuationOptions = {},
): Promise<ValuationResult> {
  const key = cacheKey(make, model, year, opts.vin);
  const cached = cacheGet(key);
  if (cached) return cached;

  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(model);
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

  const collect = async (d: (typeof dealers)[number]): Promise<{ name: string; count: number; avg: number | null; prices: number[] }> => {
    try {
      const prices = d.json
        ? await fetchJsonDealerPrices(d, make, model, y)
        : await (async () => {
            const pages = Math.max(1, d.pages ?? 2);
            // Serialised worker: one render at a time — pages must not pile
            // up concurrently or every client-side render timeout fires.
            const found: number[] = [];
            for (let p = 1; p <= pages; p++) {
              const html = await fetchPageForParsing(expandDealerUrl(d, make, model, y, p));
              if (!html) break;
              found.push(...extractDealerPrices(html, d, make, model, y));
            }
            // Dedupe: a site that ignores the page param returns the same
            // listings again; identical prices would otherwise inflate the
            // average.
            return [...new Set(found)];
          })();
      return {
        name: `Dealer · ${d.name}`,
        count: prices.length,
        avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null,
        prices,
      };
    } catch (err: any) {
      console.warn(`[scraper] dealer ${d.name} failed:`, err?.message || err);
      return { name: `Dealer · ${d.name}`, count: 0, avg: null, prices: [] };
    }
  };

  const jsonResults = await Promise.all(jsonDealers.map(collect));
  const jsonPrices = jsonResults.flatMap((r) => r.prices);

  let htmlResults: { name: string; count: number; avg: number | null; prices: number[] }[] = [];
  if (jsonPrices.length < MIN_DEALER_LISTINGS && htmlDealers.length) {
    // Cap concurrent renders (2 in flight) — the worker serialises anyway,
    // and this keeps every request inside its timeout window.
    htmlResults = await mapPool(htmlDealers, 2, collect);
  }

  const dealerResults = [...jsonResults, ...htmlResults];

  const dealerPrices = dealerResults.flatMap((r) => r.prices);
  const dealerSources: SourceResult[] = dealerResults.map(({ name, count, avg }) => ({ name, count, avg }));

  // The dealer market is the freshest signal there is — a rich enough sample
  // is final on its own and we're done.
  if (dealerPrices.length >= MIN_DEALER_LISTINGS) {
    const data: ValuationResult = {
      averageRetailPrice: robustAverage(dealerPrices),
      listingsFound: dealerPrices.length,
      fallbackRequired: false,
      sources: dealerSources,
    };
    cachePut(key, data);
    return data;
  }

  // Too thin or empty — Layer 2: Kredo CarValue, paid VIN-based market data.
  const kredo = await kredoCarValue(opts.vin, opts.dealerSlug || 'default');
  const kredoPrice = kredo ? kredo.retailValue ?? kredo.marketValue ?? kredo.tradeValue : null;

  // Layer 3: classifieds — always fetched as part of the fallback. Plain HTTP
  // first (AutoTrader serves its listing cards server-side, and the render
  // worker may be asleep on a free instance); only when the plain page yields
  // no listings is the worker render tried.
  const sources = buildSources();
  const fetchPromises = sources.map(async (src) => {
    const url = src.url(make, model, y);
    try {
      let html: string | null = null;
      try {
        html = await fetchWithRetry(url, { timeout: REQUEST_TIMEOUT, headers: DEFAULT_HEADERS });
      } catch (err: any) {
        console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
      }
      if (html && extractPrices(html, src.selectors).length > 0) {
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

  const classifiedPrices: number[] = [];
  const sourcesOutput: SourceResult[] = [];

  for (const result of settled) {
    if (result.status === 'rejected') continue;
    const { name, html, selectors } = result.value;
    if (!html) {
      sourcesOutput.push({ name, count: 0, avg: null });
      continue;
    }

    const prices = extractPrices(html, selectors);
    classifiedPrices.push(...prices);
    sourcesOutput.push({
      name,
      count: prices.length,
      avg: prices.length
        ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length)
        : null,
    });
  }

  // Blend everything: whatever the dealer market gave us (1–2 listings is too
  // thin to trust alone) plus Kredo and the classifieds fallback.
  const extraPrices: number[] = kredoPrice !== null ? [kredoPrice] : [];
  const extraSources: SourceResult[] =
    kredoPrice !== null ? [{ name: 'Kredo CarValue', count: 1, avg: kredoPrice }] : [];

  const allPrices = [...dealerPrices, ...extraPrices, ...classifiedPrices];
  const finalSources = [...dealerSources, ...extraSources, ...sourcesOutput];

  if (allPrices.length === 0) {
    const data: ValuationResult = {
      averageRetailPrice: null,
      listingsFound: 0,
      fallbackRequired: true,
      searchUrl: `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${mo}&year=${y}`,
      carsUrl: sources.some((s) => s.name === 'Cars.co.za')
        ? `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${mo}/?Year=${y}`
        : undefined,
      sources: finalSources,
    };
    cachePut(key, data);
    return data;
  }

  const data: ValuationResult = {
    averageRetailPrice: robustAverage(allPrices),
    listingsFound: allPrices.length,
    fallbackRequired: dealerPrices.length < MIN_DEALER_LISTINGS,
    searchUrl: `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${mo}&year=${y}`,
    carsUrl: sources.some((s) => s.name === 'Cars.co.za')
      ? `https://www.cars.co.za/usedcars/${m}/${mo}/?Year=${y}`
      : undefined,
    sources: finalSources,
  };

  cachePut(key, data);
  return data;
}

export function clearValuationCache(): void {
  cache.clear();
}
