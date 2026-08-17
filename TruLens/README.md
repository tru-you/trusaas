# TruLens

**Dealer photo studio** — a mobile-first PWA that guides a dealership yard team through photographing a vehicle slot-by-slot (27 standardised angles), scores each shot, tags damage, and publishes the finished set to the dealership website feed and TruFlow DMS.

Part of the TruSaaS family alongside TruFlow DMS, TruInspect and the TruOrbit web-3D viewer.

## What it does

- **Guided capture** — live camera with a per-slot angle overlay, client-side shot-quality scoring, Keep/Redo, and bulk photo upload with auto slot-assignment.
- **Licence-disc scan** — reads the PDF417 barcode on a SA vehicle licence disc (native `BarcodeDetector` with a zxing fallback) and pre-fills make, model, colour, VIN and year.
- **Image review & tagging** — rotate, rate condition (OK / Note / Damage), add notes, and tag damage by hand (panel, type, severity, x/y pin) straight on the photo.
- **Report & publish** — printable VIR-style report (html2pdf) with dealer branding, star condition score, shot grid, WhatsApp blurb and a Web3D embed link, then **Publish to website feed** and/or **Send to DMS**.
- **Inventory** — searchable/filterable vehicle catalogue with add/edit, status tabs (All / In-Progress / Ready / Listed), a "web readiness" filter, and fleet stats.
- **Valuation** — live market value at the pricing step via the scraper layer (AutoTrader / Cars.co.za, mileage-adjusted).
- **DealerAssist** — floating AI chat assistant for dealer questions.
- **PWA** — installable on the phone over HTTPS; works in a desktop phone-frame mock in the browser.

Photos are stored as content-addressed files (SHA-256 filenames) under `/media`, not base64 in the database, to keep feed payloads small. Vehicles are retained for 14 days after the first successful DMS export — TruFlow becomes the source of truth.

## Tech stack

- **UI** — Vite 6, React 19, TypeScript, Tailwind CSS v4, lucide-react, recharts
- **Server** — Express 4 (one server serves both the API and the SPA), tsx in dev, esbuild → `dist/server.cjs` in prod
- **Data** — local JSON store by default (`LOCAL_MODE=1`); optional Firebase Admin → Firestore for cloud multi-device
- **Scanning** — @zxing/browser + @zxing/library (PDF417)
- **Media** — sharp (resize), content-addressed file store
- **Reports** — html2pdf.js (client-side PDF)

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

`npm run lint` runs `tsc --noEmit`. The shared UI package is synced automatically before dev/build/lint (`sync:ui`).

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
| `TRUFLOW_DMS_URL` | TruFlow DMS base URL for dealership list + Export to DMS |
| `TRUFLOW_SYNC_KEY` | Shared service-to-service key to TruFlow |
| `TRULENS_ACCESS_CODE` / `TRULENS_DEALER_CODES` | Access-code auth for dealers |
| `TRULENS_TOKEN_SECRET` | Device-token signing secret |
| `LENS_DEFAULT_DEALER_SLUG` | Optional default dealership |
| `DEEPSEEK_API_KEY` | AI listing copywriter (falls back to mock when unset) |
| `IMAGIN8_API_KEY` | TransUnion valuation / reg-check |

## API

Auth-gated routes exchange the dealership access code for a signed device token (`POST /api/auth/device`).

- `POST /api/auth/device` — access code → signed device token
- `GET /api/dealerships`, `GET /api/public/stock` — dealership + public stock feeds
- `GET/POST /api/inventory`, `POST /api/inventory/upload-photo`, `DELETE /api/inventory/:id` — vehicle management
- `POST /api/gemini/analyze` — DeepSeek listing title/copywriter
- `POST /api/valuation`, `POST /api/imagin8/valuation`, `POST /api/imagin8/regcheck` — market + TransUnion valuations
- `POST /api/export/dms`, `GET /api/export/dms/config` — push to TruFlow DMS
- `PUT/DELETE /api/sync/vehicle`, `DELETE /api/sync/vehicle/photos` — service-to-service sync from TruFlow
- `POST /api/export/web-3d`, `GET /api/public/web3d/:stockNumber` — spin/3D packages for dealer sites
- `GET /api/version`, `GET /api/health` — deploy + health metadata

## Deployment

- Render (nixpacks): `npm install` → `npm run build` → `npm start`. Keep writable state under `DATA_DIR` on a mounted disk so it survives deploys.
- Production: `https://lens.tru-saas.com`
- PWA install needs HTTPS for the full camera experience; serve `/media/*` immutably.

Related services: `trusaas-premium.onrender.com` (TruFlow Premium DMS), `trusaas-flow.onrender.com` (Lite), `trusaas-crm-scraper.onrender.com` (headless scraper worker), `trusaas-chat.onrender.com` (DealerAssist).