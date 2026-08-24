# TruSaaS — Agent Project Memory

**Last updated:** 2026-08-24 by ox-alpha (OpenCode)
**Purpose:** Persistent project context for coding agents. Update this file whenever architecture, integrations, or deployment config changes.

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
- Bundle storage: **ONE ledger, in Flow central only** — `truflow-premium/DATA_DIR/imagin8-bundles.json`. Lens and Inspect keep NO local ledger (2026-08-24)

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

### Zernio (TruSocial)

- `ZERNIO_API_KEY` — social auto-publishing (Facebook, Instagram, Google Business)
- Only in Premium DMS

### Bright Data Web Unlocker

- `BRIGHTDATA_API_KEY` + `BRIGHTDATA_UNLOCKER_ZONE`
- Unblocks Cars.co.za for scraper valuations

---

## 4. Recent Changes (2026-08-21)

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
