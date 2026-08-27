import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: Number(process.env.PORT) || 4500,
  
  // Bright Data Keys & Endpoints
  BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY || '',
  BRIGHTDATA_DATASET_ID: process.env.BRIGHTDATA_DATASET_ID || 'gd_lvt9iwuh6fbcwmx1a',
  BRIGHTDATA_UNLOCKER_ZONE: process.env.BRIGHTDATA_UNLOCKER_ZONE || process.env.UNLOCKER_ZONE || 'unlocker',
  
  // Google SERP Ingestion for Dealer Sites
  SERP_API_KEY: process.env.SERP_API_KEY || process.env.BRIGHTDATA_API_KEY || '',
  SERP_API_URL: process.env.SERP_API_URL || '',
  SERP_PROVIDER: (process.env.SERP_PROVIDER || 'brightdata').toLowerCase(),
  SERP_ZONE: process.env.SERP_ZONE || process.env.BRIGHTDATA_SERP_ZONE || 'serp',
  SERP_TIMEOUT_MS: Number(process.env.SERP_TIMEOUT_MS) || 30000,
  
  // AI Normalization
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  
  // Arbitrage Margins & Thresholds
  MIN_ARBITRAGE_MARGIN: Number(process.env.MIN_ARBITRAGE_MARGIN) || 25000,
  DEFAULT_RECON_BUFFER: Number(process.env.DEFAULT_RECON_BUFFER) || 8500,
  MIN_VEHICLE_PRICE: 20000,
  MAX_VEHICLE_PRICE: 2500000,
  
  // Days on Market & Distress Thresholds
  STALE_FLOORPLAN_DAYS: 40,
  CRITICAL_FLOORPLAN_DAYS: 60,
  MIN_DISTRESS_PRICE_DROP: 15000,
  
  // Scraper Timeout & Cache
  SCRAPER_TIMEOUT_MS: Number(process.env.SCRAPER_TIMEOUT_MS) || 15000,
  SCRAPER_CACHE_TTL_MS: Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1000,
  DATA_DIR: process.env.DATA_DIR || './data',
};
