# TruSaaS — Agent Project Memory

**Last updated:** 2026-09-12 by Antigravity
**Purpose:** Persistent project context for coding agents. Update this file whenever architecture, integrations, or deployment config changes.

---

## 0. Strict Agent Deployment & Brand Rules

- **BRAND IDENTITY & LOGO ARCHITECTURE (2026-09-12):**
  - **Sibling Apps (TruFlow, TruInspect, TruLens, TruLive, TruTrade):**
    - Strictly use the **3D Hex Icon mark ONLY** (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.svg`, login cards, and app headers). No wide text wordmark cluttering mobile headers.
    - PWA Service Workers: Cache version MUST be bumped on icon/shell changes (`sw.js`) so yard handsets immediately drop old shells and display new marks.
  - **Dealer Showroom & Marketing Web (trudealers.com):**
    - Header uses the full **3D Horizontal Logo** (`trudealer-logo-3d-horizontal.png`) at bold scale: 52px desktop, 44px tablet, 40px mobile.
    - Embedded SVG fallback (`trudealer-nav-logo.svg`) carries a self-contained base64 Data URI to prevent browser image sandbox blocking.

- **MASTER TRUFLOW AUTHORITY & MULTI-TENANT ARCHITECTURE (HETZNER `2.29.17.123`):**
  - **Master TruFlow is the Single Source of Truth for Identity & Product Entitlements:**
    - Master Admin manages dealerships, grants product suites (`flow`, `lens`, `inspect`, `live`, `value`, `social`), and issues/rotates access codes via the Dealership Admin UI or API.
    - Sibling apps (TruLens, TruInspect, TruLive, TruTrade) authenticate client codes dynamically against TruFlow via `POST /api/auth/verify-code`.
  - **Current Production Access Codes & Tenant Profiles (Issued & Verified):**
    - **Master Admin:** `GQR-GP8-WUF` / `tru2026` (Role: admin, platform-wide visibility across 49 units, administrative console only).
    - **True Cars:** `6SY-WJH-5KY` / `true-cars` (Full suite: `flow`, `lens`, `inspect`, `live`, `value`, `social`; 36 units live).
    - **Cars on Caledon:** `E6Z-XHB-F2F` / `cars-on-caledon` (Full suite: `flow`, `lens`, `inspect`, `live`, `value`, `social`; 13 units live).
    - **MKR Auto Sales:** `YBA-RG4-SP7` / `mkr-autosales` (Full suite).
    - **Apex Auto Investments:** `APX-7K9-W2M` / `apex-auto` (Inspect-only: 0 units in Flow DMS, 2 in TruInspect).
    - **Your Car Guy:** `YCG-8M4-P9X` / `your-car-guy` (Inspect-only: 0 units in Flow DMS, 5 in TruInspect).
  - **Tenant Boundary Enforcement:**
    - Sibling apps and public feeds strictly enforce product entitlements returned by TruFlow.
    - Inspect-only tenants have 0 inventory in TruFlow DMS and are never broadcast to public showroom feeds.
  - **Photo Storage Architecture:**
    - Photos are content-addressed files under `/var/data/trusaas/{premium,lens}/media/<sha256>.jpg`, referenced by URLs, never raw base64 database rows.


---

## 1. Project Overview

TruSaaS is a vertical SaaS platform for independent car dealerships in South Africa (launch market). Two product lines:

- **TruDealer** — Dealer management stack (TruLens, TruInspect, TruFlow, TruTrade, widgets, etc.)
- **TruProperty** — Parallel stack for real estate (PropLens, PropInspect, etc.) — separate repo branch

This repo (`TruDealerMaster`) is the main product codebase. `TruProperty Master/` is a sibling directory with its own git history.

---

## 2. Architecture

### Live Services (Render — always-on starter plan)

| Service | App | Domain | Disk |
|---|---|---|---|
| `trusaas-lens` | TruLens (PWA photo studio) | `lens.tru-saas.com` | 5GB |
| `trusaas-inspect` | TruInspect (condition reports + desktop manager) | `inspect.tru-saas.com` | 5GB |
| `trusaas-premium` | TruFlow DMS (full dealer management) | `premium.tru-saas.com` | 10GB |
| `trusaas-mobile` | TruFlow Mobile (companion app) | `app.tru-saas.com` | — |
| `trusaas-live` | TruLive (WebRTC walkthroughs) | `live.tru-saas.com` | — |
| `trusaas-trade` | TruTrade (trade-in valuations) | `trade.tru-saas.com` | — |
| `trusaas-chat` | TruChat API (DeepSeek bot) | `chat.tru-saas.com` | — |

All defined in `render.yaml`. **Do not downgrade to free tier** — starter plan prevents 30-60s cold starts.

### Widgets (CDN)

- **CDN:** `cdn.tru-saas.com` (Netlify site `bca2fe0a-8055-4ae9-be49-389c2cce27b4`)
- **Active source:** `packages/standalone/` — 8 widgets (afford, book, chat, concierge, form, loader, repay, share)
- **WordPress plugin:** `packages/truwidgets-wp/`
- **Frozen legacy:** `packages/tru-*/` — do not edit, only for old case-site deploys

### Shared Code

- `packages/imagin8.ts` — TransUnion eValue8 API client (used by Lens, Inspect, Premium)
- `packages/tru-ui-src/` — Shared UI components synced before build

---

## 3. Current Integrations

### Imagin8 / TransUnion eValue8

**Status:** Active, `applicationName` = `Flow` (confirmed working)

**Env vars (all services):**
- `IMAGIN8_API_KEY` — platform API key
- `IMAGIN8_CUSTOMER_ID` — account ID
- `IMAGIN8_USERNAME` — account login
- `IMAGIN8_PASSWORD` — account password
- `IMAGIN8_APP_NAME` — **`Flow`** (changed from `eValue8Broker`)

**API methods used:**
- `getStaticInfo(mmCode)` → vehicle specs (flat-fee, unlimited calls) — used in Add Vehicle auto-fill
- `getModels(make)` → live model catalogue (flat-fee, unlimited calls) — **working 2026-08-21**
- `getValues(mmCode, year, mileage)` → TU valuation (chargeable per-call) — **bundle-gated**, returns `mmRetail`/`mmTrade`/`mmNew`/`mmEstimator`
- `regCheck(identifier, type)` → vehicle background check (chargeable per-call) — **bundle-gated**
- `accidentReport(vin)` → claims history, damaged areas, claim amounts (chargeable per-call) — **bundle-gated, new 2026-08-22**

**Pricing tiers:**
- **Free (flat-fee, unlimited):** `getStaticInfo`, `getModels`
- **Paid (bundle-gated, per-dealer):** `getValues`, `regCheck`, `accidentReport`

**Bundle gating behavior:**
- Paid buttons always visible — never hidden
- Bundles > 0: Normal active state, shows remaining count badge
- Bundles == 0: Glassmorphic "Unlock" state with lock icon + "Premium" badge — enticing, never disabled/gray
- Bundle storage: **ONE ledger, in Flow central only** — `truflow-premium/DATA_DIR/imagin8-bundles.json`, **keyed by dealership slug** (never `d.id`). `canonicalDealerSlug()` normalises admin ids, Flow token ids and Lens/Inspect slugs to the slug before any read/write; `getDealerImagin8Bundles` keeps a legacy read-fallback for pre-slug id-keyed entries. Lens and Inspect keep NO local ledger (2026-08-24; slug-keyed 2026-08-30)

**Transport:** All Imagin8 calls use **GET + query string params** (not POST body). Render/Cloudflare rejects non-empty JSON POST bodies.

**Chargeable-call architecture (2026-08-24) — Imagin8 API surface ONLY, nothing else moved:**
- Premium owns gating, credentials and deduction in one shared core (`runChargedImagin8Call`); sibling apps are thin proxies over `x-tru-sync-key`, failing CLOSED when Flow is unreachable
- Per-dealership Imagin8 customers: `imagin8ApiKey`/`imagin8CustomerId` stored per dealership record, owner-managed ONLY via `PUT /api/dealerships/:id` (TransUnion tab in DealershipAdmin); dealer self-route drops them; blank = platform account
- Demo tokens short-circuit locally in each app — a prospect never reaches the gateway; demo slugs get zeroed bundles, deduct nothing anywhere
- Top-ups are owner-only (`POST /api/imagin8/bundles` → 403 for non-admins everywhere)
- Tests: opt-in integration suites per app (`RUN_INTEGRATION=1 npm test`) spawn the real server against a mock Flow speaking verify-code + `/api/internal/imagin8/*`

**Server routes:**
- `GET /api/imagin8/static?mmCode=...` — all apps locally (free, platform key)
- `GET /api/imagin8/models?make=...` — all apps locally (free, platform key)
- `POST /api/imagin8/valuation` — all apps (paid, gated); Lens/Inspect proxy to Flow
- `POST /api/imagin8/regcheck` — Inspect + Premium (paid, gated); `GET /api/imagin8/regcheck?identifier=...&type=...` — Lens (paid, gated); Lens/Inspect proxy to Flow
- `GET /api/imagin8/accident-report?vin=...` — all apps (paid, gated); Lens/Inspect proxy to Flow
- `GET /api/imagin8/bundles` — read balance; unlimited dealers get `{zeros…, unlimited:true}`; Lens/Inspect read via Flow
- `POST /api/imagin8/bundles` — owner/admin top-up on Premium; 403 on Lens/Inspect
- `POST /api/internal/imagin8/{valuation,regcheck,accident-report}` + `GET /api/internal/imagin8/bundles` — Premium sync-key routes backing the proxies

**Setup-status routes (2026-08-23):**
- Premium: `GET /api/dealership/setup-status` + `PUT /api/dealership/setup-acknowledge` — derived live from the dealership record (`setupAcknowledgedAt`)
- Lens: `GET /api/setup/status` + `PUT /api/setup/acknowledge` — thin proxies to the Premium routes over `x-tru-sync-key`; ack is shared across apps via the Flow record
- Inspect: `GET/PUT /api/dealership/settings` + same setup-status/acknowledge pair — standalone persistence in `DATA_DIR/inspect-dealerships.json`

**Shared UI:** `packages/tru-ui-src/src/imagin8-gating.tsx` — `Imagin8GatedButton`, `useImagin8Gating`, `Imagin8Bundles`. Synced into each app's `src/components/imagin8-gating.tsx` at build time. ⚠️ Edit ONLY the shared source — app-local copies are clobbered by `sync:ui`.

### DeepSeek

- `DEEPSEEK_API_KEY` — AI listing copywriter, chat brain
- Optional — apps fall back to mock mode when unset

### TruSocial (Native 1-Click Multi-Channel Command Hub)

- **Status:** Active, 100% self-sufficient (Zernio retired 2026-09-09)
- Generates algorithmic-compliant 1-Click marketing packs across 6 channels: Facebook Marketplace (with 8-photo bundle), Facebook Page, Instagram, WhatsApp Status/Broadcast, LinkedIn, Google Business Profile.
- No external SaaS dependencies or OAuth token fragility.

### Bright Data Web Unlocker

- `BRIGHTDATA_API_KEY` + `BRIGHTDATA_UNLOCKER_ZONE`
- Unblocks Cars.co.za for scraper valuations

---

## 4. Recent Changes (2026-09-11)

### 💎 Apex Auto Investments Storefront & Widget System Polish (2026-09-11)

**Client:** Apex Auto Investments (Newton Park, Gqeberha / Port Elizabeth)
**Palette:** Dark mode first (`data-theme="dark"`), `#0D131C` dark anchor, `#B85B24` primary terracotta accent, `#E6762E` active glow accent.

**Key upgrades completed:**
1. **Header & Brand Alignment**:
   - Resized navbar logo (`trudealer-logo-3d.svg`) to prominent scale (220px desktop, 160px mobile).
   - Glassmorphic sticky navbar (`backdrop-filter: blur(16px)`) with top glowing terracotta border line (`#B85B24`).
2. **Standalone Widget Visual Polish (`packages/standalone/`)**:
   - `tru-repay.js`: Upgraded to dark obsidian glass, `@keyframes trFloatShine` continuous light glint sweeps on floating triggers and toggle handles, `@keyframes trPulse` pulsing aura rings on monthly repayment badges, quick deposit pills (0%, 10%, 20%), term pills (48m, 60m, 72m, 84m), and spring physics.
   - `tru-afford.js`: Sahara Dark obsidian styling, glint sweeps, pulsing aura rings, and robust inline mount safety check.
   - `tru-value.js`: Restyled in Sahara Dark palette, clean canonical script.
3. **Trade-In Appraisal Engine (`trade-in.html`)**:
   - Implemented full 3-step appraisal wizard matching `true-cars.co.za` flagship standard:
     - Step 1: Specs & 8 one-tap Make Chips (VW, Toyota, Ford, BMW, Mercedes, Hyundai, Nissan, Isuzu).
     - Step 2: Service History, Bodywork, Tyres, and Bank Settlement Status dropdowns.
     - Step 3: Dual Hero Valuation Cards (Market Retail vs Trade Soft Offer), Build-Up Deductions Table, Showroom Vehicle Equity Matcher (`<select id="selTargetCar">` connected to stock array `TRU.vehicles`), and pre-filled WhatsApp inspection booking CTAs.
4. **Vehicle Finance & Dynamic Repay Sync (`finance.html`)**:
   - Implemented flagship two-column VDP layout:
     - Left Column: 3D Vehicle Showcase Card (`fin-car-card`) with `<select id="carPicker">` stock dropdown, dynamic image, VIR 94/100 badge, stock ID, specs panel, and multi-bank credit partner tiles.
     - Right Column: Dynamic `tru-repay.js` mounting/syncing per vehicle selected, multi-bank pre-approval card, and 1-tap WhatsApp inquiry.

### 🌟 Mandatory Dealer Storefront Standard (2026-09-05)

**Directive:** Standardize all dealer showroom sites going forward on the 4-part conversion & discovery architecture:

1. **TruShare & Netlify Edge OG Unfurler**:
   - `tru-share.js`: Loaded on all pages, handles buyer sharing (WhatsApp, Facebook, clipboard, native sheet) and dealer posting mode (`?post=1`).
   - `netlify/edge-functions/vehicle-og.js`: Bound in `netlify.toml` (`/vehicle`, `/vehicle/*`, `/vehicle.html`). Reads query parameters from share links (`stock`, `year`, `make`, `name`, `variant`, `price`, `km`, `trans`, `fuel`, `body`, `img`) and rewrites `<title>`, `og:title`, `og:image` (declares `1200x630`), `og:description` (with `. ` period separator), and `application/ld+json` server-side for social crawlers (WhatsApp, Facebook, iMessage, Slack, Telegram).
   - **VDP URL Parameter Hydration**: `vdp-page.js` parses `TRU.params()` query parameters as a direct fallback when a car is opened via a share link before or outside the standard live DMS stock array, rendering the exact shared car immediately with no mismatch.

2. **AEO & LLM Search Engine Optimization**:
   - `robots.txt`: Explicitly permits all primary AI search crawlers (`GPTBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `meta-externalagent`) with `Sitemap` reference.
   - `llms.txt`: Standard LLM discovery context document containing dealer overview, physical location, tech stack (TruInspect, TruRepay, TruAfford, TruValue, TruShare), VIR inspection scoring, and contact endpoints.
   - **Schema.org Structured Data**: Valid `AutoDealer` schema on `index.html` & `stock.html`, and dynamic `Car` + `Offer` schema on `vehicle.html` updated on vehicle hydration.

3. **WhatsApp 1-Tap Qualified Lead CTAs**:
   - All vehicle WhatsApp triggers (sidebar CTA, sticky top deal bar, mobile bottom bar) generate rich pre-filled customer lead inquiries:
     `Hi [Dealer]! I'm interested in this [Year Make Model Variant] (Stock #[Stock]) listed at [Price]. Link: [URL] Is it still available?`

4. **Scoped Spring-Physics Motion**:
   - `transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow ...` on `.card:hover` and `.tile:hover`. All styling strictly component-scoped within `showroom.css`. Monolithic external bulk CSS files are strictly forbidden.

### 🚀 PRODUCT ROADMAP: Multi-vertical DMS beyond cars (2026-09-03)


**Owner directive:** TruDealer should NOT be limited to car dealerships. The TransUnion M&M catalogue (`TruLens/public/catalogue/`) already covers motorcycles (Harley Davidson, Ducati, KTM, Kawasaki, Honda, Yamaha, etc.), boats/jetski (SPECIALTY), caravans (SPECIALTY), trailers, generators, yellow metal/construction equipment, golf carts, bicycles, and tractors/agriculture (John Deere, Massey Ferguson, New Holland).

**Status & Action items:**
- [x] **TruDealer Moto** — Motorcycle sales DMS (Completed 2026-09-03). Full substrate across 4 apps (TruLens, TruInspect, TruFlow Premium, TruFlow Mobile) + 8 standalone widgets (`packages/standalone/`).
- [ ] **TruDealer Marine** — Boat & jetski sales DMS (catalogue data already exists in SPECIALTY section)
- [ ] **TruDealer Trucks** — Commercial vehicle & trucking DMS (catalogue has truck makes + YELLOW METAL)
- [ ] **TruDealer Caravans** — Caravan & trailer sales DMS (catalogue has CARAVAN + TRAILER categories)

**Why:** Each of these is the same TruFlow DMS with a vertical-specific skin, default catalogue filters, and tailored reporting. The data layer (valuations, TransUnion lookups, Imagin8 checks) works identically — the M&M code is the universal key.

**Implementation details (TruDealer Moto):**
- **Substrate:** `packages/tru-ui-src/src/vertical.ts` (`VERTICALS`, `verticalById`, `MOTO_MAKES`, `isMotoMake`) + `VerticalContext.tsx` (`useVertical`). Synced via `sync:ui` to Lens and Inspect; copied to Premium.
- **Resolution hierarchy:** Dealership record (`d.vertical`) → Server environment (`VERTICAL` env var, default `cars`) → App fallback (`cars`). 100% backward-compatible.
- **TruLens:** 14 motorcycle studio slots (`moto-v1`: Front 3/4 L/R, Profiles, Cockpit, Odo, Fuel Tank, Engine L/R, Exhaust, Chain/Sprocket, Tail, VIN plate). No camera overlays (as per directive).
- **TruInspect:** `moto-v1` template with motorcycle phases (Frame & Controls, Engine & Powertrain, Wheels & Suspension, Electrical, Cosmetics & Exhaust, Final Road Test) and 2-tyre trade-in checklist.
- **TruFlow Premium:** `vertical` in `Dealership` model, server state/settings API, and `DealershipAdmin` / `DealerDetailsSettings` vertical selector.
- **TruFlow Mobile:** Dynamic vertical resolution from state profile, motorcycle share blurbs and `vert=moto` share query param.
- **Standalone Widgets (`packages/standalone/`):** `tru-loader` (auto-propagates `data-vertical`), `tru-book` ("Book a demo ride"), `tru-value` ("What's my bike worth?", motorcycle makes/models placeholders), `tru-afford`, `tru-repay`, `tru-form`, `tru-share`.

### UK-first market expansion — market spine, all four apps, widgets (2026-08-31)

**Program:** UK first, US as Phase 6. Locked decisions: separate regional deployments of ONE codebase (MARKET env per instance, Frankfurt region, fresh region-bound disks, `uk.*` subdomains); NO paid data providers at v1 (free scraper + VIN decode later; Imagin8/TU stays SA-only); full Premium desktop pass in-program; WP plugin EXCLUDED (retired one-off).

**Valuation spine (packages/market-scraper is now the production path for non-ZA markets):**
- Engine fixes: currency-safe depreciation slope (relative to median price, was ZAR-absolute), miles normalisation (JSON-LD `unitCode` SMI, card odometer regex, market `distanceUnit` for unit-less feeds), bare 4-7 digit price regex (ungrouped £/$ amounts), `ValuationResult.currency` + `distanceUnit` to clients, dealer layer market-scoped via `priceSourcesPath` (SA dealers can never poison a £/$ pool).
- `markets/uk.ts` rebuilt around **cinch.co.uk** — verified live: server-rendered Next.js over PLAIN HTTP, listings in `__NEXT_DATA__` with price/miles/year. AutoTrader UK parked (Cloudflare + SPA shell, needs Unlocker gb egress); Parkers dropped (404s).
- **Kill-switch doctrine:** every app's `/api/valuation` takes `VALUATION_ENGINE=legacy|package` (default `legacy` = the in-tree SA fork, SA production byte-identical). SA instances stay on legacy until explicitly flipped. Premium's `/api/public/trade-estimate` forces the package engine for any non-ZA market regardless of the switch. Premium's trade-report renderer + saved reports carry currency/distanceUnit (old reports fall back ZAR/km).
- ⚠️ The 2026-08-25 "apps keep their own scraper copies, package is standalone" doctrine is hereby AMENDED: the package is the live engine for every non-ZA market; the in-tree forks survive only as the SA legacy default pending the parity cutover.

**Market substrate:**
- `packages/tru-ui-src/src/market.ts` — shared display module (`formatMoney`, `formatMoneyFromData`, `formatDistance`, `toKm`, `marketById`, `MARKETS` za/uk/us), synced into Lens/Inspect via `sync:ui`. **Premium copies it manually — Premium does NOT run sync:ui (its ErrorBoundary diverged from the shared source).**
- Instance market: `MARKET` env (default za) → `GET /api/dealership/settings` returns `market` in all three servers (same endpoint name); Premium also rides it on `/api/state` and supports a per-dealership `market` override field (Dealership type).
- Client: `MarketContext` + `useMoney()`/`useMarket()` in Inspect/Lens (fetch settings, AuthContext-based) and Premium (authFetch twin); ZA fallback everywhere so nothing breaks when the fetch fails.

**App conversions (all committed):**
- TruInspect: every dealer-owned price/date/distance (desktop shell+dashboard, vehicle manager incl. offers, inventory, VIR report, trade-in walkaround/valuation/summary with cents-aware printed docs); TU lines stay ZAR (SA provider by definition).
- TruLens: Live Market Value card (response currency + distance labels), stock cards/totals, shoot report, WhatsApp blurb takes market; dead ZAR/USD/GBP selector removed.
- TruFlow Premium desktop: App.tsx dashboards + EOD report/CSV, LeadDetailModal (finance cards, tax-invoice + consideration docs keep cents, SMS template), VehicleDetailModal (market value card, share caption, offer/settlement doc with currency name, WhatsApp blurb passes market), AccountingRecon/AgreementPreview/AmortizationCalc/InvoicePreview/BulkImport/WebManagementGrid (miles on gallery grid)/DocHubPanel/salesShare/dmsReadiness.
- TruFlow Mobile: MARKET globals from /api/state (+per-dealership override), money/dist/odo helpers, all price+distance surfaces, static labels patched when market resolves, CHAT_API localStorage override, sw `tfm-2026-08-31a`.
- **Share contract lockstep:** tru-share (`data-currency`, `data-distance-unit`), mobile `shareVehicle`, and the vehicle-og edge-function reference (`case-sites/cars-at-caledon/netlify/edge-functions/vehicle-og.js`) all speak `cur` + `odu` URL params — added ONLY when non-default, so SA links stay byte-identical and old readers ignore them. Edge function maps to symbol/ISO currency/schema unitCode KMT|SMI.
- Widgets: tru-value (`data-market` → request param + response-driven money/miles), tru-afford (market preset table za/uk/us: currency, slider scales, bands, price cap; FSP→lender), tru-repay (data-market/data-locale grouping; UK/US fees default 0 unless explicitly set), tru-form (neutral placeholders), tru-loader (hardcoded true-cars chat config deleted — chat needs `data-chat-config` now). tru-book untouched (already neutral). tru-afford also carries the previously-uncommitted inline-mount feature (data-mount); tru-form carries data-surface.

**Deploy:** render.yaml §8 = UK stack — `trusaas-lens-uk`, `trusaas-inspect-uk`, `trusaas-premium-uk`, `trusaas-mobile-uk`, `trusaas-chat-uk`, all `region: frankfurt`, `MARKET=uk`, `VALUATION_ENGINE=package`, fresh `-uk` disks, own sync keys (dashboard), NO IMAGIN8_*/ZERNIO_* on UK. Inter-service URLs use onrender hosts until `uk.*.tru-saas.com` domains are set.

**Open items for UK pilot:**
- [ ] TU/Imagin8 buttons must be MARKET-GATED in the UI (hidden where no provider) before UK pilot traffic — currently they render and would error on UK instances.
- [ ] UK browser verification of the full arc (demo login → add vehicle → valuation → printed report).
- [ ] DVLA vehicle-enquiry wiring as UK spec auto-fill (US: NHTSA vPIC) — Phase 6b.
- [ ] Lens `LENS_DEFAULT_DEALER_SLUG` mkr-autosales default + SA dealer seed must not ride UK instances.
- [ ] Legal: UK GDPR privacy policy; FCA wording review for finance widgets; US TCPA memo deferred to Phase 6.
- [ ] Premium `/api/state` unscoped-dealerships leak (GDPR review item, pre-existing).

### Imagin8 ledger keyed by slug + flow-lite retired + tasks/dropdown fixes (2026-08-30)

**Imagin8 bundles are now keyed by dealership slug** — the slug has always been the suite identity ("Flow is the source of truth, keyed by dealerslug"), but the ledger was being written under the dealership `d.id` by the master admin while Lens/Inspect proxies read it by slug. Two keys for one dealer: admin top-ups never unlocked the buttons in the prescribed apps. Fix (`truflow-premium/server.ts`):
- `canonicalDealerSlug()` + `findDealerByKey()` normalise every caller's identifier (admin `d.id`, Flow token `d.id`, Lens/Inspect `slug`) to the slug before any bundle read/write.
- `runChargedImagin8Call` resolves to slug at the top; `dealerImagin8Key`/`dealerImagin8CustomerId` match id OR slug.
- `getDealerImagin8Bundles` keeps a legacy read-fallback for pre-slug `d.id`-keyed entries so nothing purchased is silently zeroed; writes always land under the slug.

**TruFlow Light (`flow-lite`) retired** — never a product; "if you have Premium you have Mobile". Removed from `PRODUCTS` (`server.ts`), the sidebar "TruFlow Mobile" pill (`App.tsx`), the Apps toggle + info block (`DealershipAdmin.tsx`), and the `data.json` seed. Mobile auth keys off `"flow"` first (`truflow-mobile` `DMS_CONNECTED`), so premium→mobile is unaffected.

**Tasks screen now renders lead to-dos** — the sidebar pill counted overdue tasks + overdue lead next-actions, but the Tasks screen only listed manual tasks, so a dealer with leads to chase saw a number and an empty screen. Added a "Lead follow-ups" card (`App.tsx`) listing new leads ("First contact owed") + open leads with a next step due today/overdue, each with a Review button.

**VehiclePicker dropdown no longer closes mid-scroll** — the fixed-position menu closed on any window `scroll` (capture phase), which included its OWN options list, so a long model/variant list exited before you reached the bottom. The scroll-close now ignores scroll events originating inside the dropdown (`VehiclePicker.tsx`).

### Standalone market-scraper package (2026-08-25)

A market-agnostic valuation engine lives in **`packages/market-scraper/`** — but it is STANDALONE, for other markets (US/UK/housing and future verticals). The three apps (TruLens, truinspect, truflow-premium) keep their OWN in-tree `src/lib/scraper.ts` + `makeAliases.ts` copies (South Africa) and do NOT depend on this package. Note: the package's engine was lifted from the Premium SA scraper, so the logic is identical, but the app copies and the package are now independent.
- `engine.ts` — the full market-agnostic pipeline (dealer stock → classifieds → headless worker → Bright Data Unlocker → SERP). Market-dependent bits (currency symbol, country code, Google domain, price bounds, classifieds sources, title matcher) come from a `MarketConfig`.
- `markets/{sa,us,uk,housing}.ts` — concrete configs. SA is the default.
- `index.ts` — `fetchValuation(make, model, year, opts, market?)` (+ `markets` export).
- `hooks`: the package has its own `package.json` (axios, cheerio) + `node_modules` (`npm install --prefix packages/market-scraper` after a fresh clone). Build uses `--packages=external`, so axios/cheerio resolve from its own node_modules at runtime.
- `scripts/test-markets.ts` — smoke-test harness (run per-market via esbuild + node).

**Caveats for other markets:** the US/UK `classifieds` URLs + CSS selectors are best-effort and should be retuned against live markup; both sites (Autotrader.com/Cars.com, AutoTrader.co.uk/Parkers) **403 plain HTTP**, so they need the Bright Data Unlocker/worker to return data. Housing (`housingZa`) is verified working — Private Property + Property24 both load at `/for-sale` and return real ZAR prices on plain HTTP.

### TruRadar — standalone vehicle sourcing radar (2026-08-28, packages/tru-arbitrage)

`packages/tru-arbitrage` (package `@trusaas/tru-radar`, dashboard brand **TruRadar**) is a STANDALONE buy-radar SaaS — NOT part of the dealer DMS stack. One job: surface confidence-gated underpriced/distress vehicle deals from SA classifieds (Cars.co.za, AutoTrader) + dealer sites (SERP), priced against live market comps. **No My Stock tab in the product** — the dealer's own stock is Flow's domain (Flow's Overview carries the "Stock needing action" panel: stale ≥40d and/or 10%+ over the dealer's `truPrice` benchmark, one-click reprice).

- **Auth**: own JWT layer (`src/auth/`), dealer registry `DATA_DIR/dealers.json` (sha256-hashed access codes), `POST /api/auth/login` `{dealerSlug, accessCode}`, demo tokens per-uid. **Per-dealer isolation**: every store key is `${dealerSlug}:${id}` (`src/storage/db.ts`).
- **Confidence layer (the moat)**: `src/engine/confidence.ts` scores valuations (sample size + price-band tightness, cap 0.95); alerts below `CONFIDENCE_FLOOR` (0.6) never fire. **DECOUPLED from Flow (2026-09-05)**: the chargeable TU backstop via Flow's `POST /api/internal/imagin8/valuation` is now **inert unless `RADAR_TU_BACKSTOP=1`** (Dashboard env). Flow has its own built-in price checker; the radar is self-sufficient via its own scraper + the **free local TU catalogue** (`tu-matcher.ts`, read-only fallback when comps are thin). Owner directive: keep the shaky radar off Flow's credits.
- **Gates**: buy gate `evaluateArbitrageOpportunity` (underpriced/distress/price-drop); dormant own-stock gate `evaluateOverpricedStock` (AND: over-market AND stale) for the future Flow bolt-on — `flow_stock` ListingSource + `/api/mystock/scan` stay alive for it but are not in the UI.
- **Dynamic recon**: `calculateReconBuffer` = clamp(3% × marketRetail, R5k floor, R30k cap) — no flat recon. `MIN_ARBITRAGE_MARGIN=10000`.
- **Retired**: FB Marketplace lane (`brightdata.ts`, `mock-payloads.ts`, WhatsApp alerts) — webhook-only dispatch via `src/alerts/` (`formatDealAlertText`, `formatSellerOfferTemplate`).
- **Flow integration removed**: The TruRadar tab in DealershipAdmin has been deleted. The radar is fully standalone — its own scraper + local TU catalogue. Flow has its own built-in price checker; the radar's TU backstop is off by default.
- **Deploy**: Render service `trusaas-arbitrage` (render.yaml §7) — `JWT_SECRET` + `TRUFLOW_SYNC_KEY` must be set in the dashboard (tokens forgeable without JWT_SECRET). Domain radar.tru-saas.com planned.
- **Tests**: `npm test` (17 suites, no network). Browser-verified live: real scan surfaced 3 deals / R193k identified; dashboard login/demo/claim/session-persist all pass.

### TruRadar scraper overhaul — year filter, per-host circuits, targeted scan (2026-09-05, packages/tru-arbitrage)

Owner-reported: "find deals sometimes shows nothing of a make that clearly has hundreds for sale, while find cheapest always finds it." Root causes (verified against the live sites):

- **Year filter was 100% dead on AutoTrader.** Tiles concatenate fields (`"Fair Price2025 Toyota"`) so `\b(19|20)\d{2}\b` matched 0/800 cards and every comp accepted any year → wide IQR → confidence under the 0.6 floor → deals suppressed. Fix: `src/engine/year.ts` (`findCardYear`/`yearInBand`) uses digit boundaries + make-anchored matching, recovers 31/32 cards, **rejects** unreadable years. Same `\b` bug fixed in `regex-fastpath.ts` `parseYear`.
- **`adjustForYearGap` was dead code** (unit-tested since 2026-09-04 but never wired) — now called before `adjustForMileage`. `adjustForMileage` also preserves `year`.
- **Scan had no targeting.** It sampled the newest ~32 cars posted nationally (`sort=Date_Descending` page 1); `allowedMakes` had no UI field and only filtered alerts. Fix: **Watch targets** — Buy Box modal now has a `watchTargets` field (`"Toyota"` / `"Toyota/Hilux"`), persisted on `DealerBuyBox`, driving a new targeted lane (`src/ingestion/targets.ts`) that queries AutoTrader cheapest-first + paginated. Verified live: 62 GWM listings from 2 pages.
- **209 of 312 makes invisible to the normalizer** (hand alias table). `detectMakeAndModel` now falls through to the local TU catalogue (312 makes), so GWM/Changan/Omoda/Jaecoo/SsangYong/Datsun/BYD/JMC/JAC normalize. Targeted listings also carry typed `year/make/model/mileage` that `normalizeViaRegex` prefers over title parsing.
- **Per-host circuit breakers** (was per-tier): cars.co.za's by-design 403 no longer opens the `direct` tier for AutoTrader (a 384ms working path). HTML fetch rewritten (`fetch-html.ts`): single-flight + 10-min cached HTML (cap 500) + 8-way concurrency cap + 2 retries with backoff. `cacheStats()` on `/api/health`.
- **Waste cut ~75%**: AutoTrader ignores `year=` (5 band URLs = 5 copies of the same page) → one URL/page, local year filtering; Gumtree (0 tiles, ~4.5s) off unless `SCRAPER_GUMTREE=1`; `SCRAPER_CLASSIFIEDS_PAGES` default 3; `CONCURRENCY` 5→3. Four extractors merged with dedupe (was `reduce(max)` winner-takes-all); `css-selector` comps kept last (no km/link).
- **Config parity with Lens/Inspect**: `SCRAPER_UNLOCKER_ENABLED` accepts `1|true|yes` (was strict `'1'`); `BRIGHTDATA_API_KEY` falls back to `SERP_API_KEY`; code zone default `unlocker` (was `tds2`). Note: the radar's REAL zone is `auto` (confirmed in the BrightData dashboard + render.yaml `value: auto`) — do not "fix" it to match the sibling default.
- **Funnel instrumentation**: `IngestionBatchResult` now carries `rawBySource`, `droppedNormalizer/MakeUnknown/DamagedWanted/NoComps/BelowConfidence/BelowMargin` + `sourceHealth`. A zero-deal scan is diagnosable, not a black box.
- **New tests**: suites 16–18 (concatenated-year recovery incl. the 0/800 regression, full-catalogue make detection + boundary guards, targeted parser). 21 suites pass; live smoke verified GWM P-Series 2025 → 21 comps, confidence 0.85.

Config notes: `SCRAPER_GUMTREE` (off by default), `SCRAPER_CLASSIFIEDS_PAGES` (default 3), `SCRAPER_UNLOCKER_ENABLED` gate now regex, `BRIGHTDATA_UNLOCKER_ZONE` default `unlocker`. New files: `src/engine/year.ts`, `src/ingestion/targets.ts`.

### TruRadar vertical catalogue — 7-category cascade + year-band scraping (2026-09-04, packages/tru-arbitrage)

TruRadar's price-check went from a flat make→model→freeform-year to a **Category → Make → Model → Variant → Year** cascade backed by the local classified TransUnion dump (27,503 variants / 312 makes).

- **Classifier (`src/engine/catalogue.ts`, new)**: per-VARIANT, deterministic, precedence-ordered → 7 buckets: cars/bakkies (S/D, H/B, SUV, S/W, D/C, S/C…), moto (bodies R/D/O/F/S/S/3W/4W/6W/ATV + axles 1X1/2X1 + `MULTIPLE MOTORCYCLE MANUFACTURERS`), trucks (make list Scania/Iveco/Hino/Tata/Foton… + bodies C/C/T/T/B/S/D/S/P/V… + axles 6X4/8X4/6X6…), marine (`BOAT/JETSKI`), caravans (`CARAVAN`/`TRAILER`/R/V), agri (make list John Deere/Kubota/Caterpillar/Case IH… — REQUIRED, agri rows carry blank body+axle), specialty (`SPECIALTY` pseudo-make + G/E/G/C/B/C). Mixed makes split at variant level — BMW yields both car and moto models.
- **Server**: `GET /api/lookup/{categories,makes,models,variants}` (+category filter) all from the local file — zero per-keystroke API cost. `GET /api/lookup/cheapest` gains `category`, `variant`, `mmCode`; `resolveVariant` recovers an mmCode from text, and the classifieds URLs become version-specific instead of "Golf" guesses.
- **Year-band scraping (`src/engine/{valuation,mileage}.ts`)**: classifieds SERPs now query `year-1 / year / year+1` (`SCRAPER_YEAR_TOLERANCE`, default 1 — dealer habit) so a thin exact-year page can't starve the sample. `ValuationComp` carries `year`; `adjustForYearGap` age-corrects band comps to the subject year (0.88/yr, clamped 0.7–1.4). Source counts dedupe so the results match `listingsFound`. **Price check and the scan valuation share `gatherComps`, so both got the band.**
- **Refresh pipeline (`scripts/refresh-catalogue.ts`, `npm run catalogue:refresh`)**: Imagin8 `getModels` per make (flat-fee retainer) joins by mmCode → **`data/tu-years.json`** with real intro/discon year ranges. Server never calls Imagin8 at request time — reads the overlay only. Local run verified: 311/312 makes, 28,062 mmCodes (MCCORMICK returned 0 live rows — consolidated make, excluded). ⚠️ **`.gitignore` excludes `data/*.json`** — tu-variants/tu-kilometers are in git via force-add only; a `tu-years.json` refresh must be added with `git add -f`, or prod deploys without real year ranges. Env: `IMAGIN8_API_KEY`/`IMAGIN8_CUSTOMER_ID`/`IMAGIN8_APP_NAME` on the arbitrage Render service (sync: false).

### Inspector e-sign on all three reports (2026-08-24)

All three dealer-facing reports now carry a drawn signature:
- **TruInspect VIR** — inspector signs off the grading (`inspectorSignatureUrl` on `Vehicle`).
- **TruInspect Trade-in appraisal** — already had the pad (`dealerDetails.digitalSignatureUrl`); no change.
- **TruLens shoot report** — photographer signs off the session (`capturedBySignatureUrl` on `Vehicle`).

**Shared `SignaturePad` component** in `packages/tru-ui-src/src/signature-pad.tsx` (syncs into each app's `src/components/` via `sync:ui`). Lifted out of `TradeInSummary` so all three reports use the same control: white pad, dark ink, `Clear` to start over, emits a PNG data URL on stroke end.

**Printed output** in both `ReportPreview.tsx` files: when a signature exists, the printed report renders the image inline (max 48px tall) on the signature line; when it doesn't, it falls back to the typed name so a report never ships with a blank line when the inspector has signed.

**Data model**: Inspect `types.ts` adds `inspectorSignatureUrl?: string` next to `inspectorName`/`inspectorRole`. Lens `types.ts` adds `capturedBySignatureUrl?: string` next to `capturedBy`. Both travel with the vehicle through the existing update endpoints — no server-side changes.

### Add Vehicle: TransUnion price + live market value + no silent no-ops (2026-08-24)

**TruInspect `AddVehicleDialog.tsx`** — the form now carries all four pricing/verification/background buttons in a 2×2 grid, and every click shows feedback:
- **TransUnion price** (gated, `valuation` slot) — needs an M&M code in production (the live API only prices off a real code); in demo the simulated responder accepts any seed, so the client synthesises `DEMO-<make>-<model>-<year>` from the form itself.
- **Get market value · Free** (plain cyan, no gating) — hits the live Bright Data scraper, identical in production and demo. "Use as price" fills the price field.
- **Verify Registration** + **Accident Report** (gated) — no longer silent-return when no VIN/stock is typed. Production shows an inline "enter a VIN first" hint; demo synthesises an identifier from the form and returns the generic simulated statement.

**TruLens `InventoryList.tsx` Add Vehicle** — market value already existed; added the TransUnion Price button (col-span-2 above the reg/accident pair) with the same synthetic-id demo behaviour and the same inline-hint-in-production fix on the two dead guards.

**TruLens `App.tsx` demo routing** — demo no longer lands on `DealerSelect`. The picker still serves legacy shared-code logins (no slug from server → app must ask), but `isDemo` bypasses the route and skips the `/api/dealerships` warm-fetch so a prospect never caches our real client list.

### Demo Imagin8 unlocked — simulated TU calls, 5-of-each per session (2026-08-24)

Owner call: demo mode must show the FULL Imagin8 experience so a prospect can run a valuation, reg check and accident report before the upsell wall. Chose **simulated** data (free, can't be gamed, safe on live instances) with a **5-of-each** bundle budget so the "credits running out → Unlock (Premium)" moment is still part of the demo arc.

**Doctrine change:** demo tokens no longer 402 with zeroed bundles. They short-circuit locally to a deterministic, simulated TransUnion response (same input → same output, so the demo is stable) seeded from the request params. Demo never reaches the gateway, never touches anyone's real credits, and never calls the chargeable API. This is a deliberate reversal of the "demo = zero/402" behaviour in the centralization change (c0829fc).

**Scope discipline — only the chargeable Imagin8 surface:** the simulated responder applies to `/api/imagin8/{valuation,regcheck,accident-report}` ONLY. The free market-value scraper (`POST /api/valuation` → Bright Data over AutoTrader/Cars.co.za) stays **LIVE and real in demo** — it is flat-free, has no bundle/gating, and never reads `req.user.demo`. Do not extend the demo simulation there; a demo prospect must see real current listing prices on that one. The distinction: TransUnion = chargeable per-call (simulated for demo), market value = free (always live).

**Shared (`packages/imagin8.ts`):**
- `DEMO_IMAGIN8_ALLOWANCE = { valuation: 5, regCheck: 5, accidentReport: 5 }`
- Deterministic `simulatedValuation(mmCode, year, mileage)` / `simulatedRegCheck(identifier, type)` / `simulatedAccidentReport(vin)` returning the SAME normalized shapes (`TuValuation` / `RegCheckResult` / `AccidentReportResult`) the servers already hand the UI — so no frontend change needed. Seeded via FNV-1a hash; regCheck mostly clean with ~32% finance-pending + common microdot; accidentReport ~35% of VINs show 1–2 claims.
- ⚠️ **Feature-key gotcha:** the route feature strings are `valuation|regcheck|accident-report` but the `Imagin8Bundles` ledger/UI keys are `valuation|regCheck|accidentReport`. Each server maps via `DEMO_FEATURE_SLOT`. **Do not index a bundle map with the hyphenated route string** — it silently never decrements (and was a pre-existing 402-always bug in Premium, fixed here).

**Servers (all 3):**
- Per-session budget tracked in-memory: Lens/Inspect key on `req.user.uid` (`demo-<hex>`, per-browser); Premium keys on a `sid` nonce added to the demo token (Premium demos share one tenant, so `sid` gives each login its own budget).
- Chargeable routes check `req.user.demo`/`isImagin8DemoSlug` → if budget left, return simulated result + `bundlesRemaining` (decremented) + `demo: true`; if spent, 402 `{demoUsedUp}`. `/api/imagin8/bundles` returns the leftover allowance for demo.
- Premium `runChargedImagin8Call(dealershipId, feature, params, demoSessionId?)` gained a demo branch; the dealer-facing routes were corrected from `req.user?.dealershipId` (never set — always "default") to `req.auth?.dealershipId`. Fixed the pre-existing `bundles[feature]` vs camelCase-slot mismatch so real dealers' regCheck/accidentReport gate/deduct correctly.

**Demo entry-point parity (2026-08-24):** TruFlow Premium's `LoginSplash` had its "Try demo (24h)" button removed earlier (a dealer signing into their own DMS shouldn't be offered sample data); demo was only reachable via `?demo=1`. Restored the button, matching Lens/Inspect — a prospect who reaches Flow's login has nowhere else to try the full DMS. The `?demo=1` deep link still works.

**Tests updated (opt-in, `RUN_INTEGRATION=1`):** Inspect + Lens demo assertions moved from `402`/`valuation 0` to `200` (simulated), allowance `5`, `demo: true`, and `bundlesRemaining` decrementing; the "never reaches the gateway / untouched yard bucket" proof still holds. Verified: Inspect 12/12, Lens 12/12, Premium 75/75.

Files changed: `packages/imagin8.ts`, `truinspect/server.ts`, `TruLens/server.ts`, `truflow-premium/server.ts`, `truflow-premium/src/components/LoginSplash.tsx`, `truinspect/tests/server.test.mjs`, `TruLens/tests/server.test.mjs`.

### Imagin8 Chargeable-Call Centralization — Flow holds THE ledger (2026-08-24, `c0829fc`)

Scope discipline (owner-set): **only the Imagin8 API surface moved.** No slug routes, auth, verify-code, setup-status bridges or any other operation changed — verified by hunk-level diff review; every changed hunk in both sibling servers sits inside its Imagin8 block.

**TruFlow Premium** — single authority:
- `runChargedImagin8Call(dealershipId, feature, params)` — one core for valuation/regcheck/accident-report: config check → demo/unlimited/zero-bundle gating → real TU call → deduct on success. Both dealer-facing JWT routes and internal sync-key routes funnel through it.
- Per-dealership Imagin8 customers (Model 2): `imagin8ApiKey` + `imagin8CustomerId` on the dealership record, owner-managed ONLY via `PUT /api/dealerships/:id` — new TransUnion tab in DealershipAdmin (`Imagin8CustomerSettings.tsx`). Dealer self-route whitelists them out. Blank = platform account.
- Demo slugs (`demo`, `demo-*`): zeroed bundles, never reach the real API, never deduct. `true-cars` stays unlimited (`{zeros…, unlimited:true}` — no sentinel numbers).
- Top-ups owner-only: `POST /api/imagin8/bundles` → 403 "Top-ups are managed by TruSaaS" for non-admins.
- New sync-key internals backing the proxies: `POST /api/internal/imagin8/{valuation,regcheck,accident-report}`, `GET /api/internal/imagin8/bundles?dealershipId=…`.
- One rider from the prior session, disclosed and kept: `PUT /api/dealerships/:id` no longer lets a blank string wipe `location`.

**TruLens + TruInspect** — thin proxies (-136/-102 lines each):
- Local ledgers and credential stores DELETED. Chargeable calls relay to Flow's internal routes over `x-tru-sync-key`; Flow unreachable → fail CLOSED (502 / zeroed bundles), never a free paid call.
- Demo tokens short-circuit locally with 402 + zeros — prospects never touch the gateway.
- Free flat-fee endpoints (static info, model catalogue) still run locally on the platform key.

**Tests** — opt-in integration suites, new in Lens + Inspect (`npm test`; spawn gate: `RUN_INTEGRATION=1`):
- Each suite spawns the REAL app server (throwaway DATA_DIR, ephemeral port) against a mock Flow speaking verify-code + the internal Imagin8 contract, including deduction so the relay is provable end-to-end.
- Inspect mock holds the ledger itself (Flow's job now); covers demo isolation, relay-and-deduct, unlimited owner yard.
- ⚠️ node:test runs multiple root `before()` hooks CONCURRENTLY — Lens originally split boot and token-mint across two hooks and raced its own server boot (deterministic ECONNREFUSED). Fixed: mint inside the boot hook. Don't split boot-dependent setup across root hooks.

Verified: all 3 apps typecheck clean; Premium 75/75; Lens 12/12 and Inspect 12/12 integration (RUN_INTEGRATION=1), clean skip paths without it.

### First-run Dealership Setup Checklist + Guide Refresh — all 3 apps (2026-08-23)

Three changesets, one feature family. Dealers are now prompted to finish dealership setup when they enter an app, and the in-app guides were refreshed to cover the recent Imagin8/verification features.

**Architecture decision (owner-set):** "what lives in Lens lives in Flow and vice versa; Inspect standalone." So:

- **TruFlow Premium** owns THE dealership record — its setup-status is derived live from `data.json` dealerships.
- **TruLens** has NO local record: its server **proxies** to Flow central (`x-tru-sync-key`, same pattern as code verification). Setup ack is shared across apps via the Flow record — dismiss once, dismissed everywhere.
- **TruInspect** is standalone: persists its own per-slug record in `DATA_DIR/inspect-dealerships.json` (buyers.json pattern).
- **Imagin8 keys are NEVER dealer-entered** — platform env vars only. The dead "Imagin8 API Key" input was removed from Premium's DealerDetailsSettings and replaced with a passive info chip ("TransUnion features enabled by TruSaaS").

#### TruFlow Premium (`9a5bc81`)

- Server: `GET /api/dealership/setup-status` (completeness DERIVED live from the dealership record, never stored) + `PUT /api/dealership/setup-acknowledge` (stamps `setupAcknowledgedAt`). Required items: name/tradingAs, contactEmail, address; recommended: doc logo, banking details, sale terms. Demo accounts and admin-without-scope → `skipPrompt`.
- Frontend: new `src/lib/setupStatus.ts` + `src/components/SetupPrompt.tsx`. Modal fires once per account until acknowledged (server-side → cross-device); quiet dashboard card keeps nagging ONLY about required gaps (7-day per-device snooze). Salespeople never fetch or see any of it.
- Modal takes precedence over the first-run guide auto-open (`App.tsx` ~336 effect now waits on setupStatus); guide opens next session instead of stacking two overlays.
- Guides: +4 (TU verification buttons, free market-value scraper, Premium credits explained, buyer AVS/DocHub).
- Fixed pre-existing nav test failure: re-added `media_web` ("Stock media") to groupedNavigation + role lists — it had been orphaned since the `web_management` rename (commit 3181857) while still being the only home of gallery-readiness counters, TruLens hand-off and public feed link. Tests back to 75/75.

#### TruLens (`501bb47`)

- Server bridge routes: `GET /api/setup/status` + `PUT /api/setup/acknowledge` proxy to Flow's dealership endpoints over the sync key. Demo tokens and slugless legacy shared-code tokens skip LOCALLY (client `isDemo` is unreliable after refresh). Flow unreachable → graceful `skipPrompt`; capture work is never blocked by a nudge.
- Imagin8 parity fixes:
  - `POST /api/imagin8/valuation` NOW bundle-gated like regcheck/accident-report (was wide open) — 402 at zero, deduct on success.
  - New `resolveDealerId()`: demo→own uid · token `dealerSlug` → slug · explicit dealerId → as passed · else `'default'`. Bundle routes previously ALWAYS hit `'default'`.
  - `getDealerBundles` keeps a legacy `'default'` READ-fallback so pre-existing allocations survive; first deduction migrates forward per slug.
  - `true-cars` unlimited actually engages now (it used to check `'default'` and miss).
- Frontend: ported `lib/setupStatus.ts` + `SetupPrompt.tsx`; modal beside GuidePanel mount, card on Dashboard tab. CTA deep-links premium.tru-saas.com (identity edited once, in Flow).
- Guides: +2 (TU checks in Add Vehicle, licence-disc scan).

#### TruInspect (`d653dfe`) — standalone persistence

- Server: `inspect-dealerships.json` keyed by slug stores name, branch, phone, email, whatsapp, vatNumber, registrationNumber, address, tradeInTcs, `setupAcknowledgedAt`. Routes: `GET/PUT /api/dealership/settings`, `GET /api/dealership/setup-status` (required: name/email/address; optional: VAT-reg, trade-in T&Cs), `PUT /api/dealership/setup-acknowledge`. Demo & slugless tokens skip everywhere. Bundles GET returns `{zeros…, unlimited:true}` instead of 9999s.
- DesktopSettings cross-device sync: localStorage keys (`trulens_dealer_*`) UNTOUCHED as the offline cache every report reads; server record merges in on load (server wins where it has a value); debounced write-back gated behind initial load so empty form state can never overwrite saved data.
- Modal mounted in BOTH shells (desktop jumps to sidebar Settings section; mobile opens its Settings tab via a go-signal counter prop); quiet cards on DesktopDashboard + mobile Dashboard tab.
- **Fixed:** desktop had NO way to open the in-app guides at all — added a footer Guides button in DesktopShell.
- Guides: +2 (TU verification in Add Vehicle, branding your reports).

#### Shared gating component (`packages/tru-ui-src/src/imagin8-gating.tsx`)

- `unlimited: true` flag = plain ACTIVE buttons with no count badge — no more 9999 sentinel numbers anywhere. All three servers now return `{valuation:0, regCheck:0, accidentReport:0, unlimited:true}` for unlimited dealers.
- ⚠️ **Gotcha for future edits:** each app's local copy of this component is overwritten from the shared source by `sync:ui` on every lint/build (predev/prelint hooks). Edit ONLY `packages/tru-ui-src/src/imagin8-gating.tsx`; local copies get clobbered otherwise.

Files changed: `truflow-premium/{server.ts, src/App.tsx, src/types.ts, src/lib/guides.ts, src/lib/setupStatus.ts*, src/components/{SetupPrompt.tsx*, DealerDetailsSettings.tsx}}`, `TruLens/{server.ts, src/App.tsx, src/lib/{guides.ts, setupStatus.ts*}, src/components/{SetupPrompt.tsx*, InventoryList.tsx, imagin8-gating.tsx}}`, `truinspect/{server.ts, src/App.tsx, src/lib/{guides.ts, setupStatus.ts*}, src/components/{SetupPrompt.tsx*, InventoryList.tsx, DesktopShell.tsx, DesktopDashboard.tsx, DesktopSettings.tsx, imagin8-gating.tsx}}`, `packages/tru-ui-src/src/imagin8-gating.tsx`. (* = new)

### TruFlow Mobile v1.3 — Market Value + Follow-ups + Share (2026-08-23)

All mobile-only (`truflow-mobile/public/index.html` + `sw.js` bump `tfm-2026-08-23a`). Zero backend changes; everything works for standalone/light dealers and premium field workers (both auth against the same backend; only un-gated endpoints used).

**Market Value (free scraper, all tiers):**
- "Get market value · Free" button on Add Vehicle (needs year+make+model, uses mileage) and in vehicle detail sheet (under Details)
- Calls `POST /api/valuation` (Bright Data AutoTrader/Cars.co.za scraper) via existing proxy
- Result card: market average, listings found, km-adjusted flag, market median km; delta line vs current asking price on the detail sheet; "Use as asking price" fills the price field
- Session cache keyed year|make|model|km; loading label swap; friendly error card

**Follow-up tasks (Home-centric):**
- `GET/POST/PUT/DELETE /api/tasks` wired into mobile; `loadTasks()` joined to `loadAll()` Promise.all (30s polling + pull-to-refresh cover it)
- Home "Due today" section: overdue/due-today open tasks, lead/car context resolved from caches, one-tap Resolve check, "+ Follow-up" quick-add modal (due today default), max 5 rows + "N more"
- Wide "Follow-ups" KPI tile (grid-column span 2) opens full list sheet grouped Overdue/Today/Upcoming/No date/Recently done with "New follow-up" footer button
- Task edit sheet: title, date input, Normal/Urgent select, Pending/In Progress/Completed segment (labels To do/Active/Done), linked lead/vehicle deep-link into existing sheets, Save/Delete

**UX polish:**
- All KPI tiles tappable: In stock→Stock, Live→Stock(Live chip), Leads→Leads, Unpublished→Stock(Draft chip); new Draft filter chip added to stock chips
- Home Follow up: stale New leads (>24h) surface first
- "Share this car" row in vehicle detail: caption + deep link `<websiteUrl>/vehicle/?stock=…&year=…&make=…&name=…&variant=…&price=…&km=…&trans=…&fuel=…&img=…` mirroring `packages/standalone/tru-share/tru-share.js` URL contract so links unfurl; Web Share API when link exists, WhatsApp fallback otherwise (text-only for drafts/no-site dealers). websiteUrl resolved lazily from `GET /api/state` (dealerships ride along unscoped there; `/api/dealerships` is admin-only, `/api/public/dealerships` omits websiteUrl) and cached per session
- Guide panel: added "Plan your day with follow-ups" + "Price against the market"; Account footer → Version 1.3

**Verified live:** demo login → tasks CRUD/resolve/groups, real scraper results (Polo R243k/35 listings km-adjusted; Corolla R247k/21), price fill, tile nav + Draft filter, share caption, guide entries, no console errors.

**Accessibility pass (same day, sw `tfm-2026-08-23b`):**
- Nav tabs are real `<button>`s with `aria-current`; KPI tiles, task/lead/vehicle rows, chips and sec-h links get `role="button"` + Tab/Enter/Space via a `pressable()` helper; global `:focus-visible` ring
- Publish switch: keyboard toggle + `aria-checked`; status segments expose `aria-pressed`
- Escape closes topmost overlay (chat → guide → sheet); sheets are `role="dialog" aria-modal` with focus moved in on open and restored on close
- Toast is an `aria-live="polite"` status region; all icon-only buttons labelled

**Visual alignment + overflow fixes (2026-08-24, sw `tfm-2026-08-24a`):**
- Tokens re-aligned to the ACTUAL rendered suite (built `dist` CSS, not `brand.css` — the apps had diverged from the canonical file): `--ink-2` `#0D1117`, `--glass` `rgba(232,234,230,.055)`, `--glass-line` `rgba(232,234,230,.14)`, `--cyan-surface` `rgba(79,227,220,.1)`. Verified 17/17 tokens match TruLens + TruInspect builds byte-identically.
- Fixed `.pill.dot` class collision: global pulse-dot `.dot{width:height:6px}` was collapsing every status pill (Live/Won/New…) to a 6px sliver; `.pill.dot{width:auto;height:auto;box-shadow:none;animation:none;}` restores full-size tags.
- Green Purge completed in mobile: emerald `#34D399` (market-value "Free" badge) + WhatsApp `#25D366` (lead quick-actions, lead sheet, Support row) → cyan tokens. Zero raw greens left.
- Sheet footer overflow: `.sheet-scroll` padding-bottom now clears the sticky footer so the market-value result card never hides behind Save/Delete.

---

### Unified Demo Mode (2026-08-22)

**Problem:** Each app had its own demo/login pattern — Premium had a proper one, TruLens/Inspect had hacky local fallbacks.

**Solution:** All 3 apps now share the same demo architecture:
- `POST /api/auth/demo` — returns a signed HMAC token with unique `demo-<hex>` uid
- 24-hour TTL (`DEMO_TTL_MS = 24 * 60 * 60 * 1000`)
- Data isolation — vehicles stored per-uid, so each browser gets its own sandbox
- `DEMO_ENABLED` env var (defaults to `!ACCESS_CODE`, i.e. enabled in local dev)
- Small "Try demo (24h)" link at bottom of login screen — unobtrusive for paid users

**Files changed:**
- `TruLens/server.ts` — `signDemoToken`, `verifyDemoToken`, `/api/auth/demo`
- `TruLens/src/contexts/AuthContext.tsx` — `enterDemoMode()` calls server
- `TruLens/src/components/Login.tsx` — demo button at bottom
- `truinspect/server.ts` — same demo token system
- `truinspect/src/contexts/AuthContext.tsx` — `enterDemoMode()` + `isDemo`
- `truinspect/src/components/Login.tsx` — demo button at bottom
- `truflow-premium` — already had it (`enterDemo()` → `/api/auth/demo`)

### Imagin8 Bundle Gating + Accident Report (2026-08-22)

**New endpoint:** `accidentReport(vin)` — VIN-based claims history with damaged areas + claim amounts.

**Bundle gating system:**
1. Added `accidentReport` export to `packages/imagin8.ts`
2. Created `packages/imagin8-gating.tsx` — shared `Imagin8GatedButton` component
   - Active state: cyan accent, shows remaining count
   - Gated state: glassmorphic, lock icon, "Premium" badge — enticing, never disabled
3. Added per-dealer bundle persistence (`imagin8-bundles.json`) to all 3 servers
4. Added bundle-gated routes to all apps:
   - `POST /api/imagin8/valuation` — consumes `valuation` bundle
   - `POST /api/imagin8/regcheck` / `GET /api/imagin8/regcheck` — consumes `regCheck` bundle
   - `GET /api/imagin8/accident-report` — consumes `accidentReport` bundle
   - `GET/POST /api/imagin8/bundles` — admin top-up
5. Added 3 gated buttons to vehicle cards in all apps:
   - **TruLens** + **TruInspect**: on inventory list vehicle card (before capture)
   - **TruFlow Premium**: in VehicleDetailModal specs tab (next to existing TU Valuation/Reg Check)

**Files changed:**
- `packages/imagin8.ts`
- `packages/imagin8-gating.tsx` (new)
- `TruLens/server.ts`
- `TruLens/src/components/InventoryList.tsx`
- `TruLens/src/components/ReportPreview.tsx` (reverted)
- `truinspect/server.ts`
- `truinspect/src/components/InventoryList.tsx`
- `truflow-premium/server.ts`
- `truflow-premium/src/components/VehicleDetailModal.tsx`

### Live Imagin8 `getModels` in VehiclePicker

**Problem:** Static catalogue JSON files were stale. Needed live M&M codes from Imagin8.

**Solution:**
1. Added `getModels` export to `packages/imagin8.ts`
2. Added `POST /api/imagin8/models` route to TruLens and TruInspect servers
3. Updated `VehiclePicker.tsx` in both apps:
   - Make dropdown still loads from static `/catalogue/index.json` (fast)
   - Model/variant/year dropdowns now call live API first
   - Falls back to static `/catalogue/<file>.json` if API fails/unconfigured
4. Passed auth token from `InventoryList` to `VehiclePicker` via new `getToken` prop

**Files changed:**
- `TruLens/server.ts`
- `TruLens/src/components/InventoryList.tsx`
- `TruLens/src/components/VehiclePicker.tsx`
- `truinspect/server.ts`
- `truinspect/src/components/InventoryList.tsx`
- `truinspect/src/components/VehiclePicker.tsx`
- `packages/imagin8.ts`

### Imagin8 App Name Update

- `IMAGIN8_APP_NAME` changed to `eValue8Broker` in Render dashboard
- Applied to: `trusaas-lens`, `trusaas-inspect`, `trusaas-premium`

### Build Fix: `imagin8-gating.tsx` Location (2026-08-22)

**Problem:** `packages/imagin8-gating.tsx` caused Vite/Rollup resolve errors for React when imported from outside `src/`.

**Fix:** Moved to `packages/tru-ui-src/src/imagin8-gating.tsx` so the `sync:ui` prebuild script copies it into each app's `src/components/`. Local copies added for TruLens, TruInspect, and TruFlow Premium. All imports updated to `./imagin8-gating`.

**Files changed:**
- `packages/tru-ui-src/src/imagin8-gating.tsx` (new)
- `TruLens/src/components/imagin8-gating.tsx` (new)
- `truinspect/src/components/imagin8-gating.tsx` (new)
- `truflow-premium/src/components/imagin8-gating.tsx` (new)

### Remove Imagin8 Buttons from Inventory Cards (2026-08-22)

**Problem:** 3 gated buttons on every vehicle card cluttered the inventory list UI.

**Fix:** Removed `Imagin8GatedButton` rows from `TruLens` and `TruInspect` `InventoryList` vehicle cards. Buttons now live only in detail/modal views (Add Vehicle, VehicleDetailModal).

**Files changed:**
- `TruLens/src/components/InventoryList.tsx`
- `truinspect/src/components/InventoryList.tsx`

### `true-cars` Unlimited Imagin8 Bypass (2026-08-22)

**Problem:** `true-cars` slug (our own dealership/showroom) shouldn't be bundle-gated.

**Fix:** Added `UNLIMITED_DEALERS = new Set(['true-cars'])` + `isUnlimitedDealer()` to all 3 servers. Paid routes skip bundle checks and deduction for this slug.

**Files changed:**
- `TruLens/server.ts`
- `truinspect/server.ts`
- `truflow-premium/server.ts`

### Add Vehicle: Reg Check + Accident Report (2026-08-22)

**New:** Two ghost buttons in the Add Vehicle flow for both TruLens and TruInspect:
- **Verify Registration** — calls `regCheck` via VIN/stock number
- **Accident Report** — calls `accidentReport` via VIN

Results display inline as chips: "Clear" (emerald) / "Stolen" / "Finance pending" / "X claim(s)" (rose).

**Files changed:**
- `TruLens/src/components/InventoryList.tsx` (Add Vehicle form)
- `truinspect/src/components/AddVehicleDialog.tsx`

### TruInspect Desktop Lightbox (2026-08-22)

**New:** Click any photo in `VehicleManager` desktop grid to open full-screen lightbox.
- Arrow navigation between photos
- Shows slot label + count
- Damage tags displayed as chips at bottom

**Files changed:**
- `truinspect/src/components/VehicleManager.tsx`

### Trade-In: Service Book Fields + Editable Margin (2026-08-22)

**New fields on `service_book` step:**
- `lastServicedDate` — date picker
- `serviceDue` — checkbox
- `serviceComments` — textarea

**Editable margin on final screen:**
- `TradeInSummary` now shows a dealer margin input that recalculates the final offer live
- Persists through save and reflects in the report

**Files changed:**
- `truinspect/src/types/inspection.ts`
- `truinspect/src/components/TradeInWalkAround.tsx`
- `truinspect/src/components/TradeInSummary.tsx`

### TruInspect, TruLens & TruFlow Premium Bundle Gating & Verification Alignment (2026-08-23)

**Summary of fixes & enhancements:**
- Unified `Imagin8GatedButton` styling: clean button without "9999" counter badge for `true-cars` / unlimited users; proper `min-height: 42px`, `type="button"`, and grid alignment.
- Fixed TypeScript compile errors (`slot.name` and single argument for `computeInspectionReadiness`).
- Added keyboard navigation (`Escape`, `ArrowLeft`, `ArrowRight`) to `VehicleManager` photo lightbox in TruInspect.
- Aligned Imagin8 bundle gating across all 3 apps: TransUnion paid features (`regCheck`, `accidentReport`, `valuation`) use `Imagin8GatedButton` with "Unlock (Premium)" state and prompt to contact account manager when 0 bundles; `true-cars` slug is unlimited.
- Market Value scraper (AutoTrader + Cars.co.za via Bright Data) remains 100% free and ungated for all users.
- Added live TransUnion verification controls with result chips to `truinspect` (Desktop & Mobile), `TruLens` (Add/Edit Vehicle form), and `truflow-premium` (`VehicleDetailModal` specs tab).
- Wired real `accidentReport` in TruFlow Premium `VehicleDetailModal.tsx`.

**Files changed:**
- `packages/tru-ui-src/src/imagin8-gating.tsx`
- `truinspect/server.ts`
- `truinspect/src/components/imagin8-gating.tsx`
- `truinspect/src/components/VehicleManager.tsx`
- `truinspect/src/components/AddVehicleDialog.tsx`
- `truinspect/src/components/InventoryList.tsx`
- `truinspect/src/components/TradeInValuation.tsx`
- `truinspect/src/components/DesktopDashboard.tsx`
- `truinspect/src/components/DesktopShell.tsx`
- `TruLens/server.ts`
- `TruLens/src/components/imagin8-gating.tsx`
- `TruLens/src/components/InventoryList.tsx`
- `truflow-premium/server.ts`
- `truflow-premium/src/components/imagin8-gating.tsx`
- `truflow-premium/src/components/VehicleDetailModal.tsx`

---

### Guide Accuracy Pass + Media & Web Nav Removal (2026-08-24)

**Media & Web sidebar group dropped from TruFlow Premium entirely:**
- `media_web` ("Stock media", briefly "Edit stock") deleted — it duplicated All Vehicles with a filter. Its unique assets moved: Shoot/Web-toggle/photo filters were already per-row on All Vehicles; readiness counters were already on the dashboard. The public feed URL (`/api/public/stock?dealer=slug`) is documented in guides only — a dashboard link was added, then pulled at owner request (read as clutter).
- `web_management` stays built and reachable via the dashboard Web readiness card's Manage button; recorded in tests/navigation.test.mjs WITHHELD with that reason. The nav-completeness guardrail caught the orphan within minutes of the nav edit — trust that test.
- field-guide.html updated to match.

**⚠️ Reverted 2026-08-25 at owner direction:** the Media & Web group is back. `media_web` ("Stock media") + `web_management` ("Web Management") are again in `groupedNavigation` (before Dealer Settings), both role menus, and `media_web`'s Stock Media hub render was restored from the pre-`eeedfb5` file (card grid is now `grid-cols-2/3/4` with `aspect-[4/3]` uniform tiles at owner request; `web_management` removed from WITHHELD). The `Image` lucide icon was re-added to the App.tsx import.

**Guide copy grounded in what apps actually do (all 3 apps' src/lib/guides.ts):**
- AI damage detection claims REMOVED everywhere. Damage tagging is manual in Inspect + Lens (tap spot, type, severity 1–5); Inspect's /api/inspect/damage endpoint is retired and returns empty findings; Lens's "Scan this photo with AI" button targets a route that does not exist in its server. Owner-set framing: "AI is involved, but not for detection."
- Premium guides added: trade-in appraisal (Inspect walk-around → free market scraper / TU valuation → editable margin → signed offer), TruOrbit 360 spin (Lens lap panels → auto-built on DMS export ≥6 frames → drag-spin on listing).
- Inspect checklist guide categories corrected to real groups; trade-in guide now states the actual offer formula (retail − recon − margin %).

**LoginSplash tagline:** "Dealer management Ecosystem for Dealers by Dealers" (owner wording).

### Green Purge — one accent only (2026-08-24, owner call)

The last hardcoded greens (`#25D366` WhatsApp, `rgba(52,211,153)` emerald) were removed from app chrome across all three apps. Doctrine per brand.css: one cyan accent carries every interactive/live state; the Tailwind @theme already remaps emerald/green/lime/teal to the cyan ramp, so these were just bypassing it.

- Premium: sidebar Support button, inventory WhatsApp action, lead chips, LeadDetailModal (contact button, timeline, messaging simulator), VehicleDetailModal market-value button + TruSocial WhatsApp color, dmsReadiness "web-ready" badge → all cyan. `src/lib/guides.ts` tone fallback cleaned.
- The messaging simulator no longer cosplays WhatsApp's chrome (dropped `#075e54`/`#128C7E` header) — it now renders in TruSaaS ink + cyan live states.
- Lens: market-value button → cyan. Inspect: readiness "signed off" chip + dashboard pie slice → cyan.
- **Intentional exception (printable paper documents only):** VIR / trade-in appraisal / report condition scales keep classic green-for-good. These are light-background print artifacts, document semantics, not app chrome (Lens ReportPreview:122, Inspect ReportPreview:31, TradeInSummary:94).

## 5. Configuration Notes

### Local Dev

```bash
# TruLens
npm install && npm run dev  # localhost:3000

# TruInspect
npm install && npm run dev  # localhost:3000

# TruFlow Premium
npm install && npm run dev  # localhost:3001
```

### Environment Variables (Render)

Set in Render dashboard, **never commit values**. `render.yaml` declares keys with `sync: false`.

**Critical for production:**
- `TRUFLOW_SYNC_KEY` — shared secret between Lens ↔ Premium ↔ Inspect
- `TRULENS_ACCESS_CODE` or `TRUINSPECT_ACCESS_CODE` — legacy fallback
- `IMAGIN8_*` — all five vars needed for chargeable calls
- `DEMO_ENABLED` — set to `0` on production to disable demo mode

### Disk Mounts

All data lives on mounted Render disks. **Without these, every deploy wipes inventory:**
- TruLens: `/var/data` (5GB)
- TruInspect: `/var/data` (5GB)
- Premium: `/var/data` (10GB)

---

## 6. Security Notes

### Recent Fixes (2026-08-22)

**1. Removed `local-demo-user` superuser bypass**
- `TruLens/server.ts:passesScope()` no longer hardcodes `uid === 'local-demo-user'` as a universal pass
- Demo users (both old `local-demo-user` and new `demo-<hex>`) are now scoped by `ownerId` like any real user

**2. Sanitized health endpoint**
- Removed `mode`, `dmsUrl`, `port` from `GET /api/health` response (TruLens)
- Keeps `accessCodeConfigured`, `syncKeyConfigured`, `dealerCodesConfigured` (booleans/counts only)

**3. Rate limiting on auth endpoints**
- All 3 apps: `POST /api/auth/login`, `POST /api/auth/device`, `POST /api/auth/demo`
- 10 attempts per IP per minute, returns 429 when exceeded
- Simple in-memory Map (resets on restart — sufficient for brute-force protection)

**4. TruInspect demo token ordering**
- Fixed: `verifyDemoToken()` now runs BEFORE the local-mode fallback
- Prevents arbitrary unsigned JWTs from shadowing legitimate signed demo tokens

**5. Demo restrictions (TruLens + TruFlow Premium)**
- 5-vehicle limit per demo user (`POST /api/inventory` rejects new vehicles when count ≥ 5)
- DMS export blocked server-side (`POST /api/export/dms` returns 403 for `req.user.demo`)
- Publish to website disabled in UI (`disabled={isDemo}` on Publish button)
- Export button disabled in UI (`disabled={isDemo}` on Export button)
- Premium: `POST /api/inventory` rejects when `dealershipId === "demo"` and count ≥ 5

### Remaining (Pre-existing)

- [ ] TruInspect local mode (`HAS_REAL_TOKEN_SECRET=false`) accepts ANY Bearer token with a valid JWT shape — mitigated by setting `TRUINSPECT_ACCESS_CODE` or `TRUFLOW_SYNC_KEY` in production
- [ ] No CSRF tokens — mitigated by Bearer token auth (not cookie-based)
- [ ] Photos served publicly at `/media/<hash>` — by design for dealer websites

---

## 7. Known Issues / TODO

- [x] ~~Imagin8 gated buttons — click handlers currently show `alert()` placeholders~~ **Fixed:** wired real API calls in Add Vehicle flow + Premium VehicleDetailModal
- [x] ~~Bundle top-up UI — currently no dealer-facing interface~~ **Partial:** admin POST `/api/imagin8/bundles` still only top-up method, but `true-cars` is unlimited
- [ ] TruInspect `VehicleManager.tsx` / `DesktopDashboard.tsx` — pre-existing TS errors unrelated to recent changes
- [ ] `packages/imagin8.ts` `getModels` response shape — currently heuristic split on first word for model/variant. May need refinement based on real Imagin8 responses.
- [ ] TruFlow Premium `render.yaml` — `IMAGIN8_APP_NAME` also declared but may not need `getModels` route unless Premium gets a VehiclePicker too
- [ ] TruInspect `AddVehicleDialog.tsx` — no market valuation button (only in TruLens Add Vehicle). Could add TU valuation here too.
- [ ] Your Car Guy WP site full revert — blocked pending cPanel access
- [ ] TruLens/TruInspect deep security audit — remaining MEDIUM/LOW issues (CORS, XSS sanitization) not yet addressed

---

## 8. How to Update This File

Whenever you:
- Add/remove a service or integration
- Change API contracts (Imagin8, Zernio, etc.)
- Modify deployment config
- Fix a bug that required architectural knowledge

**Append to Section 4 (Recent Changes)** and update **Section 3 (Integrations)** if env vars or routes changed.

---

## 9. Quick Reference

### Git Remotes
- GitHub: `https://github.com/tru-you/trusaas.git`
- GitLab: `https://gitlab.com/trusaas-group1/trusaas.git`

### Deploy Command
```bash
# After commit, push triggers auto-deploy on Render
git push origin main
```

### CDN Widget Deploy
```bash
netlify deploy --dir packages/standalone --prod --site bca2fe0a-8055-4ae9-be49-389c2cce27b4
```

### Health Checks
- `GET /api/health` — all services (JSON, no auth)
- `GET /api/version` — commit hash running (public)
