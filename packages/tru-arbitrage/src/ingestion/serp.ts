/**
 * SERP ingestion — the widest lane: hits dealer WEBSITES directly.
 *
 * Two phases per scan:
 *   1. DISCOVERY — a matrix of `site:*.co.za "used cars" <city>` queries across
 *      SA metros. Every organic hit is a candidate listing; every .co.za domain
 *      that isn't a known aggregator is recorded as a dealer domain.
 *   2. DEEP HITS — for the newest discovered domains, a `site:<domain>` query
 *      pulls that dealer's own stock pages. Discovered domains persist in the
 *      store, so each scan both widens (new cities/domains) and deepens
 *      (known dealers' stock).
 *
 * The classifieds lane (cars-autotrader.ts) covers the aggregators; this lane
 * is for the long tail of independent dealer sites the aggregators don't
 * fully index. SERP calls bill per request — SERP_QUERY_BUDGET is the guard.
 */
import axios from 'axios';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';
import { db } from '../storage/db';

const PRICE_SCAN_RE = /R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,7})/i;

const DEFAULT_CITIES = [
  'Johannesburg', 'Pretoria', 'Cape Town', 'Durban', 'Sandton', 'Midrand',
  'Centurion', 'Randburg', 'Gqeberha', 'Port Elizabeth', 'Bloemfontein',
  'East London', 'Nelspruit', 'Polokwane', 'George', 'Pietermaritzburg',
];

/** Aggregators + platforms that are NOT individual dealer sites. The
 *  classifieds lane already covers these — SERP discovery is for the long
 *  tail of independent dealer websites. */
const NON_DEALER_DOMAINS = new Set([
  'cars.co.za', 'autotrader.co.za', 'gumtree.co.za', 'webuycars.co.za',
  'bid4cars.co.za', 'facebook.com', 'youtube.com', 'google.com', 'instagram.com',
  'linkedin.com', 'hellopeter.com', 'wikipedia.org', 'blogspot.com', 'wordpress.com',
  'blogger.com', 'yelp.com', 'googlegroups.com', 'junkmail.co.za', 'adlandi.co.za',
  'gumtree.com', 'autotrader.com', 'cars.com', 'bidvest.co.za', 'tru-saas.com',
]);

function extractPrice(text: string): number | null {
  const m = text.match(PRICE_SCAN_RE);
  if (!m) return null;
  const val = parseInt(m[1].replace(/[^\d]/g, ''), 10);
  return val >= CONFIG.MIN_VEHICLE_PRICE && val <= CONFIG.MAX_VEHICLE_PRICE ? val : null;
}

/** First known SA metro mentioned in the text, else the national fallback. */
export function parseCity(text: string, cities: string[]): string {
  const lower = text.toLowerCase();
  for (const c of cities) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  return 'South Africa';
}

/** Is this hostname an individual dealer site (not an aggregator/platform)? */
export function isDealerDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (!host.endsWith('.co.za')) return false;
  return !NON_DEALER_DOMAINS.has(host);
}

/** Normalise a link into a bare domain for the discovery index. */
function domainOf(link: string): string | null {
  try {
    return new URL(link).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** One SERP call → organic results array. BrightData SERP first, SerpApi fallback.
 *  Failures LOG THE HTTP STATUS loudly — a misconfigured zone (400) otherwise
 *  silently zeroes the whole discovery pass and looks like "no results". */
async function runSerpQuery(q: string): Promise<any[]> {
  try {
    let json: any = null;
    if (CONFIG.SERP_PROVIDER === 'brightdata') {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=za&hl=en&num=20&brd_json=1`;
      const res = await axios.post(
        CONFIG.SERP_API_URL || 'https://api.brightdata.com/request',
        { zone: CONFIG.SERP_ZONE, url: googleUrl, format: 'raw' },
        {
          headers: { Authorization: `Bearer ${CONFIG.SERP_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: CONFIG.SERP_TIMEOUT_MS,
          validateStatus: () => true, // handle non-2xx ourselves — axios throws by default
        }
      );
      if (res.status !== 200) {
        const body = typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data).slice(0, 200);
        console.warn(`[serp-ingestion] BrightData HTTP ${res.status} on zone '${CONFIG.SERP_ZONE}' — check the zone name/type in the dashboard. Body: ${body}`);
        return [];
      }
      json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    } else {
      const base = CONFIG.SERP_API_URL || 'https://serpapi.com/search.json';
      const url = `${base}?engine=google&google_domain=google.co.za&gl=za&hl=en&num=20&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(CONFIG.SERP_API_KEY)}`;
      const res = await axios.get(url, { timeout: CONFIG.SERP_TIMEOUT_MS });
      json = res.data;
    }
    const organic = json?.organic_results || json?.organic || [];
    if (!Array.isArray(organic) || organic.length === 0) {
      console.warn(`[serp-ingestion] zone '${CONFIG.SERP_ZONE}' returned 0 organic results for: ${q.slice(0, 60)}…`);
    }
    return Array.isArray(organic) ? organic : [];
  } catch (err: any) {
    const status = err?.response?.status;
    const detail = err?.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : (err?.message || err);
    console.warn(`[serp-ingestion] query failed${status ? ` (HTTP ${status})` : ''} (${q.slice(0, 60)}…):`, detail);
    return [];
  }
}

function toListing(r: any, cities: string[]): RawFbListing | null {
  const title = String(r?.title || '');
  const snippet = String(r?.snippet || r?.description || '');
  const combined = `${title} ${snippet}`;
  const price = parseNum(r?.extracted_price) ?? extractPrice(combined);
  const link = r?.link || r?.url;
  if (!price || !link) return null;
  try {
    const u = new URL(link);
    if (u.hostname.includes('google.') || u.hostname.includes('youtube.')) return null;
  } catch { return null; }
  const domain = domainOf(link) || 'unknown';
  return {
    id: `serp_${Buffer.from(link).toString('base64').slice(0, 16)}`,
    source: 'dealer_direct',
    url: link,
    title,
    description: snippet,
    final_price: price,
    price,
    currency: 'ZAR',
    location: parseCity(combined, cities),
    seller_name: domain,
    images: [],
    date_posted: new Date().toISOString(),
  };
}

export async function fetchDealerWebsitesViaSerp(excludeDomains: string[] = []): Promise<RawFbListing[]> {
  if (!CONFIG.SERP_API_KEY) {
    console.log('[serp-ingestion] No SERP_API_KEY configured, skipping Google SERP dealer scrape.');
    return [];
  }

  // A dealer's own website in their own buy-radar is noise. Exclusions =
  // global config list + the authenticated dealer's registered site domain.
  const excluded = new Set([...CONFIG.SERP_EXCLUDE_DOMAINS, ...excludeDomains.map((d) => d.toLowerCase().replace(/^www\./, ''))]);

  const cities = (CONFIG.SERP_CITIES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cityList = cities.length ? cities : DEFAULT_CITIES;
  const budget = Math.max(1, CONFIG.SERP_QUERY_BUDGET || 24);
  const discoveryHits = Math.max(0, CONFIG.SERP_DISCOVERY_HITS || 6);

  // Phase 1 — discovery matrix: phrase × cities until the budget is spent.
  const discoveryQueries: string[] = [];
  for (const city of cityList) {
    discoveryQueries.push(`site:*.co.za "used cars" "for sale" ${city} price R`);
  }
  const queries = discoveryQueries.slice(0, budget);

  const out: RawFbListing[] = [];
  const seenLinks = new Set<string>();
  const knownDomains = new Set(db.getSerpDomains());
  const freshDomains: string[] = [];

  const absorb = (results: any[]) => {
    for (const r of results) {
      const listing = toListing(r, cityList);
      if (!listing || seenLinks.has(listing.url)) continue;
      const listingDomain = (listing.seller_name || '').toLowerCase();
      if (excluded.has(listingDomain)) continue;
      seenLinks.add(listing.url);
      out.push(listing);
      const domain = listing.seller_name || '';
      if (domain !== 'unknown' && !knownDomains.has(domain) && isDealerDomain(domain)) {
        knownDomains.add(domain);
        freshDomains.push(domain);
      }
    }
  };

  // Run discovery queries 3 at a time.
  const queue = [...queries];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(3, queue.length); w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const q = queue.shift()!;
        absorb(await runSerpQuery(q));
      }
    })());
  }
  await Promise.all(workers);

  // Phase 2 — deep hits: pull stock pages from the newest discovered domains,
  // budget permitting. Known dealers get re-hit on later scans via rotation.
  const remaining = budget - queries.length;
  const deepDomains = freshDomains.slice(0, Math.min(discoveryHits, Math.max(0, remaining)));
  if (deepDomains.length > 0) {
    console.log(`[serp-ingestion] ${freshDomains.length} new dealer domains discovered — deep-hitting ${deepDomains.length}`);
    const deepQueue = deepDomains.map((d) => `site:${d} "used cars" OR "our stock" price R`);
    const deepWorkers: Promise<void>[] = [];
    for (let w = 0; w < Math.min(3, deepQueue.length); w++) {
      deepWorkers.push((async () => {
        while (deepQueue.length > 0) {
          const q = deepQueue.shift()!;
          absorb(await runSerpQuery(q));
        }
      })());
    }
    await Promise.all(deepWorkers);
  }

  // Persist the discovery index (global search infrastructure, not tenant data).
  const now = new Date().toISOString();
  for (const d of freshDomains) db.recordSerpDomain(d, now);

  console.log(`[serp-ingestion] ${queries.length + deepDomains.length} SERP queries -> ${out.length} dealer-site listings (${freshDomains.length} new dealer domains)`);
  return out;
}