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

// ── Per-HOST circuit breakers ─────────────────────────────────────────────
// Keyed by hostname, NOT by transport tier. The old code keyed by tier, so
// cars.co.za's permanent 403 (server-side plain HTTP is blocked by design) hit
// `direct` three times and OPENED the whole tier for 5 minutes — after which
// AutoTrader, whose plain HTTP works in ~380ms, was forced down to the paid
// 15s unlocker. A permanently-blocked domain poisoned the tier for healthy
// domains. Now a host only breaks itself open.

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;

interface CircuitState {
  failures: number;
  openUntil: number;
}

const hostCircuits = new Map<string, CircuitState>();

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

function circuitOk(host: string): boolean {
  const c = hostCircuits.get(host);
  if (!c) return true;
  if (Date.now() >= c.openUntil) {
    hostCircuits.delete(host);
    return true;
  }
  return false;
}

function recordHostFailure(host: string): void {
  const c = hostCircuits.get(host) || { failures: 0, openUntil: 0 };
  c.failures++;
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    c.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    c.failures = 0;
  }
  hostCircuits.set(host, c);
}

function recordHostSuccess(host: string): void {
  hostCircuits.delete(host);
}

// ── HTML cache + single-flight + concurrency cap ──────────────────────────
// Fetching the same URL twice is wasted money on the unlocker and wasted time
// everywhere. The valuation cache already keys on make|model|year, but N
// listings of the SAME car arriving concurrently all miss that cache at once
// and each fires its own gatherComps → the same 4 target URLs in flight
// simultaneously. Single-flight collapses those to one upstream call each.
// The 10-minute HTML cache collapses repeated calls across scans and listings
// of different years that share a page.

const HTML_CACHE_TTL_MS = 10 * 60 * 1000;
const HTML_CACHE_MAX = 500;
const htmlCache = new Map<string, { html: string; ts: number }>();
const inFlight = new Map<string, Promise<string | null>>();

function cacheHtml(url: string, html: string): void {
  if (htmlCache.size >= HTML_CACHE_MAX) {
    const oldest = htmlCache.keys().next().value;
    if (oldest) htmlCache.delete(oldest);
  }
  htmlCache.set(url, { html, ts: Date.now() });
}

// Hard cap on concurrent upstream fetches: a scan with CONCURRENCY=5 × ~4
// target URLs per vehicle previously put 85+ requests in flight at once,
// self-inflicting rate limits on the very sites we scrape.
const MAX_CONCURRENT_FETCHES = 8;
let activeFetches = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function releaseSlot(): void {
  activeFetches--;
  const next = waiters.shift();
  if (next) next();
}

// ── Worker circuit (shared render service; kept separate from host circuit) ──
const WORKER_CIRCUIT_THRESHOLD = 3;
const WORKER_CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;
let workerFailCount = 0;
let workerOpenUntil = 0;
let workerActive = 0; // workers are shared and slow — don't stack them

async function renderViaHeadlessWorker(url: string): Promise<string | null> {
  if (WORKER_URLS.length === 0) return null;
  if (Date.now() < workerOpenUntil) return null;
  if (workerActive >= 2) return null;

  workerActive++;
  try {
    for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
      const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
      try {
        const res = await axios.post(
          `${worker.replace(/\/$/, '')}/scrape`,
          { url },
          { headers: { 'Content-Type': 'application/json' }, timeout: 12000 }
        );
        if (res.data?.ok && typeof res.data?.html === 'string') {
          workerFailCount = 0;
          return res.data.html;
        }
      } catch (err: any) {
        console.warn(`[fetch-html] Headless worker ${worker} failed on ${url}:`, err?.message || err);
      }
    }
    workerFailCount++;
    if (workerFailCount >= WORKER_CIRCUIT_THRESHOLD) {
      workerOpenUntil = Date.now() + WORKER_CIRCUIT_COOLDOWN_MS;
      console.warn(`[fetch-html] worker circuit open for ${WORKER_CIRCUIT_COOLDOWN_MS / 1000}s`);
    }
    return null;
  } finally {
    workerActive--;
  }
}

// ── Direct HTTP (8s timeout, 2 retries + backoff) ──

async function fetchDirect(url: string): Promise<string | null> {
  const host = hostOf(url);
  if (!circuitOk(host)) return null;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 8000 });
      if (res.status === 200 && typeof res.data === 'string' && res.data.length > 0) {
        return res.data;
      }
      recordHostFailure(host);
      return null;
    } catch (err: any) {
      // Transient — back off and retry (the sibling apps' fetchWithRetry).
      if (attempt < 2) {
        const delay = Math.pow(2, attempt) * 400 + Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  recordHostFailure(host);
  return null;
}

// ── Web Unlocker (Bright Data) tier (15s timeout) — only reached when the
// free tiers came up empty for this host.

async function fetchViaUnlocker(url: string): Promise<string | null> {
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
        // Bright Data error responses (e.g. 407 account suspended or proxy auth error body)
        if (html.includes('Account is suspended') || html.includes('Residential Failed') || html.includes('http_request_denied')) {
          console.warn('[fetch-html] Bright Data Unlocker error:', html.slice(0, 150));
          return null;
        }
        return html;
      }
    }
  } catch (bdErr: any) {
    // Unlocker failed
  }
  return null;
}

// ── Cloudflare challenge detector ──
function isCloudflareChallenge(html: string): boolean {
  if (!html) return false;
  return (
    html.includes('<title>Just a moment...</title>') ||
    html.includes('challenges.cloudflare.com') ||
    html.includes('cf-browser-verification') ||
    (html.includes('id="challenge-running"') && html.length < 50000)
  );
}

function isGoodPage(html: string | null): html is string {
  return !!html && html.length > 200 && !isCloudflareChallenge(html);
}

// ── Public API ──

/**
 * Unified HTML fetcher with single-flight + cache + concurrency cap and
 * per-host circuit breakers.
 *
 * Tier order: 1) Headless worker (free, shared)  2) Direct HTTP (free, per-host
 * circuit)  3) Bright Data Web Unlocker (paid, only when free tiers failed).
 *
 * A successful fetch from ANY tier resets that host's circuit; a host that
 * fails every tier three times in a row is skipped for 5 minutes (its 403s can
 * no longer disable the tier for other hosts).
 */
export async function fetchHtmlWithFallback(url: string): Promise<string | null> {
  // 1. HTML cache.
  const cached = htmlCache.get(url);
  if (cached && Date.now() - cached.ts < HTML_CACHE_TTL_MS) {
    return cached.html;
  }

  // 2. Single-flight: a concurrent caller with the same URL shares this fetch.
  const existing = inFlight.get(url);
  if (existing) return existing;

  const p = (async (): Promise<string | null> => {
    await acquireSlot();
    try {
      const host = hostOf(url);

      const workerHtml = await renderViaHeadlessWorker(url);
      if (isGoodPage(workerHtml)) {
        recordHostSuccess(host);
        cacheHtml(url, workerHtml);
        return workerHtml;
      }

      const directHtml = await fetchDirect(url);
      if (isGoodPage(directHtml)) {
        recordHostSuccess(host);
        cacheHtml(url, directHtml);
        return directHtml;
      }
      recordHostFailure(host);

      const unlockerHtml = await fetchViaUnlocker(url);
      if (isGoodPage(unlockerHtml)) {
        recordHostSuccess(host);
        cacheHtml(url, unlockerHtml);
        return unlockerHtml;
      }

      recordHostFailure(host);
      return null;
    } finally {
      releaseSlot();
    }
  })();

  inFlight.set(url, p);
  try {
    return await p;
  } finally {
    inFlight.delete(url);
  }
}

/** Cache diagnostics — exposed on /api/health so an empty scan is verifiable. */
export function cacheStats(): { cacheSize: number; inFlight: number; active: number; hostCircuits: string[] } {
  return {
    cacheSize: htmlCache.size,
    inFlight: inFlight.size,
    active: activeFetches,
    hostCircuits: [...hostCircuits.entries()].filter(([, c]) => Date.now() < c.openUntil).map(([h]) => h),
  };
}
