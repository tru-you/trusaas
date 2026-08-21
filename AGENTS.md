# TruSaaS — Agent Project Memory

**Last updated:** 2026-08-21 by Kimi (OpenCode)
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

**Status:** Active, testing new `applicationName` (`eValue8Broker`)

**Env vars (all services):**
- `IMAGIN8_API_KEY` — platform API key
- `IMAGIN8_CUSTOMER_ID` — account ID
- `IMAGIN8_USERNAME` — account login
- `IMAGIN8_PASSWORD` — account password
- `IMAGIN8_APP_NAME` — **currently `eValue8Broker` for testing**

**API methods used:**
- `getStaticInfo(mmCode)` → vehicle specs (flat-fee, unlimited calls) — used in Add Vehicle auto-fill
- `getModels(make)` → live model catalogue (flat-fee, unlimited calls) — **working 2026-08-21**
- `getValues(mmCode, year, mileage)` → TU valuation (chargeable per-call, needs all 5 creds) — **working 2026-08-21**, returns `mmRetail`/`mmTrade`/`mmNew`/`mmEstimator`
- `regCheck(identifier, type)` → vehicle background check (chargeable per-call)

**Transport:** All Imagin8 calls use **GET + query string params** (not POST body). Render/Cloudflare rejects non-empty JSON POST bodies.

**Server routes (GET):**
- `GET /api/imagin8/static?mmCode=...` — all apps
- `GET /api/imagin8/models?make=...` — Lens + Inspect
- `POST /api/imagin8/valuation` — all apps (JSON body works here, different endpoint)
- `POST /api/imagin8/regcheck` — Inspect + Premium

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

---

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

### Disk Mounts

All data lives on mounted Render disks. **Without these, every deploy wipes inventory:**
- TruLens: `/var/data` (5GB)
- TruInspect: `/var/data` (5GB)
- Premium: `/var/data` (10GB)

---

## 6. Known Issues / TODO

- [ ] TruInspect `VehicleManager.tsx` / `DesktopDashboard.tsx` — pre-existing TS errors unrelated to recent changes
- [ ] `packages/imagin8.ts` `getModels` response shape — currently heuristic split on first word for model/variant. May need refinement based on real Imagin8 responses.
- [ ] TruFlow Premium `render.yaml` — `IMAGIN8_APP_NAME` also declared but may not need `getModels` route unless Premium gets a VehiclePicker too

---

## 7. How to Update This File

Whenever you:
- Add/remove a service or integration
- Change API contracts (Imagin8, Zernio, etc.)
- Modify deployment config
- Fix a bug that required architectural knowledge

**Append to Section 4 (Recent Changes)** and update **Section 3 (Integrations)** if env vars or routes changed.

---

## 8. Quick Reference

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
