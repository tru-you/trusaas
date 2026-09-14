/**
 * TruSaaS — Hetzner PM2 Ecosystem Configuration
 * 
 * Runs all services locally on Hetzner with internal inter-service routing,
 * memory guards, and persistent data paths.
 */

// SECURITY: These MUST be set via environment variables on the server.
// Never hardcode production secrets here — empty = startup will fail with clear error.
const SYNC_KEY = process.env.TRUFLOW_SYNC_KEY || "";
const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE || "";
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const BRIGHTDATA_KEY = process.env.BRIGHTDATA_API_KEY || "";
const SERPER_KEY = process.env.SERPER_API_KEY || "";
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY || "";
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || "";
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || "";

const IMAGIN8_CONFIG = {
  IMAGIN8_API_KEY: process.env.IMAGIN8_API_KEY || "",
  IMAGIN8_CUSTOMER_ID: process.env.IMAGIN8_CUSTOMER_ID || "",
  IMAGIN8_USERNAME: process.env.IMAGIN8_USERNAME || "",
  IMAGIN8_PASSWORD: process.env.IMAGIN8_PASSWORD || "",
  IMAGIN8_APP_NAME: process.env.IMAGIN8_APP_NAME || "Flow",
};

module.exports = {
  apps: [
    // 1. Market Scraper (Headless Valuation Engine)
    {
      name: "trusaas-scraper",
      cwd: "/var/www/trusaas/packages/market-scraper",
      script: "webapp/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 4300,
        BRIGHTDATA_API_KEY: BRIGHTDATA_KEY,
        BRIGHTDATA_UNLOCKER_ZONE: "auto",
        SCRAPER_UNLOCKER_ENABLED: "1",
        SERPER_API_KEY: SERPER_KEY,
        DEEPSEEK_API_KEY: DEEPSEEK_KEY,
      },
    },

    // 2. TruFlow Premium (DMS & Core Central Ledger)
    {
      name: "trusaas-premium",
      cwd: "/var/www/trusaas/truflow-premium",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: 3003,
        DATA_DIR: "/var/data/trusaas/premium",
        VALUATION_ENGINE: "remote",
        SCRAPER_REMOTE_URL: "http://127.0.0.1:4300",
        TRUFLOW_SYNC_KEY: SYNC_KEY,
        SYNC_SERVICE_KEY: SYNC_KEY,
        ADMIN_ACCESS_CODE: ADMIN_CODE,
        DEEPSEEK_API_KEY: DEEPSEEK_KEY,
        BRIGHTDATA_API_KEY: BRIGHTDATA_KEY,
        BRIGHTDATA_UNLOCKER_ZONE: "auto",
        ...IMAGIN8_CONFIG,
      },
    },

    // 3. TruInspect (Condition Reports & Manager)
    {
      name: "trusaas-inspect",
      cwd: "/var/www/trusaas/truinspect",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        DATA_DIR: "/var/data/trusaas/inspect",
        DEFAULT_DMS_URL: "http://127.0.0.1:3003",
        TRUFLOW_DMS_URL: "http://127.0.0.1:3003",
        TRUFLOW_SYNC_KEY: SYNC_KEY,
        SYNC_SERVICE_KEY: SYNC_KEY,
        SCRAPER_REMOTE_URL: "http://127.0.0.1:4300",
        VALUATION_ENGINE: "remote",
        DEMO_ENABLED: "1",
        ...IMAGIN8_CONFIG,
      },
    },

    // 4. TruLens (Photo Studio PWA)
    {
      name: "trusaas-lens",
      cwd: "/var/www/trusaas/TruLens",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        DATA_DIR: "/var/data/trusaas/lens",
        DEFAULT_DMS_URL: "http://127.0.0.1:3003",
        TRUFLOW_DMS_URL: "http://127.0.0.1:3003",
        TRUFLOW_SYNC_KEY: SYNC_KEY,
        SYNC_SERVICE_KEY: SYNC_KEY,
        SCRAPER_REMOTE_URL: "http://127.0.0.1:4300",
        VALUATION_ENGINE: "remote",
        DEMO_ENABLED: "1",
        ...IMAGIN8_CONFIG,
      },
    },

    // 5. TruFlow Mobile (Companion Mobile App)
    {
      name: "trusaas-mobile",
      cwd: "/var/www/trusaas/truflow-mobile",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 3004,
        API_TARGET: "http://127.0.0.1:3003",
        TRUFLOW_DMS_URL: "http://127.0.0.1:3003",
        CHAT_API: "http://127.0.0.1:5000",
        TRUFLOW_SYNC_KEY: SYNC_KEY,
      },
    },

    // 6. TruChat API (AI Chatbot & Assistant Engine)
    {
      name: "trusaas-chat",
      cwd: "/var/www/trusaas/truchat-api",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        DEEPSEEK_API_KEY: DEEPSEEK_KEY,
        STOCK_API: "http://127.0.0.1:3003/api/public/stock?dealer=true-cars",
        STOCK_API_FALLBACK: "http://127.0.0.1:3003/api/public/stock?dealer=cars-on-caledon",
        SALES_WHATSAPP: "27821234567",
      },
    },

    // 7. TruCRM (Sales & Lead Management CRM)
    {
      name: "trucrm",
      cwd: "/var/www/trusaas/TruCRM",
      script: "dist/server.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: 3005,
        DATA_DIR: "/var/data/trusaas/crm",
        DEEPSEEK_API_KEY: DEEPSEEK_KEY,
        BRIGHTDATA_API_KEY: BRIGHTDATA_KEY,
        BRIGHTDATA_UNLOCKER_ZONE: "tds2",
        BRIGHTDATA_SERP_ZONE: "tds",
        GEOAPIFY_API_KEY: GEOAPIFY_KEY,
        ADZUNA_APP_ID: ADZUNA_APP_ID,
        ADZUNA_APP_KEY: ADZUNA_APP_KEY,
        SCRAPER_SERVICE_URL: "http://127.0.0.1:10010",
      },
    },

    // 8. TruCRM Scraper (Headless Chromium Render Worker)
    {
      name: "trucrm-scraper",
      cwd: "/var/www/trusaas/TruCRM",
      script: "dist/scrape-worker.cjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: 10010,
      },
    },
  ],
};
