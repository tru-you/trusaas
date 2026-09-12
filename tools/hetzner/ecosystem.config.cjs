/**
 * TruSaaS — Hetzner PM2 Ecosystem Configuration
 * 
 * Runs all services locally on Hetzner with internal inter-service routing,
 * memory guards, and persistent data paths.
 */

const SYNC_KEY = "truflow_internal_sync_key_prod_2026";
const ADMIN_CODE = "GQR-GP8-WUF";
const DEEPSEEK_KEY = "sk-cf7153aa5a3642fb8af6e4c941924205";
const BRIGHTDATA_KEY = "7073d067-598e-43de-ae16-9f517af2c7c1";
const SERPER_KEY = "333c1fbbefd5812995aaee9d31d996ea351b88e0";

const IMAGIN8_CONFIG = {
  IMAGIN8_API_KEY: "A454229B-BB12-4105-A0BC-E2B765A4CC38",
  IMAGIN8_CUSTOMER_ID: "11030",
  IMAGIN8_USERNAME: "11030",
  IMAGIN8_PASSWORD: "Fruity22!@!@",
  IMAGIN8_APP_NAME: "Flow",
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
  ],
};
