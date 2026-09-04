# TruRadar — Vehicle Sourcing Radar

`@trusaas/tru-radar` · standalone SaaS · dashboard brand **TruRadar**

One job: surface **confidence-gated** underpriced and distress vehicle deals from SA classifieds (Cars.co.za, AutoTrader) + independent dealer sites (SERP discovery), priced against live market comps. Mobile shell is the **search vision** (price check hero); desktop is the **management console** (deals, offers + OTP).

Not part of the dealer DMS stack — the dealer's own stock is TruFlow's domain.

## Run

```bash
npm install
npm run dev        # localhost:4500, tsx watch
npm test           # 14 suites, no network needed
npm run build      # esbuild → dist/server.cjs
```

Configure via `.env` (see `.env.example`). `JWT_SECRET` is **required** in production — tokens are forgeable without it.

## How it works

```
scan → ingest (classifieds + SERP matrix) → normalize (native/regex/Gemini)
     → TU variant match (free local catalogue) → track (DOM, price history)
     → live comps → confidence score → gates → deal → dashboard + webhook
```

- **Confidence layer (the moat)** — `src/engine/confidence.ts` scores every valuation (sample size + price-band tightness, cap 0.95). Alerts below `CONFIDENCE_FLOOR` (0.6) never fire.
- **Decoupled from Flow** — the radar is self-sufficient (own scraper + free local TU catalogue fallback). Flow has its own built-in price checker. The one chargeable radar→Flow call (TU backstop) is **off by default** (`RADAR_TU_BACKSTOP=1` arms it) so the radar can never spend a dealer's Imagin8 bundle in Flow.
- **Dynamic recon** — `clamp(3% × marketRetail, R5k, R30k)`. No flat buffers.
- **Sanity gate** — net margin > 40% of market retail is rejected: miracles are data errors (salvage misparse, snippet artifacts).
- **Per-dealer isolation** — every store key is `${dealerSlug}:${id}`; a dealer's own site domain is excluded from their own scan.
- **Targeted scan lane (Watch targets)** — the Buy Box accepts `watchTargets` (`"Toyota"` or `"Toyota/Hilux"`, comma-separated). Each target is queried on AutoTrader cheapest-first and paginated, so the scan actually searches the market instead of sampling the newest ~32 listings posted nationally. Set in the Buy Box modal; empty = legacy newest-feed behaviour only.
- **Year filter actually works** — AutoTrader tiles concatenate fields (`"Fair Price2025 Toyota…"`), which broke the old `\b(19|20)\d{2}\b` on every card (measured 0/800). Year extraction now uses digit boundaries (`src/engine/year.ts`, `findCardYear`) and rejects unreadable years. Band comps are age-corrected to the subject year (`adjustForYearGap` is now wired, was dead code).

## Fetch layer (`src/engine/fetch-html.ts`)

- **Per-host circuit breakers** — a permanently-blocked host (cars.co.za 403s on server-side HTTP by design) can no longer open the whole `direct` tier for healthy domains (AutoTrader answers plain HTTP in ~380ms).
- **Single-flight + 10-min HTML cache + 8-way concurrency cap** — concurrent listings of the same car share one upstream fetch instead of each firing the full target fan-out.
- **Retries + backoff** on direct HTTP (2 attempts, exponential), matching the sibling Lens/Inspect scraper.
- **Source-request debt cut** — AutoTrader ignores `year=` (5 band URLs returned the identical page), so the band is gone: one make/model URL per page, local year filtering. Gumtree returns 0 tiles at ~4.5s/request, so that lane is off unless `SCRAPER_GUMTREE=1`.
- Tuning envs: `SCRAPER_CLASSIFIEDS_PAGES` (default 3), `SCRAPER_GUMTREE` (default off), `SCRAPER_UNLOCKER_ENABLED` (`1|true|yes` — now matches the sibling-apps gate), `BRIGHTDATA_UNLOCKER_ZONE` (default `unlocker`, same as Lens/Inspect).

## Price check

Seven-vertical catalogue cascade — **Category → Make → Model → Variant → Year** — built from the local classified TransUnion dump (27,503 variants across 312 makes, free, local). Category routing is per-VARIANT so BMW bikes split from BMW cars; buckets: cars/bakkies, moto (bikes + quads + SxS), trucks (incl. buses + vans), marine (boats/jetskis), caravans/trailers, tractors/agri, specialty (generators, golf carts…). Every query is widened a year either side of the model year (`SCRAPER_YEAR_TOLERANCE`, default 1) so a thin exact-year SERP can't starve the comps, and comps are age-corrected to the subject year before the average. Results rank every live asking price in South Africa cheapest-first, with the listing's model year shown.

```
GET /api/lookup/categories                        → 7 vertical buckets with make/model counts
GET /api/lookup/makes?category=moto               → makes having ≥1 moto model
GET /api/lookup/models?category=&make=            → models (category-filtered)
GET /api/lookup/variants?category=&make=&model=   → [{variant, mmCode, cc, kw, fuel, body, axle, years[]}]
GET /api/lookup/cheapest?category=&make=&model=&variant=&mmCode=&year=   → band-widened live comps, cheapest first
```

### Catalogue refresh (Imagin8 / TransUnion, flat-fee retainer)

```bash
npm run catalogue:refresh   # requires IMAGIN8_API_KEY + IMAGIN8_CUSTOMER_ID
```

Refreshes per-variant production year ranges (`IntroYear`/`DisconYear`) via the live `getModels` endpoint into **`data/tu-years.json`**. The server NEVER calls Imagin8 at request time — it reads the local file, so the UI and every request stay free and offline-resilient. `tu-variants.json` remains the single source of truth for variant rows; the overlay only enriches years. ⚠️ `.gitignore` excludes `data/*.json` — add the refreshed file with `git add -f packages/tru-arbitrage/data/tu-years.json` (matches how `tu-variants.json` ships).

## Offers + OTP

`POST /api/deals/:id/offer` generates the seller offer text + a 6-digit OTP (15-min TTL) the seller can verify when the dealer makes contact. Regenerating replaces the OTP — only the newest is valid.

## Flow ↔ Radar

- Flow's public feed `GET /api/public/stock?dealer=<slug>` exposes `dateAcquired` + live-derived `daysInInventory`.
- Master-admin provisioning: **TruRadar tab in DealershipAdmin** → Flow proxies `PUT /api/internal/truradar/dealers/:slug` to this service's registry with the sync key (the key never touches the browser). `TRU_RADAR_URL` env on premium.
- The dormant own-stock gate (`evaluateOverpricedStock` + `POST /api/mystock/scan`) is reserved for a future Flow bolt-on.

## Deploy

Render service `trusaas-arbitrage` (render.yaml §7) — set `JWT_SECRET` + `TRUFLOW_SYNC_KEY` in the dashboard. Domain: radar.tru-saas.com (planned).

## Retired

Facebook Marketplace lane (BrightData dataset), WhatsApp alert delivery (webhook-only now), flat recon buffer.
