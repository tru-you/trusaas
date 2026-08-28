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
- **One gated call** — TU valuation backstop via TruFlow's internal route (`x-tru-sync-key`), only when comps are thin, deducts the *right dealer's* bundle, fails closed. TU book values never fill deal or price-check lists.
- **Dynamic recon** — `clamp(3% × marketRetail, R5k, R30k)`. No flat buffers.
- **Sanity gate** — net margin > 40% of market retail is rejected: miracles are data errors (salvage misparse, snippet artifacts).
- **Per-dealer isolation** — every store key is `${dealerSlug}:${id}`; a dealer's own site domain is excluded from their own scan.

## Price check

Pick make → model → year from the static TransUnion catalogue (27,503 variants, local, free) → every live asking price in South Africa, cheapest first, deep-linked. Never spends TU.

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
