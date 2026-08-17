# TruInspect

**Vehicle Inspection Reports (VIR) + trade-in appraisals** — a mobile-first PWA that guides a dealership inspector through a 27-slot photo walk-around, records per-slot condition, tags damage on the real photos, completes a disclosure checklist, and produces a printable PDF VIR. It also runs a separate 28-step trade-in workflow that values the car against live market prices and prints a signed trade-in offer.

Part of the TruSaaS family alongside TruFlow DMS, TruLens and the TruOrbit web-3D viewer.

## What it does

- **Guided inspection** — fixed 27-slot photo walk-around with phase tabs, live camera or bulk upload, per-slot condition assessment captured at capture time.
- **Inspection sheet** — per-point ratings (condition, presence, service history, function) with comments, an "All OK" shortcut, and disclosure flags.
- **Damage tagging** — tap-the-photo manual damage tagging (panel, type, severity 1–5, close-up photos, x/y pin). Damage detection is fully manual — no black-box AI scoring; the report grade is computed only from real inspector inputs.
- **VIR report** — printable/downloadable PDF (html2pdf) with an overall condition band (1.0–5.0 Manheim-style scale), panel grades, damage list and dealer branding.
- **Trade-in workflow** — 28-step walk-around, live market valuation (dealer stock pages + AutoTrader/Cars.co.za via the scraper layer, mileage-adjusted), TransUnion/Imagin8 valuation + reg check, recon cost and margin build-up, and a signed trade-in offer report.
- **Inventory** — searchable/filterable vehicle catalogue with status tabs, sync status, readiness badges and fleet stats.
- **Licence-disc scan** — reads the PDF417 barcode on a SA licence disc (native `BarcodeDetector` with zxing fallback) to pre-fill vehicle details.
- **Export to DMS** — pushes photos + vehicle to TruFlow DMS.
- **DealerAssist** — floating AI chat assistant for inspection/trade-in questions.
- **PWA** — installable on the phone over HTTPS; desktop shows a phone-frame mock.

Photos are stored as content-addressed files (SHA-256 filenames) under `/media` and served immutably.

## Tech stack

- **UI** — Vite 6, React 19, TypeScript, Tailwind CSS v4, lucide-react, recharts
- **Server** — Express 4 (one server serves both the API and the SPA), tsx in dev, esbuild → `dist/server.cjs` in prod
- **Data** — local JSON store by default (`LOCAL_MODE=1`); optional Firebase Admin → Firestore for cloud multi-device
- **Scanning** — @zxing/browser + @zxing/library (PDF417)
- **Media** — sharp (resize), content-addressed file store
- **Reports** — html2pdf.js (client-side PDF)
- **Scraping** — axios + cheerio (AutoTrader, Cars.co.za, dealer JSON APIs, JSON-LD), optional headless render worker

## Quickstart

```bash
npm install
cp .env.example .env    # then fill in what you need
npm run dev             # http://localhost:3000
```

Production:

```bash
npm run build           # vite build + esbuild server bundle
npm start               # node dist/server.cjs
```

`npm run lint` runs `tsc --noEmit`. `npm run check:dealers` verifies the pre-configured dealer stock layers (`data/price-sources.json`) and can gate deploys. The shared UI package is synced automatically before dev/build/lint (`sync:ui`).

## Configuration

| Env var | Purpose |
| --- | --- |
| `PORT` | HTTP port (default 3000) |
| `NODE_ENV` | `production` enables HSTS + static `dist/` serving |
| `LOCAL_MODE` | `1` = on-disk inventory store; `0` = Firestore (needs Firebase credentials) |
| `DATA_DIR` | Where the local store and media live — must be a mounted disk in prod |
| `PROJECT_ID` / `FIREBASE_PROJECT_ID` | Firebase project id (shared with TruFlow Premium) |
| `AUTOLENS_DB_ID` | Named Firestore database id |
| `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin credentials |
| `TRUFLOW_DMS_URL` / `DMS_URL` | TruFlow DMS base URL for exports + access-code verification |
| `TRUFLOW_SYNC_KEY` | Shared service-to-service key to TruFlow |
| `TRUINSPECT_ACCESS_CODE` | Shared inspector access code (legacy) |
| `TRUINSPECT_TOKEN_SECRET` | Device-token signing secret |
| `DEEPSEEK_API_KEY` | AI listing copywriter (falls back to mock when unset) |
| `IMAGIN8_API_KEY` | TransUnion valuation / reg-check |
| `SCRAPER_SERVICE_URLS` / `SCRAPER_SERVICE_URL` | Headless render worker(s); comma-separated list round-robins. Unset = plain HTTP |
| `SCRAPER_*` | Scraper tuning knobs (timeouts, cache TTL, retries, AutoTrader/Cars.co.za selectors) |

> Note: the code reads `DEEPSEEK_API_KEY`, not `GEMINI_API_KEY` — if you still have `GEMINI_API_KEY` in `.env` from the old AI Studio template it is ignored.

## API

Auth-gated routes exchange the inspector access code for a signed device token (`POST /api/auth/device`).

- `POST /api/auth/device` — access code → signed device token
- `GET/POST /api/inventory`, `POST /api/inventory/upload-photo`, `POST /api/inventory/upload-trade-photo`, `DELETE /api/inventory/:id` — vehicle + photo management
- `POST /api/valuation`, `GET /api/valuation/history/:vehicleId` — market valuation + snapshots
- `POST /api/imagin8/valuation`, `POST /api/imagin8/regcheck` — TransUnion valuation / reg check
- `POST /api/inspect/damage` — damage-detection stub (returns `aiMode:false`; tagging is manual)
- `POST /api/export/dms`, `GET /api/export/dms/config` — push to TruFlow DMS
- `POST /api/gemini/analyze` — DeepSeek listing title/copywriter (no image sent)
- `GET /api/version`, `GET /api/health` — deploy + health metadata
- `GET /media/*` — immutable photo files

## Deployment

- Render (nixpacks): `npm install` → `npm run build` → `npm start`. Keep writable state under `DATA_DIR` on a mounted disk so it survives deploys.
- Production: `https://inspect.tru-saas.com`
- PWA install needs HTTPS for the full camera experience; serve `/media/*` immutably.

Related services: `trusaas-premium.onrender.com` (TruFlow Premium DMS), `trusaas-flow.onrender.com` (Lite), `trusaas-crm-scraper.onrender.com` (headless scraper worker), `trusaas-chat.onrender.com` (DealerAssist).