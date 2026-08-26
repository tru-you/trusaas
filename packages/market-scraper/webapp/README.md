# Market Value webapp

A public valuation tool built on the **market-scraper** engine. Pick a market
(ZA cars, US cars, UK cars, SA property), enter a car or property, and it returns
a live market average with a per-source breakdown.

Works on:
- **Netlify** — static `index.html` + a serverless function for the API (this is
  what `netlify.toml` is for). One function bundle, no runtime deps.
- **Any Node host (Render, Fly, VPS)** — `npm run webapp` runs the bundled Express server.

## Keys

Each instance sets **its own** keys as env vars. No key = the free path only
(plain HTTP; sites that bot-block, e.g. US/UK classifieds, return 0 listings
until a key is added). The paid tiers only engage when the key is present.

| Env var | Purpose | How |
|---|---|---|
| `BRIGHTDATA_API_KEY` | Bright Data **Web Unlocker** — unblocks Autotrader.com / Cars.com / AutoTrader.co.uk etc. | + set `SCRAPER_UNLOCKER_ENABLED=1` |
| `SCRAPER_UNLOCKER_ENABLED` | `1` to switch the Unlocker on | |
| `SCRAPER_SERVICE_URLS` | one or more headless render workers (comma-separated) | renders JS-only SPAs |
| `SERP_API_KEY` + `SERP_PROVIDER` | Google SERP fallback tier (`brightdata` or `serpapi`) | wide net when the free layers are thin |
| `SERP_ZONE` | SERP zone (default `serp`) | Bright Data only |
| `PORT` | local/Node server port (default `4300`) | Node host only |

## Deploy — Netlify

```bash
cd packages/market-scraper/webapp
netlify deploy --prod --dir . --site <site-id>
```

Then set the keys in the Netlify dashboard → the site → **Environment variables**.

The frontend is plain static (no build step). The API is a single pre-bundled
function at `netlify/functions/api.mjs` — regenerate it after editing
`netlify/functions/api.ts` or the engine:

```bash
esbuild netlify/functions/api.ts --bundle --platform=node --format=esm --target=node18 --outfile=netlify/functions/api.mjs
```

## Deploy — Node host

```bash
cd packages/market-scraper
npm install
PORT=4300 npm run webapp
```

## API

- `GET /api/markets` → `[{ id, label }]`
- `POST /api/valuation` `{ market?, make, model, year, mileage?, location? }` → `ValuationResult`

`market` ∈ `za | us | uk | housingZa`. For `housingZa`, pass `location` (area) and
`model` as the property type (`apartment`, `house`, …).

## Local test

```bash
cd packages/market-scraper
npm run test           # all markets
npm run test -- us     # one market (za | us | uk | housingZa)
```
