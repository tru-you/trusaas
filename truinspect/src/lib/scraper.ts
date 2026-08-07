import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';

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

// ==================== CONFIG ====================

const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const REQUEST_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 8000;

const CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000;

const MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES) || 2;

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-ZA,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const MIN_PRICE = 10_000;
const MAX_PRICE = 50_000_000;

// ==================== CACHE ====================

interface CacheEntry {
  data: ValuationResult;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(make: string, model: string, year: string): string {
  return `${make.toLowerCase()}|${model.toLowerCase()}|${year}`;
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

function buildSources(): ScraperSource[] {
  const sources: ScraperSource[] = [];

  if (process.env.SCRAPER_AUTOTRADER_DISABLED !== 'true') {
    sources.push({
      name: 'AutoTrader',
      url: (make, model, year) =>
        `https://www.autotrader.co.za/cars-for-sale?make=${make}&model=${model}&year=${year}`,
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
        `https://www.cars.co.za/usedcars/${make}/${model}/?Year=${year}`,
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

// ==================== MAIN EXPORTED FUNCTION ====================

export async function fetchValuation(
  make: string,
  model: string,
  year: string,
): Promise<ValuationResult> {
  const key = cacheKey(make, model, year);
  const cached = cacheGet(key);
  if (cached) return cached;

  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(model);
  const y = String(year);

  const sources = buildSources();

  const fetchPromises = sources.map(async (src) => {
    const url = src.url(m, mo, y);
    try {
      const html = await fetchWithRetry(url, { ...src.fetchConfig });
      return { name: src.name, html, selectors: src.selectors };
    } catch (err: any) {
      console.warn(`[scraper] ${src.name} failed:`, err.message);
      return { name: src.name, html: null, selectors: src.selectors };
    }
  });

  const results = await Promise.allSettled(fetchPromises);

  const allPrices: number[] = [];
  const sourcesOutput: SourceResult[] = [];

  for (const result of results) {
    if (result.status === 'rejected') continue;

    const { name, html } = result.value;
    if (!html) {
      sourcesOutput.push({ name, count: 0, avg: null });
      continue;
    }

    const selectors = sources.find((s) => s.name === name)!.selectors;
    const prices = extractPrices(html, selectors);
    allPrices.push(...prices);
    sourcesOutput.push({
      name,
      count: prices.length,
      avg: prices.length
        ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length)
        : null,
    });
  }

  if (allPrices.length === 0) {
    const data: ValuationResult = {
      averageRetailPrice: null,
      listingsFound: 0,
      fallbackRequired: true,
      searchUrl: `https://www.autotrader.co.za/cars-for-sale?make=${m}&model=${mo}&year=${y}`,
      carsUrl: sources.some((s) => s.name === 'Cars.co.za')
        ? `https://www.cars.co.za/usedcars/${m}/${mo}/?Year=${y}`
        : undefined,
      sources: sourcesOutput,
    };
    cachePut(key, data);
    return data;
  }

  const averageRetailPrice = Math.round(
    allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length,
  );

  const data: ValuationResult = {
    averageRetailPrice,
    listingsFound: allPrices.length,
    fallbackRequired: false,
    sources: sourcesOutput,
  };

  cachePut(key, data);
  return data;
}

export function clearValuationCache(): void {
  cache.clear();
}
