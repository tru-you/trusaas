# TruData — Project Status

**Last updated:** 2026-09-03 by Antigravity
**Purpose:** Persistent project context for coding agents. Update this file whenever architecture, integrations, or config changes.

---

## 1. What Is TruData

TruData is a **B2B data marketplace** for South Africa. Five product verticals, credit-based billing, honest data — you only pay for verified results.

**Domain:** `data.tru-saas.com`
**Stack:** Node/Express + vanilla HTML/JS/CSS SPA + JSON file storage
**Deploy:** Render.com starter plan, service `trusaas-data`

---

## 2. The 5 Product Pillars

| Pillar | Endpoint | Credits | Data Source | Status |
|--------|----------|---------|-------------|--------|
| 🚗 **Vehicles & Marine** | `POST /api/valuation/quick` + `/api/catalogue/search` | 1 | TransUnion static catalogue (312 makes) + Bright Data scraping (AutoTrader, Cars.co.za) | ✅ Live |
| 🏠 **Property** | `POST /api/property/comps` + `/api/property/fsbo` | 1 | Bright Data scraping (Property24, Private Property) | ✅ Live |
| 🔒 **SafePay** | `POST /api/safepay/verify` | 3 | Imagin8 TransUnion AVS (bank account verification) | ✅ Built |
| 🏢 **Business Finder** | `POST /api/agency/crawl` | 2 | Serper.dev (SERP) + Cheerio crawl + site audit | ✅ Live |
| 📋 **Bureau Reports** | `/api/imagin8/*` | 3 | Imagin8 TransUnion (valuation, reg check, accident) | ✅ Live |

### Pending Vertical: B2B Dossier (CIPC Directors)
- **What:** Business audit + CIPC company search + director lookup
- **Credits:** 5
- **Data source:** WinDeed or SearchWorks API (CIPC + Deeds Office)
- **Status:** ⏳ Waiting for API credentials from WinDeed/SearchWorks
- **Calls needed:** CIPC Company Search + CIPC Director Search only (NO credit bureau, NO Home Affairs, NO bank AVS)

---

## 3. Credit Wallet Economy

### Tiers

| Tier | Price | Credits | Per Credit |
|------|-------|---------|-----------|
| Pay-As-You-Go | R199 once-off | 15 | R13.27 |
| Pro Desk | R999/mo | 150 | R6.66 |
| Enterprise | R3,499/mo | 600 | R5.83 |

### Burn Rates

| Product | Credits | Our Cost | Margin (PAYG) |
|---------|---------|----------|--------------|
| Vehicle market value (scrape) | 1 | ~R0.50 | 96% |
| Property suburb comps (scrape) | 1 | ~R0.50 | 96% |
| Business website audit | 2 | ~R0.36 | 98% |
| SafePay bank verification | 3 | ~R10-12 | 70% |
| TransUnion vehicle valuation | 3 | ~R6.50 | 84% |
| TransUnion reg check | 3 | ~R6.50 | 84% |
| TransUnion accident report | 3 | ~R6.50 | 84% |
| B2B dossier with CIPC directors | 5 | ~R41 | 38% (TBC) |

### API Routes

- `GET /api/orders/credits/packs` — list credit packs + burn rates
- `GET /api/orders/credits/balance?email=...` — check credit balance
- `POST /api/orders/credits/purchase` — buy a credit pack
- `POST /api/orders/use` — burn credits for a product

---

## 4. Data Providers

### Active

| Provider | What For | Env Vars | Cost |
|----------|----------|----------|------|
| **Serper.dev** | Google SERP (primary) | `SERPER_API_KEY` | ~R0.018/query |
| **Bright Data** | Website scraping + SERP fallback | `BRIGHTDATA_API_KEY`, `BRIGHTDATA_UNLOCKER_ZONE` | ~R0.18/query (SERP) |
| **Imagin8 / TransUnion** | Vehicle valuations, reg checks, accident reports, SafePay AVS | `IMAGIN8_API_KEY`, `IMAGIN8_CUSTOMER_ID`, `IMAGIN8_USERNAME`, `IMAGIN8_PASSWORD`, `IMAGIN8_APP_NAME` | ~R6.50/call (valuations), ~R10-12 (AVS) |
| **DeepSeek** | Chat assistant | `DEEPSEEK_API_KEY` | ~R0.01/message |

### Pending

| Provider | What For | Sign-Up Status | API Status |
|----------|----------|---------------|------------|
| **WinDeed** | CIPC company/director search, Deeds Office | ✅ Signed up | ⏳ Request API: `windeed.support@lexisnexis.co.za` / 0861 946 333 |
| **SearchWorks** | CIPC + Deeds + multi-bureau (REST/JSON) | 🔄 Next | ⏳ Register at searchworks.co.za |

### SERP Priority Chain
```
Google search → Serper.dev (R0.018, primary)
             → Bright Data SERP (R0.18, fallback)
             → DuckDuckGo HTML (free, last resort)
```

---

## 5. Architecture

### Server Routes
- `server/routes/valuation.ts` — Vehicle valuation (SA-only)
- `server/routes/catalogue.ts` — TransUnion catalogue search (312 makes)
- `server/routes/safepay.ts` — Bank AVS via Imagin8
- `server/routes/orders.ts` — Credit wallet system
- `server/routes/chat.ts` — DeepSeek chatbot
- `server/routes/agency.ts` — Business finder
- `server/routes/property.ts` — Property comps + FSBO
- `server/routes/imagin8.ts` — TransUnion bureau reports (API key gated)

### Libraries
- `server/lib/serper.ts` — Serper.dev client
- `server/lib/imagin8.ts` — TransUnion/Imagin8 client (includes bankAvs)
- `server/lib/credits.ts` — Credit wallet persistence
- `server/lib/db.ts` — Order storage
- `server/lib/scraper/engine.ts` — Multi-source scraping pipeline
- `server/lib/legacy-finder/crawler.ts` — Business discovery + audit

### Frontend
- `public/index.html` — SPA (5 vertical tabs, credit pricing, chat widget)
- `public/app.js` — Catalogue typeahead, API calls, SafePay, real chat
- `public/styles.css` — Dark carbon/volt theme, mobile-first, WCAG AA
- `public/catalogue/` — TransUnion M&M catalogue (313 JSON files)

---

## 6. What Was Fixed (2026-09-03)
- 🔧 Property search UI now natively supports Property Type (House/Apartment) dropdown and FSBO (Owner Seller) mode.
- 🔧 Fixed UI mappings for Property and Business Finder which previously displayed NaN (medianAskingPrice, totalActiveListings).
- 🔧 Fixed Bureau Reports JSON payload structure (now correctly maps valuation to mmCode/year, regcheck to identifier/type).
- 🔧 Reverted Vehicles UI to single input box (TruLens/TruFlow handle advanced vehicle models natively).


- ❌ ALL fake data generators removed (fabricated names, phones, prices)
- ❌ ALL AI jargon stripped (Intelligence Engine, Telemetry, Gaussian, Arbitrage)
- ❌ ALL fake UI elements removed (glow orbs, cyber-grid, pulse dots, inflated metrics)
- 🐛 Fatal crawler crash fixed (`url` → `url: activeUrl`)
- 🐛 UK/US market code removed (SA-only launch)
- 🔐 API key gating on TransUnion endpoints
- 🔧 12 CSS/JS selector mismatches fixed (chat, modal, footer, nav, cookie, hamburger)
- 🔧 Pricing unified to credits (was showing old R prices AND credits simultaneously)
- 🔧 Catalogue search fixed — data is 2-level nested (`model → variant → {c,y}`), code was only walking 1 level
- 🔧 Toast container, loading spinner, empty state, error state added
- 🔧 btn-secondary, card-icon, features list, card price CSS added (were unstyled)
- 🔧 Vertical card buttons + nav links now scroll to console and switch tab
- 🔧 Chat close button, suggestion chips wired
- 🔧 "We scrape" → "We search" in How It Works
- 🔧 Hero sub-text shortened

---

## 7. UI/UX Status

**Current state:** Frontend rebuilt + 3-pass UI/UX review completed (2026-09-03). NOT YET COMMITTED.

**Known issues (owner review pending):**
- [ ] Results rendering needs further polish — valuation results display is rough
- [ ] Full browser test needed before commit (Chrome, Firefox, Safari, mobile)
- [ ] Footer links point to `#` (pages don't exist yet)

**Completed UI passes:**
1. ✅ Priority 1 — All selector mismatches + pricing consistency
2. ✅ Priority 2 — Section spacing, 5-card grid, SafePay form layout, tab scrolling, input styling
3. ✅ Priority 3 — Better icons, hero copy, loading/empty/error states, button/card styles, click wiring

---

## 8. Build & Run

```bash
npm install
npm run build    # esbuild, ~30ms
npm start        # http://localhost:3001

# Required env vars (in .env, gitignored)
SERPER_API_KEY=...
BRIGHTDATA_API_KEY=...
BRIGHTDATA_UNLOCKER_ZONE=...
IMAGIN8_API_KEY=...
IMAGIN8_CUSTOMER_ID=...
IMAGIN8_USERNAME=...
IMAGIN8_PASSWORD=...
IMAGIN8_APP_NAME=Flow
DEEPSEEK_API_KEY=...        # optional
TRUDATA_API_KEY=...          # optional in dev
```
