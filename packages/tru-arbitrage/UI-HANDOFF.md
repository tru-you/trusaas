# TruRadar — UI Build Handoff

**Author:** TruSaaS engineering · **Date:** 2026-09-04 · **Target:** AI UI build agent (read this file first)

You are building/refining the **TruRadar** dealer dashboard UI. The backend and data layer for the new features are DONE and verified. Your job is the frontend, primarily in the single-file app `packages/tru-arbitrage/public/index.html`. Everything you need is in this document and in the repo — do not invent new API endpoints, do not change server routes, do not add new dependencies unless this doc says so.

---

## 1. What TruRadar is

A standalone vehicle sourcing radar for South African car dealerships. Surfacing confidence-gated underpriced/distress deals from SA classifieds (Cars.co.za, AutoTrader) and dealer sites. **The new capability this build centers on: a seven-vertical catalogue** so dealers can price-check (and filter live deals by) **bikes, trucks, boats, caravans, agri machinery, specialty vehicles — not just cars.**

The full TransUnion catalogue (27,503 variants / 312 makes) now lives locally and is classified into 7 categories server-side. The existing UI only exposed a bare make→model→year dropdown limited to cars. That is what you are upgrading.

---

## 2. Tech & constraints (READ CAREFULLY)

- **Single-file app:** `public/index.html` — vanilla JS + Tailwind (via CDN `cdn.tailwindcss.com`) + `brand.css`. There is **no build step for the frontend**, no React, no bundler. The server (`dist/server.cjs`) serves this file statically.
- **Do not** touch `brand.css`, `sw.js`, `manifest.webmanifest`, or anything under `src/`.
- **Styling language:** Tailwind utility classes + the app's custom CSS variables. Use the app's existing components/classes — `tru-input`, `btn-primary`, `chip`, `chip-accent`, `tru-panel`, `tru-label`, `skeleton`. Do not introduce a second design system.
- **Theme:** dark, glassmorphic, single **cyan accent**. All interactive/live states are cyan. Do not add green/red/amber as chrome (only printable paper docs use those). Reference the variables:
  - `var(--accent)` — the cyan accent (text/links/active)
  - `var(--accent-surface)` — subtle cyan fill for active chips/tabs
  - `var(--glass)` / `var(--glass-line)` — panel backgrounds / borders
  - `var(--ink)`, `var(--ink-2)` — near-black backgrounds
  - `var(--white)` / `var(--white-dim)` / `var(--muted)` / `var(--faint)` — text hierarchy
  - `var(--state-attention)` / `var(--state-error)` — warnings/errors only
  - `var(--text-on-accent)` — text that sits on an accent fill
- **Auth:** every API call needs `Authorization: Bearer <token>` in headers. The app exposes `auth.headers()` for this. On a **401** response, call `authFailed()` (already defined — it clears and redirects to login). Do not swallow 401s.
- **Mobile-first shell:** the app has a mobile bottom-nav (`#mBottomNav`, buttons `data-mview=viewDeals|viewSearch|viewWatch|viewStock`) and sections toggled via `.m-view.m-active` (only visible when active below 1024px). Desktop shows all sections stacked; the top nav tabs (`#tab_viewDeals` etc.) drive `setTab()`. `setMobileView()` and `setTab()` already exist — reuse them.

---

## 3. The two surfaces you own

### 3a. Price Check — `#viewSearch` (mobile = the "Search" tab, desktop = always visible section)

The hero feature. **Category → Make → Model → Variant → Year** cascade + a ranked-list results table. It currently works end-to-end with native `<select>` elements (`#lookupPanel` markup starts around line 236). **Make it excellent.** The current selects work but are plain; the model/variant lists can be long (BMW has hundreds of variants) — consider type-ahead/searchable lists, grouped options, or a better picker **without** adding dependencies (a custom dropdown built in vanilla JS is fine; the existing code already has a shared `SearchSelect`-style pattern in the sibling apps `TruLens/TruInspect/src/components/VehiclePicker.tsx` you may reference for UX, but you are working in vanilla).

Server contract (all GET, all `requireAuth`):

```
GET /api/lookup/categories
→ { categories: [ { id, label, blurb, makeCount, modelCount } ] }
   id ∈ cars | moto | trucks | marine | caravans | agri | specialty
   label examples: "Cars & Bakkies", "Motorcycles, Quads & SxS", "Trucks, Buses & Vans",
                   "Boats & Jetskis", "Caravans & Trailers", "Tractors & Agri", "Specialty"

GET /api/lookup/makes?category=moto          (category optional; omit for ALL 312 makes)
→ { makes: [ "HARLEY DAVIDSON", "DUCATI", ... ] }        // UPPERCASE, alphabetical

GET /api/lookup/models?category=moto&make=HARLEY DAVIDSON
→ { models: [ "CVO", "DYNA", "PAN AMERICA", "SOFTAIL", "SPORTSTER", ... ] }
   // master model strings — can be quirky (numbers, slashes, e.g. "K 1100 / K 1200-1300").

GET /api/lookup/variants?category=moto&make=HARLEY DAVIDSON&model=CVO
→ { variants: [ { mmCode, variant, model, cc, kw, fuel, body, axle, years, category } ] }
   years: number[] DESCENDING (e.g. [2026, 2025, ...]) — real intro/discon range.
   variant: full description, e.g. "CVO BREAKOUT". Used as the scraper query — display it
   as-is but keep the ORIGINAL string attached; components title-case for display only.

GET /api/lookup/cheapest?category=...&make=...&model=...&variant=...&mmCode=...&year=2020
→ { query: {...}, 
    market: { averageRetailPrice, listingsFound, confidence, sources: [{name,count,avg}] },
    comps: [ { price, km?, year?, source?, url? } ] }     // CHEAPEST FIRST, capped 30
```

**Price-check behavioural requirements:**
1. Six controls: **Category → Make → Model → Variant → Year**, plus the "Find cheapest" button.
2. Selecting a level populates the next. Category load happens at app boot (already wired: `loadLookupCategories()`). Selecting Make only shows models within the selected category. Selecting Model only shows variants within the category+make. Selecting Variant builds the Year dropdown from that variant's `years` (preselect the newest).
3. Category options should show model counts, e.g. `Motorcycles, Quads & SxS · 778 models` (data has `modelCount`).
4. When a level has no children, show a friendly empty state in the child control ("No models for this make"). Never a broken dropdown.
5. The results table must be ranked **cheapest first** with columns: **Price, Year, Mileage, Source, Listing**. Year comes from `comp.year` (`—` when absent). Price formatted `R1 234 567` (en-ZA locale). The cheapest row's price is accent-colored. Listing is a deep-link (`comp.url`) in accent with an external-link icon; `—` when absent.
6. The summary line above the table: `Market average: R… · N live comps · confidence N%` (`confidence` 0–1 → percentage; ≥80% accent, else attention color), plus `· cheapest now: R…` when comps exist. When `listingsFound = 0`, say `· no live listings found` (no fabricated number).
7. Loading state: skeleton rows while scanning (`.skeleton` class exists, pattern already in markup). Button shows a pulsing dot + "Scanning…". Errors show in `#lookupError` (attention color), never a silent failure.
8. Keep the `#lookup*` element ids — other code (boot, reset, `doPriceCheck`) depends on them. You may restructure markup around them but not rename the ids.

### 3b. Live Deals filters — `#viewDeals`

**Category-aware filtering** of the deals feed. The filter row (desktop bar + mobile `<details class="mfilters">`) currently has: search, min margin, source, deal type, **Vehicle category** (`filterVcat`/`filterVcatM` — new), **Make** (`filterMake`/`filterMakeM` — the mobile make dropdown is new), sort, status.

- **Vehicle category dropdown** options come from `/api/lookup/categories` (labels, no counts needed here). Selecting it narrows the Make dropdown to that category's makes (data preloaded at boot via `initCatalogueFilters()` — already implemented: `catalogueVcats`, `catalogueMakesByCat`, `allCatalogueMakes`).
- **Make dropdown** is catalogue-backed (all 312 makes), NOT derived from loaded deals. Category selected → only that category's makes, else all.
- **Filtering:** every deal from `GET /api/deals` carries a `.category` field (server-set). Filter logic lives in `renderDeals()` — do not break it; the vcat filter is already implemented (deal.category match, falling back to catalogue make membership for legacy rows).
- The two mirrored controls (desktop `X` + mobile `XM`) stay in sync — `bindFilterPair` already handles this for ids in `FILTER_BASES` (vcat + make are included).
- `resetFilters()` must reset category + make to "All" (defaults already include `filterVcat: 'ALL'`).
- Styling: stays consistent with the other filter selects.

---

## 4. Design language — make it feel premium

- **Dark, glass, cyan.** Match the existing panels and the mobile Search vision ("Price check is the search vision — mobile defaults to it"). The demo screenshot expectations:
  - Hero-facing on mobile: the cascade is the first thing a dealer sees under the Search tab. It should feel like the product's search, not a buried form.
  - Desktop: the price-check section and Live Deals are stacked; keep them visually cohesive.
- Title-case display: makes/models/variants come back UPPERCASE or mixed — display them title-cased. The app has a `tc()` helper already (acronym ≤3 chars stay uppercase: "BMW", "KTM"; hyphenated parts cased: "Mercedes-Benz"; "Polo", "CVO BREAKOUT"). Reuse it.
- Handle long labels: model/variant options can be long ("K 1100 / K 1200-1300", "F 12 400 6X4 SLEEPER H/RED T/T C/C") — allow wrapping/ellipsis gracefully, never horizontal scroll of the app itself.
- Keep animations subtle (the app uses a `radar-pulse` dot and skeleton patterns). No neon, no gradients beyond what's present.

---

## 5. Current implementation notes (what already works — don't rebuild blindly)

- Catalogue REST routes: implemented + verified in `src/server.ts` (see §3a shapes).
- Price-check cascade JS: `loadLookupCategories()`, `onLookupCategoryChange()`, `onLookupMakeChange()`, `onLookupModelChange()`, `onLookupVariantChange()`, `doPriceCheck()` — implemented, boot-loaded from `showApp()`. The skeleton of the cascade WORKS. **Improve UX + polish, don't rewrite the network layer.**
- Live Deals filters: `initCatalogueFilters()`, `onVcatFilterChange()`, `populateMakeFilter()`, `renderDeals()` vcat branch — implemented and wired into boot + `FILTER_BASES`. Works.
- Range of the live price check is verified: `GET /api/lookup/cheapest` returns 30 ranked comps across the ±1 year band with year-normalized prices.
- **Do not** reintroduce a `loadLookupMakes()` function — it was removed; `loadLookupCategories()` replaced it (boot + toggle). If you rename functions, update every call site (including the `onclick`/`onchange` attributes and `showApp()`).

---

## 6. Accessibility & robustness

- Keyboard: controls focusable, Enter/Space activates, Esc closes any custom dropdown/overlay, focus returns on close. The rest of the app follows this (see app-wide `:focus-visible` ring).
- `aria-label`s on icon-only controls, `aria-expanded` on the price-check disclosure header (already partially present).
- Every fetch: catch errors → show inline message in the accent scheme; 401 → `authFailed()`; don't leave buttons disabled after failure (the `finally` pattern already used in `doPriceCheck`).
- Empty states: helpful message + a clear action, not a blank panel.

---

## 7. Out of scope / non-goals

- Do NOT touch the server, engine, tests, API routes, or data files (`src/`, `tests/`, `data/`, `scripts/`).
- Do NOT remove the `data-*` years attributes or `mmCode` plumbing in the variant options — `doPriceCheck` reads `data-years` + `data-mmCode` off the selected option.
- No new backend endpoints, no Firebase/auth changes, no PWA/service-worker changes.
- The vcat filter + category tagging are done — polish the UI around them, don't redesign the data flow.

---

## 8. Done = verified in a real browser

1. `npm run dev` (or build + `node dist/server.cjs`), open `localhost:4500`, demo login.
2. Mobile Search tab: cascade loads (Category populated on boot) → pick **Moto → Harley Davidson → a model → a variant → newest year** → Find cheapest → table renders sorted cheapest-first with years, no console errors.
3. Live Deals: Vehicle category dropdown populated; selecting it narrows Make; mobile filter row shows both Vcat + Make; reset clears both; no console errors.
4. Narrow desktop (`<1024px`) vs wide: shell adapts, nothing overflows horizontally, price-check and deals both usable.
5. Confirm no `ReferenceError` in the console (the last one was a stale `loadLookupMakes` — don't resurrect it).