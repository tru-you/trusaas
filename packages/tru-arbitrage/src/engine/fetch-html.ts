import axios from 'axios';
import { CONFIG } from '../config';

// ── Shared scraping constants (previously duplicated in valuation.ts & cars-autotrader.ts) ──

export const WORKER_URLS = (
  process.env.SCRAPER_SERVICE_URLS ||
  process.env.SCRAPER_SERVICE_URL ||
  process.env.TRUCRM_SCRAPER_URL ||
  ''
)
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

export const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-ZA,en;q=0.9',
  'Cache-Control': 'no-cache',
};

let workerIndex = 0;

// ── Circuit Breaker ──

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuits: Record<string, CircuitState> = {
  worker: { failures: 0, lastFailure: 0, open: false },
  direct: { failures: 0, lastFailure: 0, open: false },
  unlocker: { failures: 0, lastFailure: 0, open: false },
};

// After 3 consecutive failures → open circuit for 5 minutes (300000ms)
// Skip open circuits entirely (no timeout waste)
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

function isCircuitOpen(tier: string): boolean {
  const c = circuits[tier];
  if (!c || !c.open) return false;
  // Check if cooldown has elapsed → close circuit
  if (Date.now() - c.lastFailure >= CIRCUIT_COOLDOWN_MS) {
    c.failures = 0;
    c.open = false;
    c.lastFailure = 0;
    return false;
  }
  return true;
}

function recordSuccess(tier: string): void {
  const c = circuits[tier];
  if (!c) return;
  c.failures = 0;
  c.open = false;
  c.lastFailure = 0;
}

function recordFailure(tier: string): void {
  const c = circuits[tier];
  if (!c) return;
  c.failures++;
  c.lastFailure = Date.now();
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    c.open = true;
  }
}

// ── Tier 1: Headless Worker (12s timeout) ──

async function renderViaHeadlessWorker(url: string): Promise<string | null> {
  if (WORKER_URLS.length === 0) return null;
  if (isCircuitOpen('worker')) return null;

  for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
    const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
    try {
      const res = await axios.post(
        `${worker.replace(/\/$/, '')}/scrape`,
        { url },
        { headers: { 'Content-Type': 'application/json' }, timeout: 12000 }
      );
      if (res.data?.ok && typeof res.data?.html === 'string') {
        recordSuccess('worker');
        return res.data.html;
      }
    } catch (err: any) {
      console.warn(`[fetch-html] Headless worker ${worker} failed on ${url}:`, err?.message || err);
    }
  }
  recordFailure('worker');
  return null;
}

// ── Tier 2: Direct HTTP (8s timeout) ──

async function fetchDirect(url: string): Promise<string | null> {
  if (isCircuitOpen('direct')) return null;

  try {
    const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 8000 });
    if (res.status === 200 && typeof res.data === 'string') {
      recordSuccess('direct');
      return res.data;
    }
  } catch (err: any) {
    // Direct fetch failed
  }
  recordFailure('direct');
  return null;
}

// ── Tier 3: Bright Data Unlocker (15s timeout) ──

async function fetchViaUnlocker(url: string): Promise<string | null> {
  if (isCircuitOpen('unlocker')) return null;
  if (!CONFIG.SCRAPER_UNLOCKER_ENABLED && !CONFIG.BRIGHTDATA_API_KEY) return null;

  try {
    const bdRes = await axios.post(
      'https://api.brightdata.com/request',
      { zone: CONFIG.BRIGHTDATA_UNLOCKER_ZONE, url, format: 'raw', country: 'za' },
      {
        headers: {
          Authorization: `Bearer ${CONFIG.BRIGHTDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    if (bdRes.status === 200) {
      const raw = bdRes.data;
      let html: string | null = null;
      if (typeof raw === 'string') {
        if (raw.startsWith('{') || raw.startsWith('[')) {
          try {
            const parsed = JSON.parse(raw);
            html = parsed?.body ?? parsed?.html ?? parsed?.result ?? raw;
          } catch {
            html = raw;
          }
        } else {
          html = raw;
        }
      } else if (raw && typeof raw === 'object') {
        html = raw.body ?? raw.html ?? raw.result ?? JSON.stringify(raw);
      }
      if (html) {
        recordSuccess('unlocker');
        return html;
      }
    }
  } catch (bdErr: any) {
    // Unlocker failed
  }
  recordFailure('unlocker');
  return null;
}

// ── Public API ──

/**
 * Unified HTML fetcher with 3-tier fallback and per-tier circuit breakers.
 * Tries: 1) Headless worker  2) Direct HTTP  3) Bright Data Unlocker
 */
export async function fetchHtmlWithFallback(url: string): Promise<string | null> {
  // Tier 1: Headless worker
  const workerHtml = await renderViaHeadlessWorker(url);
  if (workerHtml && workerHtml.length > 200) return workerHtml;

  // Tier 2: Direct HTTP
  const directHtml = await fetchDirect(url);
  if (directHtml) return directHtml;

  // Tier 3: Bright Data Unlocker
  const unlockerHtml = await fetchViaUnlocker(url);
  if (unlockerHtml) return unlockerHtml;

  return null;
}
