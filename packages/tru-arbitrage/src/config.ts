import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: Number(process.env.PORT) || 4500,

  // Auth — standalone dealer JWT layer
  JWT_SECRET: process.env.JWT_SECRET || '',
  DEMO_ENABLED: process.env.DEMO_ENABLED !== '0',

  // Shared secret with TruFlow — protects admin routes here and backs the
  // surgical TransUnion valuation backstop (Phase 2). Also used as the token
  // signing secret when JWT_SECRET is unset, like the sibling apps do.
  TRUFLOW_SYNC_KEY: process.env.TRUFLOW_SYNC_KEY || '',

  // Where the dealer's live stock is read from (My Stock surface, Phase 1)
  FLOW_PREMIUM_URL: process.env.FLOW_PREMIUM_URL || 'https://premium.tru-saas.com',

  // Bright Data Keys & Endpoints (Solves Cloudflare on Cars.co.za / AutoTrader)
  BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY || process.env.SERP_API_KEY || '',
  BRIGHTDATA_UNLOCKER_ZONE: process.env.BRIGHTDATA_UNLOCKER_ZONE || process.env.UNLOCKER_ZONE || 'unlocker',
  // Force the Web Unlocker lane even when BRIGHTDATA_API_KEY is unset (some services
  // gate the unlocker behind dashboard-set keys). "1"/"true"/"yes" = always attempt unlocker.
  // Matches the sibling apps' /^(1|true|yes)$/i gate — the old strict ==='1' silently
  // disabled the unlocker when the dashboard set "true".
  SCRAPER_UNLOCKER_ENABLED: /^(1|true|yes)$/i.test(process.env.SCRAPER_UNLOCKER_ENABLED || ''),

  // Google SERP Ingestion for Dealer Sites — multi-city discovery matrix +
  // per-dealer deep hits. SERP calls bill per request; QUERY_BUDGET is the cap.
  SERP_API_KEY: process.env.SERP_API_KEY || process.env.BRIGHTDATA_API_KEY || '',
  SERPER_API_KEY: process.env.SERPER_API_KEY || process.env.SERP_KEY || '',
  SERP_API_URL: process.env.SERP_API_URL || '',
  SERP_PROVIDER: (process.env.SERP_PROVIDER || 'brightdata').toLowerCase(),
  SERP_ZONE: process.env.SERP_ZONE || process.env.BRIGHTDATA_SERP_ZONE || 'serp',
  SERP_TIMEOUT_MS: Number(process.env.SERP_TIMEOUT_MS) || 30000,
  SERP_CITIES: process.env.SERP_CITIES || '',
  // Scraps are cheap — the budget is a runaway guard, not a cost ceiling.
  SERP_QUERY_BUDGET: Number(process.env.SERP_QUERY_BUDGET) || 40,
  SERP_DISCOVERY_HITS: Number(process.env.SERP_DISCOVERY_HITS) || 8,
  // Global domain exclusions (comma-separated) — a dealer's own site showing up
  // in their own buy-radar is noise. Per-dealer exclusion rides on the registry.
  SERP_EXCLUDE_DOMAINS: (process.env.SERP_EXCLUDE_DOMAINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),

  // Remote Headless Render Worker (Optional Cloudflare bypass)
  SCRAPER_SERVICE_URL: process.env.SCRAPER_SERVICE_URL || '',

  // AI Normalization
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Arbitrage Margins & Thresholds (R10k floor — high-volume turns)
  MIN_ARBITRAGE_MARGIN: Number(process.env.MIN_ARBITRAGE_MARGIN) || 10000,
  // Too-good-to-be-true gate: net margin above this fraction of market retail
  // means the comps or the asking price are wrong (salvage misparse, deposit
  // figure, snippet artifact). Miracles erode trust faster than misses.
  MARGIN_SANITY_CAP_PCT: Number(process.env.MARGIN_SANITY_CAP_PCT) || 0.4,
  // Dynamic recon — scaled to the unit's value (a flat R8,500 was the same
  // number on a R125k Polo and a R1.4m GLS). pct × marketRetail, clamped.
  RECON_PCT: Number(process.env.RECON_PCT) || 0.03,
  RECON_FLOOR: Number(process.env.RECON_FLOOR) || 5000,
  RECON_CAP: Number(process.env.RECON_CAP) || 30000,
  MIN_VEHICLE_PRICE: 20000,
  MAX_VEHICLE_PRICE: 2500000,

  // Days on Market & Distress Thresholds
  STALE_FLOORPLAN_DAYS: 40,
  CRITICAL_FLOORPLAN_DAYS: 60,
  MIN_DISTRESS_PRICE_DROP: 15000,

  // Valuation Confidence (the moat — Phase 2)
  CONFIDENCE_FLOOR: Number(process.env.CONFIDENCE_FLOOR) || 0.6,

  // My Stock overpriced gate (Phase 3) — percent over market before a unit counts
  OVERPRICED_THRESHOLD_PCT: Number(process.env.OVERPRICED_THRESHOLD_PCT) || 10,

  // Scraper Timeout & Cache
  SCRAPER_TIMEOUT_MS: Number(process.env.SCRAPER_TIMEOUT_MS) || 15000,
  SCRAPER_CACHE_TTL_MS: Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000,
  // Year band for classifieds SERPs — query year-1 / year / year+1 (dealer
  // habit: widen a year each side so a thin exact-year result set can't starve
  // the sample). Also the card-level year tolerance. 0 = exact year only.
  SCRAPER_YEAR_TOLERANCE: Math.max(0, Number(process.env.SCRAPER_YEAR_TOLERANCE) || 2),
  DATA_DIR: process.env.DATA_DIR || './data',

  // Auto-scan schedule
  AUTO_SCAN_ENABLED: process.env.AUTO_SCAN_ENABLED !== '0',
  SCAN_INTERVAL_MS: Number(process.env.SCAN_INTERVAL_MS) || 4 * 60 * 60 * 1000, // 4 hours
};