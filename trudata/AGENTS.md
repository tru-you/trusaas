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
| 🚗 **Vehicles & Heavy Assets** | `POST /api/valuation/quick` + `/api/catalogue/*` | 1 | TransUnion catalogue (Cars, Moto, Marine, Commercial, Caravans, Yellow Metal/Ag) + Bright Data scraping | ✅ Live |
| 💻 **Electronics & Tech** | `POST /api/electronics/valuation` | 1 | Serper Google Shopping ZA + Organic retail comps (Takealot, iStore, Makro, Incredible) | ✅ Live |
| 🏠 **Property** | `POST /api/property/comps` + `/api/property/fsbo` | 1 | Bright Data scraping (Property24, Private Property) | ✅ Live |
| 🔒 **SafePay** | `POST /api/safepay/verify` | 3 | Imagin8 TransUnion AVS (bank account verification) | ✅ Live |
| 🏢 **Business Finder** | `POST /api/agency/crawl` | 2 | Serper.dev (SERP) + Cheerio crawl + site audit | ✅ Live |
| 📋 **Bureau Reports** | `/api/imagin8/*` | 3 | Imagin8 TransUnion (valuation, reg check, accident) | ✅ Live |

### Features Added (2026-09-10)
- **Property Suburb Sales Comps & FSBO Lead Radar:** Fully wired workbench with dual Suburb Comps (Property24 & Private Property) and live Private Seller (FSBO) Lead Radar.
  - Form `#panel-property` takes Suburb, City/Metro, Property Type (All, Houses, Apartments, Townhouses), and Intelligence Scope (Comps + FSBO, FSBO Only, Comps Only).
  - Parallel extraction from `/api/property/comps` and `/api/property/fsbo`.
  - Rich UI results deck with 4 key metrics (Median Asking Price, Price Spread Low-High, Active Comps with Confidence Score, FSBO Radar Count with 0% Comm badge).
  - Dual sub-tab switcher: Direct Private Sellers Table with verified phone numbers, days on market, portal source badge (`Gumtree Private`, `Private Property Direct`), 1-tap direct pre-filled WhatsApp CTA (`💬 WhatsApp Owner`), and source listing link.
  - Suburb Comps Table detailing Property24 and Private Property listings count and average asking price.
  - Auto-generated WhatsApp inquiry message with property title and price.

### Features Added (2026-09-04)
- **Multi-Vertical Vehicle Catalogue:** 6 sub-verticals (`cars`, `moto`, `marine`, `trucks`, `caravans`, `yellowmetal`) wired to dynamic catalogue filtering in `/api/catalogue/makes` & `/api/catalogue/models` with SPECIALTY mapping.
- **Electronics & Tech Valuation:** Full search engine for consumer tech (MacBooks, iPhones, gaming consoles, TVs, appliances) analyzing 40+ South African retail & refurb comps per query with price distribution metrics (median, low, high, top merchants).
- **Credit Wallet Self-Serve Monetization:** Persistent wallet balance pill (`#wallet-pill`), credit purchase modal (`#credit-modal`) with PayFast sandbox/live checkout, and automatic credit deductions (3 credits on TransUnion bureau checks & SafePay; 1 credit on asset reports).

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

## 6. What Was Fixed (2026-09-04)
- 🚀 **Scrapers & Results Diagnosis (Deep Dive & Fix):**
  - **Vehicles (AutoTrader & Cars.co.za via Bright Data Unlocker):**
    - *Root Cause:* The UI was sending full TransUnion trim names (e.g., `"HILUX 2.4 GD-6 RB SRX P/U S/C"`). The scraper's `titleMentionsVehicle` matcher checked if classifieds card titles contained the exact trim string, discarding 100% of candidate listings.
    - *Fix:* Passed clean base model (`selectedGroup`, e.g. `"Hilux"`) to `/api/valuation/quick` with the trim passed as `variant` for display. Updated `valuation.ts` to sanitize compound strings. Result: 59 listings found for 2020 Hilux (R 473k median), 41 listings found for 2019 Golf (R 445k median).
  - **Business Finder (Local Directory & Crawl Audit):**
    - *Root Cause:* Backend crawler `/api/agency/crawl` returned `{ targets: [...] }`, but `app.js` looked for `data.results`, setting `businesses` to `[]` and displaying "No businesses found" despite live businesses being crawled.
    - *Fix:* Changed `app.js` to `data.targets || data.results || []`. Enhanced table to render Website link, Phone, Email, WhatsApp link, Health Score, and defect counts.
  - **Property FSBO (Private Seller Intelligence):**
    - *Root Cause:* Overly complex boolean operators and `site:` filters triggered Serper error 400 (`Query pattern not allowed for free accounts`), while the Bright Data fallback was guarded behind `!process.env.SERPER_API_KEY`.
    - *Fix:* Replaced queries with natural language searches (`${suburb} property for sale private seller`, etc.), and enabled Bright Data fallback whenever `liveLeads` is empty. Successfully returns live private seller leads (e.g., 5 live Sandton owner listings).
- 🐛 **UI Event Binding Root Cause Fixed:** In `index.html`, all search forms were rendered as `<div>` containers instead of `<form>` elements. Because `<div>` does not emit `'submit'` events, clicking buttons or pressing Enter never triggered any searches (Property, Business, Bureau). Converted all search containers to semantic `<form>` elements.
- 🐛 **Vehicles Dropdowns Fully Implemented:** Wired up the 4 dependent dropdowns (Make → Model → Variant → Year) to load live TransUnion models from `/api/imagin8/models` with static catalogue fallback, auto-enabling the search button and passing parameters to `/api/valuation/quick`.
- 🐛 **Fixed Unhandled ReferenceError in app.js:** An un-declared variable `catalogueResults` in a document-level click listener threw runtime errors on every click. Safely guarded with element lookups.
- 🔐 **Imagin8 API Key Gating Tuned:** Allowed same-origin/SPA web client requests while maintaining API key protection for external API consumers.


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
