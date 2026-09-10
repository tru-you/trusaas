# Market Scraper — Agent Project Memory

**Last updated:** 2026-09-10 by Antigravity
**Purpose:** Permanent guardrails for the scraper engine. Any agent touching scraper code MUST read this file first.

---

## 0. ABSOLUTE RULES — NEVER REGRESS THESE

1. **NEVER remove the SERP domain blocklist.** Facebook Marketplace, Gumtree, OLX, Junk Mail, TikTok, and BidOrBuy are banned sources. They produce scam/bait pricing that destroys valuations (e.g. BMW 320d went from R270k to R612k when Facebook results leaked in). The blocklist lives in `parseSerpResults()` in `engine.ts`.

2. **NEVER revert to first-year-only SERP matching.** The year check in `parseSerpResults.consider()` scans ALL `(19|20)\d{2}` matches in text and accepts if ANY is within ±1. The old code checked only the FIRST match, which caught copyright years like "(2026)" in site headers and rejected valid 2015 listings.

3. **NEVER pass the full variant into SERP `titleMentionsVehicle`.** SERP uses `serpBaseModel` (e.g. "Fortuner" not "Fortuner 2.5") because aggregator pages (Trovit, Automark, LandCruiserSA) don't repeat the displacement in their titles. The actual SERP *query* still includes the variant for relevance.

4. **NEVER use a flat depreciation rate.** Depreciation is make-aware via `DEPRECIATION_BY_MAKE` map + `getDepreciationRate()`. EVs depreciate at 8.5%/year, Toyotas at 3.5%, BMWs at 5.5%. A flat rate wildly misprices older premium cars.

5. **NEVER let SERP results push `{ price }` only.** SERP comps MUST push `{ price, title, year, source }` so that `adjustForTrim` (displacement differential) and `adjustForYearGap` (make-aware depreciation) can fire. Without title/year, these adjustments silently no-op and prices stay wrong.

6. **NEVER skip the auction/bidding keyword filter.** Results containing "bidding", "auction", "starting bid", "reserve", "bid now", or "sold for" are below-market liquidation prices. One R55k auction result for a R270k Fortuner destroyed the valuation.

7. **NEVER assume classifieds return the correct year.** Bright Data Unlocker returns promoted/generic inventory from AutoTrader and Cars.co.za **completely ignoring URL year filters**. Both sites are Next.js SPAs — the URL params are client-side only. `titleMentionsVehicle` is the REAL year gate, not the URL.

8. **ALWAYS keep the depreciation tier structure.** Owner-validated tiers (2026-09-10):

| Tier | Rate | Makes | Rationale |
|------|------|-------|-----------|
| 1 | 3.5% | Toyota, Isuzu, Land Rover, Jeep, Porsche | Hold value exceptionally in SA |
| 2 | 4.0% | VW, Nissan, Mazda, Suzuki, Subaru, Honda, Ford | VW has factories in SA, strong retention |
| 3 | 4.5% | Hyundai, Kia, Mitsubishi, Opel, Chevrolet | Mainstream |
| 4 | 5.5% | BMW, Mercedes, Audi, Volvo, Mini, Jaguar | Premium European — faster depreciation |
| 5 | 6.5% | Alfa Romeo, Maserati, Peugeot, Citroën, Fiat | Fast-depreciating niche |
| 6 | 5.5% | Renault, Chery, GWM, Haval, BAIC, JAC | Budget/new-entrant brands |
| EV | 8.5% | Any EV / PHEV | "The day you drive them off the floor, 10% less" |

---

## 1. Architecture

### Files

| File | Purpose | Lines |
|------|---------|-------|
| `engine.ts` | Core engine — types, parsing, filtering, extraction, adjustments | ~1200 |
| `index.ts` | Pipeline orchestrator — 4-stage search, SERP fallback, cache, final calc | ~420 |
| `serper.ts` | Serper.dev client — `serperSearch()` + `toEngineFormat()` bridge | ~84 |
| `markets/sa.ts` | SA market config (ZAR, km, AutoTrader/Cars.co.za sources) | ~45 |
| `markets/uk.ts` | UK market config (GBP, miles, cinch.co.uk) | ~60 |
| `markets/housing.ts` | Housing market config (Property24, Private Property) | ~75 |
| `webapp/server.ts` | Express HTTP wrapper for standalone deployment | ~200 |

### Deployment

| Location | Path | Process | Port |
|----------|------|---------|------|
| **Hetzner** (primary) | `/root/packages/market-scraper/` | PM2 `scraper` | 4300 |
| **TruData** (synced copy) | `trudata/server/lib/scraper/` | Part of TruData server | 3001 |

- **Build:** `npm run build:webapp` → esbuild → `webapp/server.cjs`
- **Deploy to Hetzner:** SFTP upload engine.ts + index.ts + server.cjs + markets/ → `pm2 restart scraper`
- **SSH:** `root@2.29.17.123` password `TruSaaS2026!Het`
- **Public URL:** `https://scraper.tru-saas.com`

### Data Flow

```
fetchValuation(make, model, year, opts, market)
  │
  ├─ Cache check (15min TTL, keyed by market|dealer|make|model|year|vin|mileage)
  │
  ├─ STAGE 1: Exact match (classified sources — AutoTrader, Cars.co.za via Bright Data)
  │   ├─ JSON dealer feeds (fetchJsonDealerPrices)
  │   ├─ HTML scraping (fetchPageForParsing → extractNextData → extractCardListings → extractJsonLd)
  │   └─ titleMentionsVehicle() = the REAL year+make+model gate
  │
  ├─ STAGE 2: Closest sibling variant (same year, relaxed variant)
  │   └─ Only if <3 comps from Stage 1
  │
  ├─ STAGE 3: Adjacent years (±2 years)
  │   └─ Only if <3 comps; adjustForYearGap handles price correction
  │
  ├─ STAGE 4: Sibling variant fallback (same year, NO variant filter)
  │   └─ Only if <3 comps; adjustForTrim's displacement differential handles correction
  │
  ├─ SERP tier (Google via Serper.dev)
  │   ├─ Triggers when classified comps < SERP_TRIGGER_MAX (default 6)
  │   ├─ parseSerpResults() with domain blocklist + year/model/auction filters
  │   └─ Query: "{year} {make} {model} for sale South Africa price"
  │
  ├─ Dedup by price|km|year across all sources
  │
  ├─ Adjustments:
  │   ├─ adjustForYearGap(price, compYear, subjectYear, make, isEv) — compound depreciation
  │   ├─ adjustForTrim(price, compTitle, subjectVariant) — displacement, auto/manual, 4x4/4x2
  │   └─ adjustForMileage(price, compKm, targetKm) — currently pass-through
  │
  ├─ iqrFilter() — removes outliers (IQR method, 1.5× fence)
  │
  └─ robustAverage() → final retail price
      ├─ ≤3 comps: anchor to highest (top clean retail comp)
      ├─ 4-7 comps: trim highest, average remaining
      └─ 8+: trim top/bottom 10%, average middle
```

---

## 2. SERP Filtering Pipeline (parseSerpResults)

The SERP filter is the most critical and fragile part. Here's the exact order of checks:

```
For each organic/shopping result:
  1. Domain blocklist    → reject facebook.com, gumtree.co.za, olx, junkmail, tiktok, bidorbuy
  2. Empty text          → reject
  3. Auction keywords    → reject "bidding", "auction", "starting bid", etc.
  4. Year check          → scan ALL years in text, accept if ANY within ±1 of target
                           (no years at all = allow through for aggregator pages)
  5. titleMentionsVehicle → uses serpBaseModel (variant stripped), checks make aliases,
                           modelCore substring, displacement, fuel, cab, drivetrain
  6. Price extraction    → structured price OR extractPricesFromText (median if multiple)
  7. Push with metadata  → { price, title, year, source: 'Google (SERP)' }
  8. Dedup by price      → seen Set<number>
```

---

## 3. Known Issues & Limitations

### Critical: Bright Data Returns Wrong Years
AutoTrader and Cars.co.za **completely ignore year URL filters** when accessed via Bright Data Unlocker. They return promoted inventory from ALL years. Both are Next.js SPAs where URL params are processed client-side only.

### SERP Variability
Google doesn't return identical results each query. Same search can yield different prices each run. Inherent and unfixable — domain blocklist and IQR filtering mitigate it.

### robustAverage Bias for Small Samples
With ≤3 comps, `robustAverage` returns the HIGHEST price. A single overpriced dealer listing dominates when comps are scarce. The 4-stage search + SERP fallback exist to push count above 3.

### Variant Precision for BMW/Mercedes
BMW "3 Series 320d" searches may pull in "330d" or "M Sport" prices. The displacement check in `adjustForTrim` partially handles this (3% per 0.1L step, ±30% cap).

### Same Listing Across Sites
AutoTrader and Cars.co.za often list the SAME car. Dedup by `price|km|year` catches exact duplicates but slight km differences cause duplication.

---

## 4. What Could Improve (Future)

### High Impact

1. **SERP domain whitelist instead of blocklist.** Only ACCEPT results from known-good auto sites (AutoTrader, Cars.co.za, WeBuyCars, Automark, SurfForCars, CarFind). More defensive than blocking known-bad sites.

2. **More intelligent dedup.** Fuzzy matching: same make+model+year within ±R5k and ±2000km = same car. Prevents the same R299k listing counting as 4 comps.

3. **adjustForMileage implementation.** Currently a pass-through. Should apply ~R1,500/10,000km adjustment.

4. **First-year depreciation override.** Owner confirmed "first year 10% of almost every car". Current compound model uses same rate for year 1 as year 5. Year-1 multiplier (2× base rate) would improve accuracy for nearly-new cars.

5. **Bright Data Scraping Browser.** Use headless browser instead of Web Unlocker to execute client-side JS and get properly year-filtered results.

### Medium Impact

6. **WeBuyCars API integration.** Structured listings with prices. Would significantly increase comp count.

7. **Cached SERP results (24h).** SERP changes slowly. 24h cache instead of 15min saves Serper.dev credits.

8. **Better confidence scoring.** Factor in: price range width, source diversity, year match precision.

9. **Performance badge pricing.** GTI, RS, M Sport, AMG hold value differently than base models.

### Low Impact / Nice-to-Have

10. **Negotiation discount.** All comps are ASKING prices. Actual transaction is 5-10% lower.

11. **Regional pricing.** Joburg vs Cape Town vs Durban can differ by R10-20k.

12. **Seasonal adjustments.** Prices dip January, peak March-May.

---

## 5. Key Functions Reference

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `parseSerpResults` | engine.ts | ~524 | SERP result filter pipeline |
| `titleMentionsVehicle` | engine.ts | ~363 | Core make/model/year/variant gate |
| `modelCore` | engine.ts | ~255 | Strips cosmetic noise, keeps price-material trims |
| `splitModelAndVariant` | engine.ts | ~285 | Compound model splitting (Fortuner 2.5 D-4D) |
| `extractNextDataListings` | engine.ts | ~790 | Next.js `__NEXT_DATA__` JSON extraction |
| `extractCardListings` | engine.ts | ~738 | HTML card text extraction |
| `adjustForYearGap` | engine.ts | ~919 | Make-aware compound depreciation |
| `adjustForTrim` | engine.ts | ~940 | Variant/displacement/drivetrain differential |
| `getDepreciationRate` | engine.ts | ~908 | Lookup from DEPRECIATION_BY_MAKE |
| `iqrFilter` | engine.ts | ~985 | IQR outlier removal (1.5× fence) |
| `robustAverage` | engine.ts | ~975 | Final price calculation (size-dependent strategy) |
| `fetchValuation` | index.ts | ~134 | Main orchestrator (4-stage + SERP) |

---

## 6. Environment Variables

| Var | Default | Purpose |
|-----|---------|---------|
| `SERPER_API_KEY` | — | Serper.dev API key (SERP provider) |
| `BRIGHTDATA_API_KEY` | — | Bright Data API key (classified scraping) |
| `BRIGHTDATA_UNLOCKER_ZONE` | — | Bright Data zone name |
| `SCRAPER_CACHE_TTL_MS` | 900000 (15min) | Cache duration for valuation results |
| `SCRAPER_TOTAL_BUDGET_MS` | 22000 | Max time per valuation request |
| `SERP_TRIGGER_MAX` | 6 | Trigger SERP when classified comps < this |
| `PORT` | 4300 | Server port (webapp mode) |

---

## 7. Sync Rules

The scraper lives in **three** locations. Keep them in sync:

1. **`packages/market-scraper/`** — the canonical source (this directory)
2. **`trudata/server/lib/scraper/`** — copy of engine.ts + index.ts (has extra `markets/housing.ts`)
3. **App in-tree copies** (TruLens, TruInspect, TruFlow Premium) — legacy SA forks, pending parity cutover

**Sync procedure:**
```bash
# After editing packages/market-scraper/engine.ts or index.ts:
cp packages/market-scraper/engine.ts trudata/server/lib/scraper/engine.ts
cp packages/market-scraper/index.ts trudata/server/lib/scraper/index.ts
# Verify TruData builds:
cd trudata && npm run build
```

---

## 8. Testing — Benchmark Vehicles

These are the owner's benchmark vehicles. If ANY of these regress, something broke:

| Vehicle | Expected Retail | Notes |
|---------|----------------|-------|
| 2015 Toyota Fortuner 2.5 D-4D | R250–300k | Was R449k (broken), fixed to R297k |
| 2018 BMW 320d | R250–300k | Was R612k (Facebook scam), fixed to R270k |
| 2022 VW Polo 1.0 TSI | R250–300k | R300k = mid-range (Polo Life price) |
| 2021 Toyota Corolla 1.8 | R260–280k | Consistently tight range, good benchmark |
| 2020 Hyundai Tucson 2.0 | R240–280k | High comp count, good accuracy |

### Manual Test
```bash
curl -s -X POST https://scraper.tru-saas.com/api/valuation \
  -H 'Content-Type: application/json' \
  -d '{"make":"Toyota","model":"Fortuner","variant":"2.5","year":"2015","mileage":80000}' | jq .
```
